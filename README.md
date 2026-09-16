# ImmuneWatch ClusTCR

Group TCR clonotypes that are likely to recognize the same antigen. This Platforma block clusters T-cell receptors on their CDR3 amino-acid sequence with ImmuneWatch ClusTCR — linking sequences that differ by at most one substitution and partitioning the resulting similarity network with Markov clustering — then reports a representative clonotype, a consensus centroid, and a per-member distance for every cluster.

Analysis block for Platforma, the biologics discovery platform by MiLaboratories. For the full no-code workflow, see [platforma.bio](https://platforma.bio/).

## What it does

A repertoire read clonotype by clonotype says nothing about what those T cells see. Specificity is driven mostly by the central CDR3 loop, and receptors that converged on the same antigen tend to carry near-identical CDR3s even when they come from different donors, samples, or lineages. Grouping those receptors turns a list of clonotypes into a list of candidate specificity groups.

Clustering runs on **ClusTCR**: equal-length CDR3 amino-acid sequences within one substitution (Hamming distance ≤ 1) form a similarity network, which is partitioned by Markov clustering (MCL). **MCL inflation** controls granularity — higher values give smaller, tighter clusters. Clustering works on one chain at a time (β or α), and can be restricted so that two sequences are linked only when they also share a V gene **family**, so a cluster never mixes families. From 50,000 unique sequences upward, ClusTCR switches automatically to its `two-step` mode, pre-grouping sequences with FAISS before running MCL inside each group, which is what keeps large repertoires tractable.

Each cluster is then summarized. Its distinct members are aligned with kalign and a **theoretical centroid** is taken as the per-column consensus; columns where no residue reaches the consensus threshold emit `X`, marking positions where the group does not converge. Because that consensus need not exist in the data, the cluster is identified by its **medoid** — the real clonotype closest to the consensus centre — and the medoid *is* the cluster ID, so every cluster is named by a synthesizable sequence. Every member carries a distance to the centroid and every cluster a radius, so a tight specificity group is distinguishable from a loose one. The residue vote is either equal-weight, so the centroid describes the sequence set regardless of clonal expansion, or abundance-weighted, so expanded clones dominate.

Results are explored as a table with a multiple-sequence-alignment viewer, a bubble plot of the most abundant clusters, and a cluster size histogram.

## Inputs & outputs

* **Input:** TCR α/β clonotypes — bulk or single-cell — from [MiXCR Clonotyping](https://github.com/platforma-open/mixcr-clonotyping) or [Import V(D)J Data](https://github.com/platforma-open/import-vdj-data). You choose one CDR3 amino-acid column to cluster on, optionally with its V gene.
* **Output:** a cluster ID per clonotype, cluster size, per-sample cluster abundance and fraction, the reference centroid (medoid) sequence, a theoretical consensus centroid, per-member distance to centroid, and cluster radius — plus a bubble plot of the most abundant clusters and a cluster size histogram.

## Specifications

| | |
|---|---|
| Block title in app | ImmuneWatch ClusTCR |
| Engine | [ImmuneWatch ClusTCR](https://pypi.org/project/immunewatch-clustcr/) — Hamming-distance ≤ 1 similarity network partitioned by Markov clustering (MCL) |
| Large inputs | switches to ClusTCR `two-step` mode (FAISS pre-grouping, then MCL per group) at 50,000 unique sequences and above |
| Clustered on | CDR3 amino acid, one chain at a time (β or α), optionally restricted to a shared V gene family |
| Receptors | TCR α/β only — BCR/IG and TCR γ/δ datasets are not offered |
| Data types | bulk and single-cell TCR datasets |
| Key parameters | MCL inflation (default 1.2), consensus threshold (default 0.6), residue weighting (equal weight or by abundance) |
| Cluster identity | the medoid — the real clonotype closest to the cluster's consensus centre — is the cluster ID |
| Centroid | kalign MSA per-column consensus; columns below the consensus threshold emit `X` |
| Per-cluster metrics | cluster size, per-sample abundance and fraction, cluster radius, per-member distance to centroid |
| Views | cluster table with multiple-sequence-alignment viewer, most abundant clusters bubble plot, cluster size histogram |
| Compute | CPU only; memory and cores configurable |
| Platforms | linux-x64, linux-aarch64, macOS x64, macOS arm64 |

## Use cases

* **Specificity groups:** collapse a TCR repertoire into groups of receptors likely to recognize the same antigen, instead of reading it clonotype by clonotype.
* **Specificity annotation:** carry clusters into [ImmuneWatch DETECT](https://github.com/platforma-open/immunewatch-detect) to annotate what those receptors may recognize.
* **Cluster-level enrichment:** feed clusters into [Enrichment Analysis](https://github.com/platforma-open/clonotype-enrichment) to see which specificity groups were selected across rounds or timepoints, rather than which individual clones were.
* **Diversified lead selection:** supply cluster assignments to [Lead Selection](https://github.com/platforma-open/antibody-tcr-lead-selection), which uses them to spread the final panel across groups and to rank on cluster-level metrics.
* **Family tightness**: use cluster radius and distance-to-centroid to distinguish a converged family from a loosely related group.
* **Map overlay**: colour the [Sequence Space](https://github.com/platforma-open/clonotype-space) UMAP by cluster ID to see how clusters sit in the wider library.

## How it compares to other Platforma blocks

* **ImmuneWatch ClusTCR** groups TCRs on CDR3 sequence at one substitution, optionally within a V gene family — the most conservative grouping, and the one aimed directly at shared antigen specificity.
* **[GLIPH2 Clustering](https://github.com/platforma-open/tcr-clustering-gliph2)** groups TCRs on shared CDR3 motifs enriched against a reference repertoire — catches specificity groups that differ by more than one residue but share a motif.
* **[Sequence Clustering](https://github.com/platforma-open/clonotype-clustering)** groups any sequences by identity or BLOSUM similarity over whole sequences — receptor-agnostic, and a lineage-oriented rather than specificity-oriented view.
* **[Embedding Clustering](https://github.com/platforma-open/embedding-clustering)** groups by distance in protein language model space — relates sequences whose residues differ substantially, at the cost of an embedding run upstream.

Lead Selection can diversify on whichever of these the campaign calls for.

## FAQ

### What does MCL inflation do?

It controls how finely the similarity network is cut. Higher inflation gives more, smaller, tighter clusters; lower inflation gives fewer, larger ones. The default is 1.2 — ClusTCR's own default — and the accepted range is 1.01 to 5.0.

### Should I cluster with the V gene?

Adding the V gene requires two sequences to share a V **family** before they can be linked, so a cluster never mixes families. It is the stricter setting and reflects that V gene contributes to antigen contact; leave it off when you want to find CDR3 convergence across different V usage.

### Can I cluster α and β chains together?

No — clustering runs on one chain at a time. Run the block once per chain and compare the results.

### Does it work on BCR data, or on γ/δ TCRs?

No. Only TCR α/β datasets are offered in the dataset picker. For antibodies, use [Sequence Clustering](https://github.com/platforma-open/clonotype-clustering), [Paratope Clustering](https://github.com/platforma-open/paratope-clustering), or [Embedding Clustering](https://github.com/platforma-open/embedding-clustering).

### Does it work on single-cell data?

Yes. For a single-cell TCR dataset the block offers each chain's primary CDR3 as a clustering option, the same way it does for bulk.

### What is the difference between the theoretical and reference centroid?

The theoretical centroid is the consensus of the cluster's alignment — the winning residue at each column — so it summarizes the family but may not exist in your data. The reference centroid is the real member closest to that consensus. Distance-to-centroid and cluster radius are measured against the theoretical centroid, and both are always reported.

### What does the consensus threshold do?

It sets how much agreement a column needs before its residue is emitted into the theoretical centroid. Columns below the threshold emit X, marking positions where the family does not converge. The default is 0.6.

### Should the centroid be weighted by abundance?

Equal weight (the default) makes the centroid describe the cluster's sequence set regardless of which clones expanded. Abundance weighting lets expanded clones dominate the consensus, which is what you want when the question is about the dominant sequence rather than the family's shape.

### How is distance to centroid computed?

Not as a flat string comparison. Members are aligned with kalign, and each member's residue in a given column is charged by how rare that residue is in the column under the active residue weighting. The per-member sum, normalized by length, gives a distance between 0 and 1; the cluster radius is its maximum over the cluster's members, and the medoid is the member that minimizes it.

### What happens with very large repertoires?

From 50,000 unique sequences upward ClusTCR switches to `two-step` mode, pre-grouping sequences with FAISS before running MCL inside each group. The switch is automatic — there is no setting to change.

## Citation

ClusTCR was developed by the Meysman lab (ADReM Data Lab, University of Antwerp). Please cite the following publication if you use this block in your research:

> Valkiers, S., Van Houcke, M., Laukens, K., & Meysman, P. (2021). ClusTCR: a Python interface for rapid clustering of large sets of CDR3 sequences with unknown antigen specificity. *Bioinformatics* **37**(24), 4865–4867. [https://doi.org/10.1093/bioinformatics/btab446](https://doi.org/10.1093/bioinformatics/btab446)

## Licensing & legal notice

ClusTCR is the property of the University of Antwerp. ImmuneWatch BV holds an exclusive license to ClusTCR and supplies the modified and improved version used in this block under the name "ImmuneWatch ClusTCR". The block is made available within Platforma by MiLaboratories Inc. under agreement with ImmuneWatch BV. "ImmuneWatch," "ImmuneWatch ClusTCR," and "ImmuneWatch DETECT" are trademarks of ImmuneWatch BV. This block is provided for Research Use Only (RUO) and is not intended for use in diagnostic or therapeutic procedures. ImmuneWatch ClusTCR is provided "as is", without warranties of any kind, and is available only through Platforma (not as standalone software); access and use are subject to your Platforma license.

## Part of the Platforma ecosystem

This block is part of [Platforma](https://platforma.bio/) by [MiLaboratories](https://github.com/milaboratory), built on [ImmuneWatch ClusTCR](https://www.immunewatch.com/) and [kalign](https://github.com/TimoLassmann/kalign). Explore the other open-source blocks at [github.com/platforma-open](https://github.com/platforma-open) and the docs at [docs.platforma.bio](https://docs.platforma.bio/).
