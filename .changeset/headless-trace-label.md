---
"@platforma-open/immunewatch.immunewatch-clustcr.kind": minor
"@platforma-open/immunewatch.immunewatch-clustcr.model": patch
"@platforma-open/immunewatch.immunewatch-clustcr.ui": patch
"@platforma-open/immunewatch.immunewatch-clustcr.workflow": patch
---

Compute the block label without the UI

The trace label is now built by the workflow from the native label of the chosen CDR3 column
plus the inflation, so opening the block no longer changes its arguments and a block that was
never opened still gets a meaningful label. The subtitle shows the result-pool label of the
chosen "Cluster by" option, kept in sync with the result pool while the block is open.
Existing blocks show stale once after the update. The init-params contract no longer carries
`defaultBlockLabel`; templates that still contain it keep loading.
