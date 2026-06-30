# Overview

Groups TCR clonotypes by likely shared antigen specificity, enabling researchers to identify T cells that may recognize the same antigen. Specificity is driven mostly by the central CDR3 loop, so the block uses **clusTCR** to cluster on the **CDR3 amino-acid** sequence: it builds a similarity network of same-length sequences within one substitution (Hamming distance ≤ 1) and partitions it with Markov clustering (MCL). Clustering runs on a single chain (β or α), optionally restricted to the same V gene family, or on paired α + β chains together for single-cell data, and results include a cluster assignment for each clonotype along with cluster-level statistics — a representative sequence, consensus centroid, distance-to-centroid, and cluster radius — visualized using bubble plots and histograms.

The clustered data can be used in downstream analysis blocks such as Sequence Enrichment to analyze enrichment patterns at the cluster level across selection rounds, or Lead Selection to identify top candidates based on cluster-level scoring metrics.

clusTCR is developed by the Meysman lab (ADReM Data Lab, University of Antwerp). For more information, please see: [https://github.com/svalkiers/clustcr](https://github.com/svalkiers/clustcr) and cite the following publication if used in your research:

> Sebastiaan Valkiers, Max Van Houcke, Kris Laukens, Pieter Meysman. clusTCR: a Python interface for rapid clustering of large sets of CDR3 sequences with unknown antigen specificity. _Bioinformatics_ 2021; btab446. [https://doi.org/10.1093/bioinformatics/btab446](https://doi.org/10.1093/bioinformatics/btab446)
