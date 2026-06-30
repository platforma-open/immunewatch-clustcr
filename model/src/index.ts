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

    // Clamp engine params to their valid ranges (canonicalize so the staleness gate doesn't
    // fire on out-of-range edits the workflow would clamp anyway).
    const inflation = Math.min(5.0, Math.max(1.01, data.inflation));
    const consensusThreshold = Math.min(1, Math.max(0, data.consensusThreshold));

    return {
      defaultBlockLabel: data.defaultBlockLabel,
      customBlockLabel: data.customBlockLabel,
      datasetRef: data.datasetRef,
      inputSelection: sel,
      inflation,
      consensusThreshold,
      weightByAbundance: data.weightByAbundance,
      mem: data.mem,
      cpu: data.cpu,
    };
  })

  // Dataset picker: TCR clonotype datasets (bulk + single-cell). No peptide (variantKey).
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

    // Exclude this block's OWN exported cluster axis from the input picker.
    return options.filter((opt) => {
      const keyAxis = ctx.resultPool.getPColumnSpecByRef(opt.ref)?.axesSpec[1];
      return keyAxis?.domain?.["pl7.app/clustering/algorithm"] === undefined;
    });
  })

  // The single "Cluster by" dropdown. Options are generated from the dataset's Primary CDR3 aa
  // columns (labelled from MiXCR, "Primary" trimmed), each also offered "+ V gene" when the
  // dataset carries V-gene columns, plus "Paired (α + β)" for single-cell with both chains.
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
    if (isSingleCell) {
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

  // MSA p-frame (per-clonotype sequences + linker + distances) for the alignment viewer.
  .output("msaPf", (ctx): PFrameHandle | undefined => {
    const msaCols = ctx.outputs?.resolve("msaPf")?.getPColumns();
    if (!msaCols) return undefined;
    return createPFrameForGraphs(ctx, msaCols);
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

  .title(() => "TCR Clustering")

  .subtitle((ctx) => ctx.data.customBlockLabel || ctx.data.defaultBlockLabel)

  .sections((_ctx) => [
    { type: "link" as const, href: "/" as const, label: strings.titles.main },
    { type: "link" as const, href: "/bubble" as const, label: "Most Abundant Clusters" },
    { type: "link" as const, href: "/histogram" as const, label: "Cluster Size Histogram" },
  ])

  .done();
