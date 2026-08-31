import { assertParamsObject, defineBlockKind } from "@platforma-sdk/block-kind";
import type { PlRef, SUniversalPColumnId } from "@platforma-sdk/model";
import { isColumnUniversalId, isPlRef } from "@platforma-sdk/model";
import { isBoolean, isPlainObject, isString } from "es-toolkit";
import { isNumber } from "es-toolkit/compat";
import { name, version } from "../package.json" with { type: "json" };

/**
 * The "Cluster by" selection, snapshotted from the chosen dropdown option (the model.md
 * snapshot pattern: `.args` is data-only, but the option refs come from the result pool, so
 * the UI writes the resolved selection into `data` on the user's dropdown gesture).
 * `single` clusters one CDR3 chain (β or α — the chain is whichever column `sequenceRef`
 * points at); `paired` concatenates β+α.
 *
 * Declared here rather than in the model because the params contract carries it, and a
 * contract cannot reference a type the kind does not own; the model re-exports it.
 */
export type InputSelection =
  | {
      mode: "single";
      sequenceRef: SUniversalPColumnId;
      useVGene: boolean;
      vGeneRef?: SUniversalPColumnId; // resolved V-gene column for the chosen chain (only when useVGene)
    }
  | { mode: "paired"; betaRef: SUniversalPColumnId; alphaRef: SUniversalPColumnId };

/**
 * This block's init-params contract — what a creator or a project template supplies to seed a
 * new instance: the input it points at, the analysis recipe, and the user's own label.
 *
 * Excluded on purpose:
 *   * `tableState`, `alignmentModel`, `graphStateBubble`, `graphStateHistogram` — view state.
 *   * `mem` / `cpu` — resource allocation belongs to the machine a block runs on, not to
 *     configuration a template carries between machines.
 *
 * Every field is optional: a block may be created without a template, and a template need not
 * set all of them.
 */
export type BlockParams = {
  defaultBlockLabel?: string;
  customBlockLabel?: string;
  /** The clustered dataset. `inputSelection`'s ids are anchored to it, so the two travel together. */
  datasetRef?: PlRef;
  inputSelection?: InputSelection;
  inflation?: number;
  consensusThreshold?: number;
  weightByAbundance?: boolean;
};

type Guard<T> = (v: unknown) => v is T;
type Check<T> = { is: Guard<T>; must: string };

function check<T>(is: Guard<T>, must: string): Check<T> {
  return { is, must };
}

/**
 * `mode` selects which refs are required — a selection missing them would land as a block that
 * cannot resolve what to cluster. The UI writes the whole selection in one gesture, so a
 * half-filled one is not a state the block can reach.
 */
const isInputSelection: Guard<InputSelection> = (v): v is InputSelection => {
  if (!isPlainObject(v)) return false;
  if (v.mode === "single") {
    return (
      isColumnUniversalId(v.sequenceRef) &&
      isBoolean(v.useVGene) &&
      (v.vGeneRef === undefined || isColumnUniversalId(v.vGeneRef))
    );
  }
  if (v.mode === "paired") return isColumnUniversalId(v.betaRef) && isColumnUniversalId(v.alphaRef);
  return false;
};

/**
 * The runtime half of the contract. The `satisfies` clause is what stops it drifting: every
 * field `BlockParams` declares must appear here, and each guard must narrow to that field's own
 * type — so adding a param without a check stops compiling.
 *
 * `inflation` and `consensusThreshold` are checked as numbers and NOT against the ranges the
 * model enforces (1.01–5.0 and 0–1).
 */
const CONTRACT = {
  defaultBlockLabel: check(isString, "a string"),
  customBlockLabel: check(isString, "a string"),
  datasetRef: check(isPlRef, "a reference to an input dataset"),
  inputSelection: check(
    isInputSelection,
    'either {mode: "single", sequenceRef, useVGene} or {mode: "paired", betaRef, alphaRef}, with sequence column identifiers',
  ),
  inflation: check(isNumber, "a number"),
  consensusThreshold: check(isNumber, "a number"),
  weightByAbundance: check(isBoolean, "a boolean"),
} satisfies { [K in keyof Required<BlockParams>]: Check<NonNullable<BlockParams[K]>> };

/**
 * The contract at runtime, for params arriving from a template file rather than typed code. An
 * absent field is always allowed — every param is optional and the block's own default takes
 * over — so each guard runs only on what is present. Keys the contract does not name are dropped
 * by never being read.
 */
function parseInitializationParams(value: unknown): BlockParams {
  assertParamsObject(value);

  const params: Record<string, unknown> = {};
  for (const [field, { is, must }] of Object.entries(CONTRACT)) {
    const v = value[field];
    if (v === undefined) continue;
    if (!is(v)) throw new Error(`'${field}' must be ${must}.`);
    params[field] = v;
  }
  return params as BlockParams;
}

// Identity (`name`/`version`) comes from this package's own `package.json`, so the on-wire
// `{name}@{version}` reference can never drift from what npm publishes; the bundler inlines the
// JSON import.
export const kind = defineBlockKind<BlockParams>({
  name,
  version,
  parseInitializationParams,
});
