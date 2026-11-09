# Changelog

## 1.2.3

### Patch Changes

- 3bb9698: Test the trace label and keep the subtitle updating

  The trace label moves into its own workflow library with unit tests run by `pl-tengo test`; the label itself is unchanged. The subtitle no longer stays frozen when the chosen "Cluster by" option leaves the loaded options: it waits only while the options load, and otherwise drops the option that is gone.

  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.2.3

## 1.2.2

### Patch Changes

- 8297416: Compute the block label without the UI

  The trace label is now built by the workflow from the native label of the chosen CDR3 column
  plus the inflation, so opening the block no longer changes its arguments and a block that was
  never opened still gets a meaningful label. The subtitle shows the result-pool label of the
  chosen "Cluster by" option, kept in sync with the result pool while the block is open.
  Existing blocks show stale once after the update. The init-params contract no longer carries
  `defaultBlockLabel`; templates that still contain it keep loading.

- Updated dependencies [8297416]
  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.2.2

## 1.2.1

### Patch Changes

- @platforma-open/immunewatch.immunewatch-clustcr.model@1.2.1

## 1.2.0

### Minor Changes

- 05f9d08: Update the SDK and accept a subset filter (e.g. a Repertoire Labeling label or Lead Selection picks) with the dataset. The dataset list is built with buildDatasetOptions (requireEnrichments: false). The subset restricts the input before clustering, so only its clonotypes are clustered, and cluster abundance fractions are relative to the subset. Outputs of a subset run carry pl7.app/inputSubset in their domain and a trace rooted in the subset, so their labels name it. Unfiltered runs are unchanged.

### Patch Changes

- Updated dependencies [05f9d08]
  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.2.0

## 1.1.1

### Patch Changes

- 1fd1305: Release every package through npm trusted publishing (OIDC) so each package's trusted publisher is used before it expires.
- Updated dependencies [1fd1305]
  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.1.1

## 1.1.0

### Minor Changes

- 3a24a35: Rename every package to the `@platforma-open/immunewatch.immunewatch-clustcr` namespace and add the ImmuneWatch licensing and legal notice to the block description.

### Patch Changes

- Updated dependencies [3a24a35]
  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.1.0

## 1.0.1

### Patch Changes

- Updated dependencies [342e909]
  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.0.1

## 1.0.0

### Major Changes

- f4a6017: First release of the ImmuneWatch ClusTCR block.

  Clusters TCR CDR3 sequences with ClusTCR (CDR3 Hamming network + MCL, optionally restricted to
  the same V gene family), then computes per-cluster statistics: representative sequence, consensus
  centroid, distance to centroid and cluster radius, with bubble plots and histograms.

  - Runs ClusTCR from the `immunewatch-clustcr` PyPI package on the `runenv-python-3:3.10.21-clustcr`
    variant.

### Patch Changes

- Updated dependencies [f4a6017]
  - @platforma-open/immunewatch.immunewatch-clustcr.model@1.0.0

Initial version.
