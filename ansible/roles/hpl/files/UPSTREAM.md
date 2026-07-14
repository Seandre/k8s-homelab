# Upstream benchmark basis

This role is derived from `geerlingguy/top500-benchmark`:

- repository: <https://github.com/geerlingguy/top500-benchmark>
- pinned revision: `e71588f33fcf358910047de25720e3147d627be4`
- license: MIT; see `top500-benchmark-LICENSE`

The upstream MPICH, selectable BLAS, HPL makefile, hostfile, and `HPL.dat`
approach are retained. This role pins source revisions and checksums, uses
OpenBLAS, fixes a common x86-64-v3 HPL target, runs under a locked account,
and adds the homelab test matrix, validation, recovery, and result collection.
