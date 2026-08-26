import type { GraphMakerState } from "@milaboratories/graph-maker";
import strings from "@milaboratories/strings";
import type {
  PColumnIdAndSpec,
  PColumnSpec,
  PFrameHandle,
  PlDataTableStateV2,
  PlMultiSequenceAlignmentModel,
  PlRef,
  SUniversalPColumnId,
} from "@platforma-sdk/model";
import {
  BlockModelV3,
  DataModelBuilder,
  createPFrameForGraphs,
  createPlDataTableStateV2,
  createPlDataTableV2,
} from "@platforma-sdk/model";
export type * from "@milaboratories/helpers";

/**
 * The "Cluster by" selection, snapshotted from the chosen dropdown option (the
 * model.md snapshot pattern: `.args` is data-only, but the option refs come from
 * the result pool, so the UI writes the resolved selection into `data` on the
 * user's dropdown gesture). `single` clusters one CDR3 chain (β or α — the chain
 * is whichever column `sequenceRef` points at); `paired` concatenates β+α.
 */
export type InputSelection =
  | {
      mode: "single";
      sequenceRef: SUniversalPColumnId;
      useVGene: boolean;
      vGeneRef?: SUniversalPColumnId; // resolved V-gene column for the chosen chain (only when useVGene)
    }
  | { mode: "paired"; betaRef: SUniversalPColumnId; alphaRef: SUniversalPColumnId };

export type BlockData = {
  // Block label (custom overrides default).
  defaultBlockLabel: string;
  customBlockLabel: string;

  // Input selection.
  datasetRef?: PlRef; // anchor: bulk or single-cell TCR dataset
  inputSelection?: InputSelection; // the chosen "Cluster by" option (mode + ref(s) + useVGene)

  // Engine parameter (advanced). MCL inflation = 1st element of mcl_params=[inflation, 2].
  // Default 1.2 (clusTCR's own default — the value our benchmark ran at); hard range 1.01–5.0.
  inflation: number;

  // Centroid (kalign consensus, reused from clonotype-clustering).
  consensusThreshold: number; // 0–1, default 0.6: residue committed only above this column-weight fraction, else "X"
  weightByAbundance: boolean; // false = equal weight (default); true = abundance-weighted consensus/medoid

  // Resources (advanced). CPU-only in v1 — no GPU.
  mem?: number;
  cpu?: number;

  // UI-only view state — stays in data, never projected to args.
  tableState: PlDataTableStateV2;
  alignmentModel: PlMultiSequenceAlignmentModel;
  graphStateHistogram: GraphMakerState;
  graphStateBubble: GraphMakerState;
};

/**
 * Find the "Cluster by" option that corresponds to a stored selection, and return the option (whose
 * `value` is the string `PlDropdown` and the option list compare against).
 *
 * Compares the identifying FIELDS instead of stringifying the selection: persisted `data` comes back
 * with its object keys alphabetically sorted, so `JSON.stringify(selection)` no longer equals the
 * option's own JSON and a restored selection reads as "not offered" after a project reopen.
 */
export function findClusterByOption(
  options: { label: string; value: string }[] | undefined,
  selection: InputSelection | undefined,
): { label: string; value: string } | undefined {
  if (options === undefined || selection === undefined) return undefined;
  return options.find((o) => {
    let parsed: InputSelection;
    try {
      parsed = JSON.parse(o.value) as InputSelection;
    } catch {
      return false;
    }
    if (parsed.mode === "single" && selection.mode === "single")
      return (
        parsed.sequenceRef === selection.sequenceRef &&
        parsed.useVGene === selection.useVGene &&
        parsed.vGeneRef === selection.vGeneRef
      );
    if (parsed.mode === "paired" && selection.mode === "paired")
      return parsed.betaRef === selection.betaRef && parsed.alphaRef === selection.alphaRef;
    return false;
  });
}

export function getDefaultBlockLabel(data: { inputLabel: string; inflation: number }): string {
  const parts: string[] = [];
  if (data.inputLabel) parts.push(data.inputLabel);
  parts.push(`inflation:${data.inflation}`);
  return parts.filter(Boolean).join(", ");
}

const dataModel = new DataModelBuilder().from<BlockData>("v1").init(() => ({
  defaultBlockLabel: getDefaultBlockLabel({ inputLabel: "", inflation: 1.2 }),
  customBlockLabel: "",
  inflation: 1.2,
  consensusThreshold: 0.6,
  weightByAbundance: false,
  tableState: createPlDataTableStateV2(),
  alignmentModel: {},
  graphStateBubble: {
    title: "Most abundant clusters",
    template: "bubble",
    currentTab: null,
    layersSettings: {
      bubble: {
        normalizationDirection: null,
      },
    },
  },
  graphStateHistogram: {
    title: strings.titles.histogram,
    template: "bins",
    currentTab: null,
    layersSettings: {
      bins: { fillColor: "#99e099" },
    },
    axesSettings: {
      axisY: {
        axisLabelsAngle: 90,
        scale: "log",
      },
      other: { binsCount: 30 },
    },
  },
}));

