# clusTCR runner image: a micromamba environment (/env) with clustcr + faiss-cpu, and the runner
# script baked at /app/run_clustcr.py. Built + published by CI to the block docker registry
# (containers.pl-open.science). Consumed as a docker-only software by the clustering step — there
# is no local/binary fallback, so it requires docker at runtime (k8s, or build:dev-remote locally).
#
# NOTE: verify the base-image tag on the first `build:dev-remote` — mambaorg/micromamba tags track
# micromamba releases; adjust if `2.3.2-0` is not present.
FROM mambaorg/micromamba:2.3.2-0
USER root

# Build the clusTCR environment at /env from the conda spec (same deps as support/software-conda).
COPY conda-spec.yaml /tmp/conda-spec.yaml
RUN micromamba env create -y -p /env -f /tmp/conda-spec.yaml \
    && micromamba clean --all --yes \
    && rm /tmp/conda-spec.yaml

# Bake the runner script.
COPY run_clustcr.py /app/run_clustcr.py

# Clear the base image's activation entrypoint; the workflow supplies the full command
# (`micromamba run -p /env python /app/run_clustcr.py <args>`).
ENTRYPOINT []
CMD ["micromamba", "run", "-p", "/env", "python", "/app/run_clustcr.py"]
