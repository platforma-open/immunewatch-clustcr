---
"@platforma-open/immunewatch.immunewatch-clustcr.ui": patch
"@platforma-open/immunewatch.immunewatch-clustcr.workflow": patch
---

Test the trace label and keep the subtitle updating

The trace label moves into its own workflow library with unit tests run by `pl-tengo test`; the label itself is unchanged. The subtitle no longer stays frozen when the chosen "Cluster by" option leaves the loaded options: it waits only while the options load, and otherwise drops the option that is gone.
