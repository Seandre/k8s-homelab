# Optional 05: Top500 HPL Benchmark Before OKD

This project compares the existing three k3s VMs with the three Ryzen systems before OKD overwrites the Ryzen disks. Its build and input model is based on [Jeff Geerling's `top500-benchmark`](https://github.com/geerlingguy/top500-benchmark), pinned to revision `e71588f33fcf358910047de25720e3147d627be4`. The homelab wrapper adds repeatable test matrices, temporary credentials, live-versus-isolated execution, recovery, validation, and result collection around that upstream base.

The common Ubuntu 26.04 stack uses MPICH 4.3.2, OpenBLAS 0.3.33, and Netlib HPL 2.3. It retains the upstream `/opt/top500` directory layout, MPICH launcher, OpenBLAS option, HPL makefile structure, hostfile format, and standard `HPL.dat` algorithm choices. The upstream MIT license and exact revision are kept in the role and installed with benchmark provenance.

Run it after temporary Ubuntu 26.04 is installed on `okd-cp-01` through `okd-cp-03`, but before generating or booting the destructive OKD installer ISO in [Build 04](../10-build/04-compact-okd.md). This project is optional; skipping it does not block OKD.

The Intel VM nodes and AMD bare-metal nodes use different CPUs. The result is a comparison of VM capability, bare-metal capability, per-core performance, live background-load impact, and group scaling. It is **not** a measurement of virtualization overhead.

## Safety Boundary

The `isolated` tag deliberately stops k3s and temporarily shuts down `utility-01`. It is guarded by all of these controls:

- it requires `-e hpl_allow_k3s_outage=true`;
- the Ansible controller hostname must not be `utility-01`;
- it records the original k3s service, utility VM, and Proxmox governor state;
- its `always` recovery removes temporary MPI keys, restores the governor and VM state, starts the k3s control plane before its agents, and waits for recovery;
- acceptance requires every Kubernetes node to be `Ready` and every Argo CD application to be `Synced` and `Healthy`.

Launch the isolated pass from the workstation. Keep a Proxmox console open as an independent recovery path. Do not run an untagged playbook invocation: because an untagged run selects every stage, the outage guard will stop it unless explicit approval is present.

## Inventory and Rank Policy

The inventory defines the benchmark groups and fixes one MPI rank per physical core or assigned vCPU:

| Target | Ranks | Process grid |
|---|---:|---:|
| `k8s-control-01` | 2 | `1 × 2` |
| `k8s-worker-01`, `k8s-worker-02` | 4 each | `2 × 2` |
| Each Ryzen node | 6 physical-core ranks | `2 × 3` |
| `benchmark_k3s` | 10 | `2 × 5` |
| `benchmark_baremetal` | 18 | `3 × 6` |

The standardized Ryzen comparison uses six physical cores. A separate 12-hardware-thread pilot on `okd-cp-01` records the effect of SMT without mixing it into the main comparison.

## Prerequisites

Install the same Ubuntu Server 26.04 release and updates on all six selected nodes. The temporary Ryzen installations use SSH user `sean` and these addresses:

| Host | Address |
|---|---:|
| `okd-cp-01` | `192.168.40.26` |
| `okd-cp-02` | `192.168.40.27` |
| `okd-cp-03` | `192.168.40.28` |

Before comparing results:

- align firmware, memory layout, SMT, and firmware power settings across the Ryzen systems;
- confirm each inventory address and SSH host identity;
- confirm `sudo` access from the workstation;
- update all six Ubuntu nodes from the same repositories;
- ensure `pve-01` and `utility-01` remain reachable from the workstation.

Use a stable identifier across related stages:

```bash
cd ~/Developer/homelab
export HPL_RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ansible-inventory --graph
ansible benchmark_all -m ping
```

If the Ryzen nodes are not ready yet, the k3s-only preparation limit must include localhost so the initialization play still runs:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags prepare \
  --limit 'localhost:benchmark_k3s' \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

## Prepare the Pinned Top500 Stack

For the complete comparison, prepare all six nodes:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags prepare \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

The role ports the upstream setup into an idempotent role so the homelab playbook can retain its `prepare`, `smoke`, `live`, `isolated`, `collect`, and `cleanup` interfaces. It then:

- records the upstream repository and pinned revision in `/opt/top500/share/build-inputs.json`;
- downloads MPICH `4.3.2` and verifies SHA-256 `47d774587a7156a53752218c811c852e70ac44db9c502dc3f399b4cb817e3818`;
- checks out OpenBLAS `0.3.33` at commit `62bcfb0dc9f1cfa685fc04135c50e2780c303137` instead of the upstream example's moving `develop` branch;
- downloads Netlib HPL `2.3` and verifies SHA-256 `32c5c17d22330e6f2337b681aded51637fb6008d3f0eb7c277b163fadd612830`;
- requires identical GCC, G++, GFortran, libc, make, and hwloc package versions across the selected Ubuntu nodes;
- verifies that every node, including each VM CPU model, exposes the x86-64-v3 feature level;
- builds MPICH, OpenBLAS, and HPL with the upstream layout under `/opt/top500`, using `-O3` and `-march=x86-64-v3` for the common target;
- creates the locked system account `hplbench` and runs HPL without root privileges;
- forces `OPENBLAS_NUM_THREADS=1` and asks MPICH/Hydra to bind every MPI rank to one core or vCPU;
- installs hardware, thermal, load, swap, network, and package diagnostics.

Preparation is idempotent. Re-running it verifies source identity and converges packages, directories, account state, build configuration, attribution, and helper scripts. The workflow intentionally does not invoke the upstream `ssh` play: it creates per-run credentials for distributed tests and removes them in `always` cleanup instead of leaving cluster-wide keys in place.

## Benchmark Matrix

The playbook uses standard HPL algorithm choices and the process-grid shape recommended by [Netlib's HPL guidance](https://www.netlib.org/benchmark/hpl/faqs.html): keep `P × Q` equal to the MPI rank count, with `Q` at least `P` and the grid reasonably square.

| Stage | Configuration |
|---|---|
| Correctness smoke | `N=7680`, `NB=192`, one run per node |
| Block-size characterization | `N=15360`, `NB=128,192,256` on one node per CPU family |
| Standard per-node | `N=21504`, `NB=192` |
| Standard distributed group | `N=43008`, `NB=192` |
| Tuned capacity | Best median `NB` per CPU family; `N` is 75% of memory rounded down to an `NB` multiple |
| Live k3s | Sequential per-node runs; one warm-up plus three measured runs |
| Isolated | Per-node and group runs; one warm-up plus five measured runs |

When a measured set has a coefficient of variation above 3%, the runner automatically adds two measured runs. It marks the set invalid if variation remains above 3%.

## Run the Correctness Smoke Test

Run this before any performance pass:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags smoke \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

For a k3s-only smoke test while the temporary Ryzen installations are unavailable:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags smoke \
  --limit 'localhost:benchmark_k3s' \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

Every HPL residual must pass and MPICH/Hydra must emit a nonempty CPU-binding bitmap for every rank. Swap activity, OOM events, thermal-throttle events, missing output, or an invalid residual fails the case.

## Run the Live k3s Baseline

The live pass measures intentional workload contention. It does not stop Kubernetes or `utility-01`, and it runs only one k3s node at a time:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags live \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

Before and after each node, Ansible captures nodes, pods, and Argo CD state. After every node's HPL run, all Kubernetes nodes must still report `Ready`.

## Run the Isolated Peak Matrix

Choose a maintenance window and run this command from the workstation:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags isolated \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  -e hpl_allow_k3s_outage=true \
  --ask-become-pass
```

The isolated stage performs this sequence:

1. Capture cluster, workload, VM, temperature, governor, memory, load, and swap state.
2. Preserve the Proxmox CPU governor and set it to `performance`.
3. Shut down `utility-01` only if it was initially running.
4. Stop k3s agents, then the k3s control plane.
5. Characterize `NB`, run standard and memory-capacity node cases, and run the Ryzen SMT pilot.
6. Record ordered pairwise ping latency and `iperf3` throughput inside each three-node group.
7. Generate per-run coordinator SSH keys, authorize them only for `hplbench`, run distributed cases, and remove the credentials.
8. Restore the governor, utility VM state, k3s control plane, and agents.
9. Require Kubernetes and Argo CD recovery, capture final state, collect results, and only then return a benchmark or recovery failure.

HPL uses Ansible asynchronous execution with a positive 30-second poll interval and a four-hour timeout. It does not use fire-and-forget execution; this follows [Ansible's asynchronous task guidance](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_async.html).

## Results and Validation

Each execution stage automatically collects available results. To recollect an existing run explicitly:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags collect \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

Results land under the ignored directory:

```text
benchmark-results/<run-id>/
├── raw/
│   ├── k8s-control-01/
│   ├── k8s-worker-01/
│   ├── ...
│   └── pve-01/
├── summary.csv
└── summary.md
```

Raw content includes HPL input and output, MPICH/Hydra bindings, pinned source identities, the derived makefile, package versions, CPU and memory facts, load and swap samples, sensor readings, kernel events, cluster/workload state, Proxmox state, pairwise network measurements, and recovery checks. `summary.csv` and `summary.md` identify the pinned `top500-benchmark` revision and MPI implementation, then contain only inventory labels and aggregate performance fields: GFLOPS, GFLOPS per physical core or assigned vCPU, median, minimum, maximum, coefficient of variation, residual status, validity, live background-load impact, and distributed scaling efficiency.

Distributed scaling efficiency is the group standard median divided by the sum of the matching isolated per-node standard medians. Keep these interpretations separate:

- live versus isolated on the same VM estimates background-load impact;
- GFLOPS per physical core (or assigned vCPU for the VMs) compares the assigned compute capacity more clearly than totals alone;
- distributed efficiency describes MPI and network scaling;
- VM and Ryzen totals describe the capability of different systems, not virtualization overhead.

A run is invalid if HPL fails its residual check, swap moves, an OOM or thermal-throttle event is observed, CPU binding is missing, variation remains high, a live pass leaves a node non-Ready, or isolated recovery fails its Kubernetes/API/Argo CD acceptance checks.

## Cleanup and the OKD Gate

The isolated `always` block removes its own temporary SSH credentials. The explicit cleanup tag removes stale HPL key files and temporary archives left by an interrupted controller session; it preserves installed software and benchmark results:

```bash
ansible-playbook ansible/playbooks/hpl-benchmark.yml \
  --tags cleanup \
  -e "hpl_run_id=${HPL_RUN_ID}" \
  --ask-become-pass
```

Do not proceed to the OKD installer until:

- every intended smoke, live, and isolated result has been collected;
- all invalid results are explained or rerun;
- all k3s nodes are `Ready` and all Argo CD applications are `Synced` and `Healthy`;
- `utility-01` and the Proxmox governor match their original state;
- the raw result directory has been backed up outside the temporary Ryzen installations.

After those checks, Build 04 may overwrite the Ryzen disks. The results remain local and ignored by Git unless a deliberately sanitized report is copied elsewhere for publication.
