#!/usr/bin/env python
"""Dedup + cluster TCR clonotypes with clusTCR, inside the clustcr-runner docker image.

Reads the raw per-clonotype table, dedups the clustering columns to unique sequences, runs clusTCR
on the unique set, and emits the cluster assignment plus the representative->clonotype dedup mapping
(process_results.py expands clusters back to all clonotypes with it). This folds in what used to be
a separate base-Python prepare step.

Runs in the docker image (/env: clustcr + faiss-cpu + polars; this script baked at /app). The
workflow runs:
  micromamba run -p /env python /app/run_clustcr.py input.tsv output.csv dedup_mapping.tsv <n_cpus> --inflation <v>

Input  TSV (`input.tsv`, built by the workflow): `clonotypeKey`, `sequence_0` (primary CDR3, β or α),
  and EITHER `sequence_1` (paired α+β mode) OR `v_gene` (single + V-family mode) — mutually exclusive
  (paired ⊥ V-gene in clusTCR).
Output CSV (`output.csv`): `seq_id,cluster` — one row per unique sequence (seq_id = representative
  clonotypeKey); integer cluster id.
Output TSV (`dedup_mapping.tsv`): `representativeKey,clonotypeKey` — one row per original clonotype.

method by size (clusTCR's recommendation): `mcl` for < 50,000 unique CDR3s (deterministic, no Faiss),
`two-step` (Faiss + MCL) for >= 50,000. CPU-only (`use_gpu=False` — the image ships faiss-cpu). MCL
inflation is the first element of `mcl_params=[inflation, expansion]` (expansion fixed at 2). Dedup
and I/O use polars (memory-efficient over the full per-clonotype table); clusTCR's `fit()` is pandas-
based, so only the small unique-sequence set is converted.
"""
import argparse
import polars as pl

# clusTCR's own recommendation: mcl below this many unique sequences, two-step at/above.
MCL_TWO_STEP_THRESHOLD = 50_000


def main():
    p = argparse.ArgumentParser(description="Dedup + cluster TCR clonotypes with clusTCR")
    p.add_argument("input", nargs="?", default="input.tsv")
    p.add_argument("output", nargs="?", default="output.csv")
    p.add_argument("mapping", nargs="?", default="dedup_mapping.tsv")
    p.add_argument("n_cpus", nargs="?", type=int, default=1)
    p.add_argument("--inflation", type=float, default=1.2)
    args = p.parse_args()

    # --- Read the raw per-clonotype table (all-string) and rename to clusTCR column names. ---
    df = pl.read_csv(args.input, separator="\t", infer_schema_length=0).fill_null("")
    rename = {"sequence_0": "cdr3"}
    if "sequence_1" in df.columns:
        rename["sequence_1"] = "cdr3_alpha"  # paired mode
    df = df.rename(rename)
    key_cols = [c for c in ("cdr3", "cdr3_alpha", "v_gene") if c in df.columns]

    # --- Dedup identical clustering-key tuples; the first clonotypeKey per tuple is the
    # representative. clusTCR clusters the unique sequences; the mapping restores all clonotypes.
    reps = df.unique(subset=key_cols, keep="first")
    (
        df.join(
            reps.select(["clonotypeKey", *key_cols]).rename({"clonotypeKey": "representativeKey"}),
            on=key_cols,
            how="inner",
        )
        .select(["representativeKey", "clonotypeKey"])
        .write_csv(args.mapping, separator="\t")
    )

    # Unique sequences, keyed by representative clonotypeKey (= seq_id downstream).
    src = reps.select([pl.col("clonotypeKey").alias("seq_id"), *key_cols])
    n_unique = src.height
    method = "mcl" if n_unique < MCL_TWO_STEP_THRESHOLD else "two-step"

    paired = "cdr3_alpha" in src.columns and (src["cdr3_alpha"].str.len_chars() > 0).any()
    use_vgene = (
        (not paired) and "v_gene" in src.columns and (src["v_gene"].str.len_chars() > 0).any()
    )
    mode = "paired" if paired else ("single+vgene" if use_vgene else "single")
    print(
        f"[clustcr] {n_unique:,} unique seqs | method={method} | mode={mode} | "
        f"inflation={args.inflation} | n_cpus={args.n_cpus}",
        flush=True,
    )

    # clusTCR's fit() is pandas-based; feed it the (small) unique-sequence columns as python lists.
    import pandas as pd
    from clustcr import Clustering

    seq_ids = src["seq_id"].to_list()
    cdr3_list = src["cdr3"].to_list()

    clustering = Clustering(
        method=method, n_cpus=args.n_cpus, use_gpu=False, mcl_params=[args.inflation, 2]
    )

    # Each branch returns clusTCR's clusters_df and a row->seq_id key (clusters_df is keyed by the
    # sequence value(s), not our id).
    if use_vgene:
        vgene_list = src["v_gene"].to_list()
        data = pd.DataFrame({"cdr3": cdr3_list, "v_gene": vgene_list})
        cdf = clustering.fit(data, include_vgene=True, cdr3_col="cdr3", v_gene_col="v_gene").clusters_df
        key2id = {(str(c), str(v)): i for i, c, v in zip(seq_ids, cdr3_list, vgene_list)}
        row_key = lambda r: (str(r["junction_aa"]), str(r["v_call"]))
    elif paired:
        # clusTCR's `data.add(alpha)` concatenates beta+alpha; clusters_df.junction_aa is the join.
        alpha_list = src["cdr3_alpha"].to_list()
        cdf = clustering.fit(pd.Series(cdr3_list), alpha=pd.Series(alpha_list)).clusters_df
        key2id = {b + a: i for i, b, a in zip(seq_ids, cdr3_list, alpha_list)}
        row_key = lambda r: str(r["junction_aa"])
    else:
        cdf = clustering.fit(pd.Series(cdr3_list)).clusters_df
        key2id = {str(c): i for i, c in zip(seq_ids, cdr3_list)}
        row_key = lambda r: str(r["junction_aa"])

    assigned = {}
    for _, r in cdf.iterrows():
        sid = key2id.get(row_key(r))
        if sid is not None:
            assigned[sid] = int(r["cluster"])

    # Defensive: any unique sequence clusTCR did not return gets its own singleton cluster, so every
    # clonotype downstream receives a clusterId (guards against clusTCR-version drift; normally a no-op).
    next_id = (max(assigned.values()) + 1) if assigned else 0
    clusters = []
    for sid in seq_ids:  # seq_ids are unique (one per representative)
        cl = assigned.get(sid)
        if cl is None:
            cl = next_id
            next_id += 1
        clusters.append(cl)

    out = pl.DataFrame({"seq_id": seq_ids, "cluster": clusters})
    out.write_csv(args.output)
    sizes = out.group_by("cluster").len()
    n_multi = int(sizes.filter(pl.col("len") > 1).height)
    largest = int(sizes["len"].max()) if sizes.height else 0
    print(
        f"[OK] {args.output}: {out.height:,} seqs | clusters>1={n_multi:,} | largest={largest}",
        flush=True,
    )


if __name__ == "__main__":  # clusTCR uses multiprocessing (spawn)
    main()
