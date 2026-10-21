// Author-owned. `block-tools structure` does not modify this file.
// Add block-specific helper types or values the consumer surface
// should expose. Anything you `export` here flows out via the
// main entry (./index re-exports this file).
//
// Do NOT redefine: BlockContract, BlockOutputs, BlockData,
// BlockPointer, platforma, or the block-named <PascalName>Block*
// aliases — those names come from ./index and `export *` from this
// file would shadow them.

// Names this package exported before the structurer renamed its aliases; kept so existing imports build.
// A re-export, not a `const`: ./index re-exports this file, so reading BlockPointer here would run first.
import type { BlockContract, BlockData, BlockOutputs } from "./index";
/** @deprecated Use ImmunewatchClustcrBlockContract. */
export type TcrClusteringClustcrBlockContract = BlockContract;
/** @deprecated Use ImmunewatchClustcrBlockOutputs. */
export type TcrClusteringClustcrBlockOutputs = BlockOutputs;
/** @deprecated Use ImmunewatchClustcrBlockData. */
export type TcrClusteringClustcrBlockData = BlockData;
/** @deprecated Use ImmunewatchClustcrBlockPointer. */
export { BlockPointer as TcrClusteringClustcrBlockPointer } from "./index";
