---
"@platforma-open/immunewatch.immunewatch-clustcr": minor
"@platforma-open/immunewatch.immunewatch-clustcr.kind": minor
"@platforma-open/immunewatch.immunewatch-clustcr.model": minor
"@platforma-open/immunewatch.immunewatch-clustcr.ui": minor
"@platforma-open/immunewatch.immunewatch-clustcr.workflow": minor
---

Update the SDK and accept a subset filter (e.g. a Repertoire Labeling label or Lead Selection picks) with the dataset. The dataset list is built with buildDatasetOptions (requireEnrichments: false). The subset restricts the input before clustering, so only its clonotypes are clustered, and cluster abundance fractions are relative to the subset. Outputs of a subset run carry pl7.app/inputSubset in their domain and a trace rooted in the subset, so their labels name it. Unfiltered runs are unchanged.
