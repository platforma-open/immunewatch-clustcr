# @platforma-open/immunewatch.immunewatch-clustcr.kind

## 1.1.0

### Minor Changes

- 3a24a35: Rename every package to the `@platforma-open/immunewatch.immunewatch-clustcr` namespace and add the ImmuneWatch licensing and legal notice to the block description.

## 1.0.0

### Major Changes

- f4a6017: First release of the ImmuneWatch ClusTCR block.

  Clusters TCR CDR3 sequences with ClusTCR (CDR3 Hamming network + MCL, optionally restricted to
  the same V gene family), then computes per-cluster statistics: representative sequence, consensus
  centroid, distance to centroid and cluster radius, with bubble plots and histograms.

  - Runs ClusTCR from the `immunewatch-clustcr` PyPI package on the `runenv-python-3:3.10.21-clustcr`
    variant.
