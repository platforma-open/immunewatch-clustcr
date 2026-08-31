---
'@platforma-open/milaboratories.tcr-clustering-clusttcr.kind': major
'@platforma-open/milaboratories.tcr-clustering-clusttcr.model': major
'@platforma-open/milaboratories.tcr-clustering-clusttcr.ui': major
'@platforma-open/milaboratories.tcr-clustering-clusttcr.workflow': major
'@platforma-open/milaboratories.tcr-clustering-clusttcr.software': major
'@platforma-open/milaboratories.tcr-clustering-clusttcr': major
---

First release of the ImmuneWatch ClusTCR block.

Clusters TCR CDR3 sequences with ClusTCR (CDR3 Hamming network + MCL, optionally restricted to
the same V gene family), then computes per-cluster statistics: representative sequence, consensus
centroid, distance to centroid and cluster radius, with bubble plots and histograms.

- Runs ClusTCR from the `immunewatch-clustcr` PyPI package on the `runenv-python-3:3.10.21-clustcr`
  variant.