/**
 * Whether the "Paired (α + β)" entry appears in the "Cluster by" dropdown. NOT OFFERED for now.
 */
const OFFER_PAIRED: boolean = false;

/** Strip the trailing " Primary" token from a MiXCR single-cell label ("Beta CDR3 aa Primary" -> "Beta CDR3 aa"). */
function trimPrimary(label: string): string {
  return label.replace(/\s+Primary$/i, "");
}

export const platforma = BlockModelV3.create(dataModel)

  .args((data) => {
    if (!data.datasetRef) throw new Error("Dataset is required");
    const sel = data.inputSelection;
    if (!sel) throw new Error("Choose what to cluster by");
    if (sel.mode === "single" && !sel.sequenceRef) throw new Error("A CDR3 column is required");
    if (sel.mode === "paired" && (!sel.betaRef || !sel.alphaRef))
      throw new Error("Paired clustering requires both the β and α CDR3 columns");

    // Gate Run on the numeric params: throwing makes the block not-runnable (Run disabled, message
    // surfaced) rather than silently coercing a cleared or out-of-range field. The
    // `!(… >= … && … <= …)` form also catches a blank field (undefined) or NaN — a plain
    // `< || >` would let those through as false.
    if (!(data.inflation >= 1.01 && data.inflation <= 5.0))
      throw new Error("MCL inflation must be between 1.01 and 5.0");
    if (!(data.consensusThreshold >= 0 && data.consensusThreshold <= 1))
      throw new Error("Consensus threshold must be between 0 and 1");

    return {
      defaultBlockLabel: data.defaultBlockLabel,
      customBlockLabel: data.customBlockLabel,
      datasetRef: data.datasetRef,
      inputSelection: sel,
      inflation: data.inflation,
      consensusThreshold: data.consensusThreshold,
      weightByAbundance: data.weightByAbundance,
      mem: data.mem,
      cpu: data.cpu,
    };
  })

  // Dataset picker: TCR α/β clonotype datasets (bulk + single-cell). No peptide (variantKey).
  // Only TCR α/β is offered — IG (BCR) and TCR γ/δ are dropped. Bulk anchors are per-chain
  // (clonotypeKey domain `pl7.app/vdj/chain` = TCRAlpha/TCRBeta); single-cell anchors are
  // per-receptor (scClonotypeKey domain `pl7.app/vdj/receptor` = TCRAB).
  .output("datasetOptions", (ctx) => {
    const options = ctx.resultPool.getOptions(
      [
        {
          axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/clonotypeKey" }],
          annotations: { "pl7.app/isAnchor": "true" },
        },
        {
          axes: [{ name: "pl7.app/sampleId" }, { name: "pl7.app/vdj/scClonotypeKey" }],
          annotations: { "pl7.app/isAnchor": "true" },
        },
      ],
      {
        // suppress the column's native label (e.g. "Number of Reads") to show only the dataset label
        label: { includeNativeLabel: false },
      },
    );

    // Bulk anchors carry the chain per clonotypeKey; keep only the TCR α/β chains.
    const TCR_AB_CHAINS = new Set(["TCRAlpha", "TCRBeta"]);

    return options.filter((opt) => {
      const keyAxis = ctx.resultPool.getPColumnSpecByRef(opt.ref)?.axesSpec[1];
      if (keyAxis === undefined) return false;
      // Exclude this block's OWN exported cluster axis from the input picker.
      if (keyAxis.domain?.["pl7.app/clustering/algorithm"] !== undefined) return false;
      // Bulk: per-chain anchor → keep only TCR α/β (drop IG, TCR γ/δ).
      if (keyAxis.name === "pl7.app/vdj/clonotypeKey") {
        return TCR_AB_CHAINS.has(keyAxis.domain?.["pl7.app/vdj/chain"] ?? "");
      }
      // Single-cell: per-receptor anchor → keep only the TCR α/β receptor (drop IG, TCR γ/δ). The
      // "Cluster by" dropdown then offers the per-chain CDR3 options plus Paired (α + β).
      if (keyAxis.name === "pl7.app/vdj/scClonotypeKey") {
        return keyAxis.domain?.["pl7.app/vdj/receptor"] === "TCRAB";
      }
      return false;
    });
  })

  // The single "Cluster by" dropdown. Options are generated from the dataset's Primary CDR3 aa
  // columns (labelled from MiXCR, "Primary" trimmed), each also offered "+ V gene" when the
  // dataset carries V-gene columns. The paired α+β entry is built but gated off (OFFER_PAIRED).
  // Each option's value is a JSON-encoded InputSelection; the UI parses it into data.inputSelection
  // on the user's gesture (snapshot pattern). The chain name is read from the MiXCR LABEL, never
  // from the scClonotypeChain slot letter (which is diversity-ordered: for αβ, A=Beta, B=Alpha).
  .output("clusterByOptions", (ctx) => {
    const ref = ctx.data.datasetRef;
    if (ref === undefined) return undefined;
    const dsSpec = ctx.resultPool.getPColumnSpecByRef(ref);
    if (dsSpec === undefined) return undefined;
    const isSingleCell = dsSpec.axesSpec[1].name === "pl7.app/vdj/scClonotypeKey";

    const cdr3Matcher = {
      axes: [{ anchor: "main" as const, idx: 1 }],
      name: "pl7.app/vdj/sequence",
      domain: {
        "pl7.app/vdj/feature": "CDR3",
        "pl7.app/alphabet": "aminoacid",
        // Single-cell: restrict to each chain's Primary CDR3.
        ...(isSingleCell ? { "pl7.app/vdj/scClonotypeChain/index": "primary" } : {}),
      },
    };
    const cdr3Cols = ctx.resultPool.getCanonicalOptions({ main: ref }, [cdr3Matcher], {
      ignoreMissingDomains: true,
      labelOps: { includeNativeLabel: true },
    });
    if (cdr3Cols === undefined) return undefined;

    // Resolve the V-gene column(s) so the "+ V gene" options carry the matching V-gene ref (the
    // workflow consumes it directly — no workflow-side chain matching). Single-cell: one V-gene
    // column per chain (restrict to Primary); bulk: one on the anchor. Match a V gene to a CDR3 by
    // the chain name in the MiXCR label ("Beta CDR3 aa" <-> "Beta Best V gene"; bulk: both have no
    // chain prefix → both map to "").
    const vGeneOpts = ctx.resultPool.getCanonicalOptions(
      { main: ref },
      [
        {
          axes: [{ anchor: "main" as const, idx: 1 }],
          name: "pl7.app/vdj/geneHit",
          domain: {
            "pl7.app/vdj/reference": "VGene",
            ...(isSingleCell ? { "pl7.app/vdj/scClonotypeChain/index": "primary" } : {}),
          },
        },
      ],
      { ignoreMissingDomains: true, labelOps: { includeNativeLabel: true } },
    );
    const chainOf = (label: string) =>
      (label.match(/^(Alpha|Beta|Gamma|Delta|Heavy|Light)\b/i)?.[1] ?? "").toLowerCase();
    const vGeneByChain = new Map<string, SUniversalPColumnId>();
    for (const v of vGeneOpts ?? []) vGeneByChain.set(chainOf(v.label ?? ""), v.value);

    const options: { label: string; value: string }[] = [];
    for (const c of cdr3Cols) {
      const base = trimPrimary(c.label ?? "");
      const single: InputSelection = { mode: "single", sequenceRef: c.value, useVGene: false };
      options.push({ label: base, value: JSON.stringify(single) });
      const vGeneRef = vGeneByChain.get(chainOf(c.label ?? ""));
      if (vGeneRef !== undefined) {
        const withV: InputSelection = {
          mode: "single",
          sequenceRef: c.value,
          useVGene: true,
          vGeneRef,
        };
        options.push({ label: `${base} + V gene`, value: JSON.stringify(withV) });
      }
    }

    // Paired (single-cell with both chains). Identify β/α by the MiXCR label, not the slot.
    // NOT OFFERED for now (OFFER_PAIRED): the option is undocumented by request, so the UI must not
    // surface it. Everything behind it still works end to end — the InputSelection union, the
    // workflow's β-then-α ordering and clusTCR's own alpha= path — so re-enabling is this one flag.
    if (OFFER_PAIRED && isSingleCell) {
      const beta = cdr3Cols.find((c) => /beta/i.test(c.label ?? ""));
      const alpha = cdr3Cols.find((c) => /alpha/i.test(c.label ?? ""));
      if (beta !== undefined && alpha !== undefined) {
        const paired: InputSelection = {
          mode: "paired",
          betaRef: beta.value,
          alphaRef: alpha.value,
        };
        options.push({ label: "Paired (α + β)", value: JSON.stringify(paired) });
      }
    }

    return options;
  })

  .output("isSingleCell", (ctx) => {
    if (ctx.data.datasetRef === undefined) return undefined;
    const spec = ctx.resultPool.getPColumnSpecByRef(ctx.data.datasetRef);
    if (spec === undefined) return undefined;
    return spec.axesSpec[1].name === "pl7.app/vdj/scClonotypeKey";
  })

  // Empty-input flag (the workflow emits `isEmpty`). Not-ready-safe read (getDataAsJson throws
  // mid-run on remote backends — MILAB-6318), so use the OrUndefined variant.
  .output("inputState", (ctx): boolean | undefined => {
    const inputState = ctx.outputs?.resolve("isEmpty")?.getDataAsJsonOrUndefined<unknown>();
    return typeof inputState === "boolean" ? inputState : undefined;
  })

  // Main clusters table.
  .outputWithStatus("clustersTable", (ctx) => {
    const pCols = ctx.outputs?.resolve("clustersPf")?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPlDataTableV2(ctx, pCols, ctx.data.tableState);
  })

  // clusTCR run log.
  .output("clustcrOutput", (ctx) => ctx.outputs?.resolve("clustcrLog")?.getLogHandle())

  // MSA p-frame for the alignment viewer: the workflow's msaPf (linker + distances + sequences)
  // plus the dataset's ORIGINAL sequence columns chosen for clustering.
  .output("msaPf", (ctx): PFrameHandle | undefined => {
    const msaCols = ctx.outputs?.resolve("msaPf")?.getPColumns();
    if (!msaCols) return undefined;
    const datasetRef = ctx.data.datasetRef;
    const sel = ctx.data.inputSelection;
    if (datasetRef === undefined || sel === undefined) return createPFrameForGraphs(ctx, msaCols);
    const refs = sel.mode === "paired" ? [sel.betaRef, sel.alphaRef] : [sel.sequenceRef];
    const seqCols = ctx.resultPool.getAnchoredPColumns(
      { main: datasetRef },
      refs.map((s) => JSON.parse(s) as never),
    );
    if (seqCols === undefined) return createPFrameForGraphs(ctx, msaCols);
    return createPFrameForGraphs(ctx, [...msaCols, ...seqCols]);
  })

  // The cluster-to-clonotype linker column id, used by the MSA viewer.
  .output("linkerColumnId", (ctx) => {
    const pCols = ctx.outputs?.resolve("msaPf")?.getPColumns();
    if (!pCols) return undefined;
    return pCols.find((p) => p.spec.annotations?.["pl7.app/isLinkerColumn"] === "true")?.id;
  })

  // Spec of the per-(sample, cluster) abundance column — drives the MSA cell-button axis.
  .output("clusterAbundanceSpec", (ctx) => {
    return ctx.outputs?.resolve("clusterAbundanceSpec")?.getDataAsJsonOrUndefined<PColumnSpec>();
  })

  // p-frame of all cluster columns, for the plots.
  .outputWithStatus("clustersPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs?.resolve("pf")?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPFrameForGraphs(ctx, pCols);
  })

  // Top-clusters p-frame for the bubble plot.
  .outputWithStatus("bubblePlotPf", (ctx): PFrameHandle | undefined => {
    const pCols = ctx.outputs?.resolve("bubblePlotPf")?.getPColumns();
    if (pCols === undefined) return undefined;
    return createPFrameForGraphs(ctx, pCols);
  })

  // Pcol id+spec lists for plot defaults.
  .output("clustersPfPcols", (ctx) => {
    const pCols = ctx.outputs?.resolve("pf")?.getPColumns();
    if (pCols === undefined || pCols.length === 0) return undefined;
    return pCols.map((c) => ({ columnId: c.id, spec: c.spec }) satisfies PColumnIdAndSpec);
  })

  .output("bubblePlotPfPcols", (ctx) => {
    const pCols = ctx.outputs?.resolve("bubblePlotPf")?.getPColumns();
    if (pCols === undefined) return undefined;
    return pCols.map((c) => ({ columnId: c.id, spec: c.spec }) satisfies PColumnIdAndSpec);
  })

  .output("isRunning", (ctx) => ctx.outputs?.getIsReadyOrError() === false)

  .title(() => "ClusTCR")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((_ctx) => [
    { type: "link" as const, href: "/" as const, label: strings.titles.main },
    { type: "link" as const, href: "/bubble" as const, label: "Most Abundant Clusters" },
    { type: "link" as const, href: "/histogram" as const, label: "Cluster Size Histogram" },
  ])

  .done();
