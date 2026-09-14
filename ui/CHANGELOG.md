# Changelog

## 1.0.1

### Patch Changes

- Updated dependencies [342e909]
  - @platforma-open/milaboratories.tcr-clustering-clustcr.model@1.0.1

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
  - @platforma-open/milaboratories.tcr-clustering-clustcr.model@1.0.0

Initial version.
