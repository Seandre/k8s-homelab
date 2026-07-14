#!/usr/bin/env python3
"""Run a top500-benchmark-derived HPL stack and validate each result."""

from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
import re
import statistics
import subprocess
import sys
from typing import Any


RESULT_ROW = re.compile(r"^(?:WR|WC|TR|TC)\S*\s+")
HYDRA_BINDING = re.compile(r"process\s+(\d+)\s+binding:\s+([01]+)", re.IGNORECASE)


def hpl_dat(n: int, nb: int, p: int, q: int) -> str:
    return f"""HPLinpack benchmark input file
Innovative Computing Laboratory, University of Tennessee
HPL.out      output file name (if any)
6            device out (6=stdout,7=stderr,file)
1            # of problems sizes (N)
{n}          Ns
1            # of NBs
{nb}         NBs
0            PMAP process mapping (0=Row-,1=Column-major)
1            # of process grids (P x Q)
{p}          Ps
{q}          Qs
16.0         threshold
1            # of panel fact
2            PFACTs (0=left, 1=Crout, 2=Right)
1            # of recursive stopping criterium
4            NBMINs (>= 1)
1            # of panels in recursion
2            NDIVs
1            # of recursive panel fact.
1            RFACTs (0=left, 1=Crout, 2=Right)
1            # of broadcast
1            BCASTs (0=1rg,1=1rM,2=2rg,3=2rM,4=Lng,5=LnM)
1            # of lookahead depth
1            DEPTHs (>=0)
2            SWAP (0=bin-exch,1=long,2=mix)
64           swapping threshold
0            L1 in (0=transposed,1=no-transposed) form
0            U  in (0=transposed,1=no-transposed) form
1            Equilibration (0=no,1=yes)
8            memory alignment in double (> 0)
##### This line (no. 32) is ignored (it serves as a separator). ######
0            Number of additional problem sizes for PTRANS
1200 10000 30000 values of N
0            number of additional blocking sizes for PTRANS
40 9 8 13 13 20 16 32 64 values of NB
"""


def swap_counters() -> dict[str, int]:
    counters: dict[str, int] = {}
    for line in Path("/proc/vmstat").read_text(encoding="utf-8").splitlines():
        name, value = line.split()
        if name in {"pswpin", "pswpout"}:
            counters[name] = int(value)
    return counters


def throttle_counters() -> dict[str, int]:
    counters: dict[str, int] = {}
    root = Path("/sys/devices/system/cpu")
    for path in root.glob("cpu*/thermal_throttle/*_throttle_count"):
        try:
            counters[str(path)] = int(path.read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            continue
    return counters


def positive_deltas(before: dict[str, int], after: dict[str, int]) -> dict[str, int]:
    return {
        key: after[key] - before.get(key, after[key])
        for key in after
        if after[key] > before.get(key, after[key])
    }


def parse_hpl_output(text: str) -> tuple[float | None, bool, list[dict[str, Any]]]:
    gflops: float | None = None
    for line in text.splitlines():
        stripped = line.strip()
        if not RESULT_ROW.match(stripped):
            continue
        fields = stripped.split()
        try:
            gflops = float(fields[-1])
        except (IndexError, ValueError):
            continue
    residual_passed = bool(re.search(r"\bPASSED\b", text))
    bindings = [
        {"process": int(process), "bitmap": bitmap}
        for process, bitmap in HYDRA_BINDING.findall(text)
    ]
    return gflops, residual_passed, bindings


def mpi_command(args: argparse.Namespace) -> list[str]:
    command = [
        args.mpirun,
        "-n",
        str(args.ranks),
        "-genv",
        "OPENBLAS_NUM_THREADS",
        "1",
        "-genv",
        "OMP_NUM_THREADS",
        "1",
    ]
    if args.hostfile:
        command += ["-f", args.hostfile]
    if args.binding == "hwthread":
        command += ["-bind-to", "hwthread", "-map-by", "hwthread"]
    else:
        command += ["-bind-to", "core", "-map-by", "core"]
    command.append(args.xhpl)
    return command


def run_once(args: argparse.Namespace, name: str) -> dict[str, Any]:
    before_swap = swap_counters()
    before_throttle = throttle_counters()
    environment = os.environ.copy()
    environment.update(
        {
            "HYDRA_TOPO_DEBUG": "1",
            "OPENBLAS_NUM_THREADS": "1",
            "OMP_NUM_THREADS": "1",
        }
    )
    completed = subprocess.run(
        mpi_command(args),
        cwd=args.output_dir,
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    text = completed.stdout
    Path(args.output_dir, f"{name}.log").write_text(text, encoding="utf-8")
    after_swap = swap_counters()
    after_throttle = throttle_counters()
    gflops, residual_passed, bindings = parse_hpl_output(text)
    result = {
        "name": name,
        "return_code": completed.returncode,
        "gflops": gflops,
        "residual_passed": residual_passed,
        "bindings": bindings,
        "swap_delta": positive_deltas(before_swap, after_swap),
        "thermal_throttle_delta": positive_deltas(before_throttle, after_throttle),
    }
    Path(args.output_dir, f"{name}.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return result


def invalid_reasons(result: dict[str, Any], expected_ranks: int) -> list[str]:
    reasons: list[str] = []
    if result["return_code"] != 0:
        reasons.append(f"MPI/HPL exited {result['return_code']}")
    if result["gflops"] is None:
        reasons.append("HPL did not emit a GFLOPS result row")
    if not result["residual_passed"]:
        reasons.append("HPL residual check failed or was absent")
    bindings = result["bindings"]
    if len(bindings) != expected_ranks or any(
        "1" not in item["bitmap"] for item in bindings
    ):
        reasons.append("MPICH/Hydra did not report a nonempty binding for every rank")
    if result["swap_delta"]:
        reasons.append(f"swap activity detected: {result['swap_delta']}")
    if result["thermal_throttle_delta"]:
        reasons.append(
            f"thermal throttling detected: {result['thermal_throttle_delta']}"
        )
    return reasons


def coefficient_of_variation(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = statistics.fmean(values)
    return statistics.pstdev(values) / mean * 100.0 if mean else math.inf


def write_summary(
    args: argparse.Namespace,
    warmups: list[dict[str, Any]],
    measured: list[dict[str, Any]],
    reasons: list[str],
) -> dict[str, Any]:
    values = [float(item["gflops"]) for item in measured if item["gflops"] is not None]
    summary: dict[str, Any] = {
        "schema_version": 2,
        "benchmark_basis": "geerlingguy/top500-benchmark",
        "top500_revision": args.top500_revision,
        "mpi_implementation": "MPICH/Hydra",
        "run_id": args.run_id,
        "label": args.label,
        "stage": args.stage,
        "comparison": args.comparison,
        "target": args.target,
        "cpu_family": args.cpu_family,
        "members": [member for member in args.members.split(",") if member],
        "distributed": bool(args.hostfile),
        "n": args.n,
        "nb": args.nb,
        "p": args.p,
        "q": args.q,
        "ranks": args.ranks,
        "core_count": args.core_count,
        "binding": args.binding,
        "warmup_runs": len(warmups),
        "measured_runs": len(measured),
        "gflops": values,
        "median_gflops": statistics.median(values) if values else None,
        "min_gflops": min(values) if values else None,
        "max_gflops": max(values) if values else None,
        "coefficient_of_variation_percent": coefficient_of_variation(values),
        "residual_status": (
            "PASS"
            if measured and all(item["residual_passed"] for item in measured)
            else "FAIL"
        ),
        "valid": not reasons,
        "invalid_reasons": reasons,
    }
    Path(args.output_dir, "summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return summary


def run_command(args: argparse.Namespace) -> int:
    if args.p * args.q != args.ranks:
        raise SystemExit("P x Q must equal the MPI rank count")
    if args.n % args.nb:
        raise SystemExit("N must be an exact NB multiple")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "HPL.dat").write_text(
        hpl_dat(args.n, args.nb, args.p, args.q), encoding="utf-8"
    )
    (output_dir / "command.json").write_text(
        json.dumps({"argv": mpi_command(args)}, indent=2) + "\n", encoding="utf-8"
    )

    warmups: list[dict[str, Any]] = []
    measured: list[dict[str, Any]] = []
    reasons: list[str] = []
    for index in range(1, args.warmups + 1):
        result = run_once(args, f"warmup-{index:02d}")
        warmups.append(result)
        reasons.extend(
            f"warmup {index}: {reason}"
            for reason in invalid_reasons(result, args.ranks)
        )
        if reasons:
            write_summary(args, warmups, measured, reasons)
            return 2

    for index in range(1, args.runs + 1):
        result = run_once(args, f"measured-{index:02d}")
        measured.append(result)
        reasons.extend(
            f"measured {index}: {reason}"
            for reason in invalid_reasons(result, args.ranks)
        )
        if reasons:
            write_summary(args, warmups, measured, reasons)
            return 2

    extra_runs = 0
    while (
        coefficient_of_variation([float(item["gflops"]) for item in measured])
        > args.cov_limit_percent
        and extra_runs < args.max_extra_runs
    ):
        index = len(measured) + 1
        result = run_once(args, f"measured-{index:02d}")
        measured.append(result)
        extra_runs += 1
        reasons.extend(
            f"measured {index}: {reason}"
            for reason in invalid_reasons(result, args.ranks)
        )
        if reasons:
            write_summary(args, warmups, measured, reasons)
            return 2

    values = [float(item["gflops"]) for item in measured]
    cov = coefficient_of_variation(values)
    if cov > args.cov_limit_percent:
        reasons.append(
            f"coefficient of variation {cov:.3f}% remains above {args.cov_limit_percent:.3f}%"
        )
    summary = write_summary(args, warmups, measured, reasons)
    print(json.dumps(summary, sort_keys=True))
    return 0 if summary["valid"] else 2


def select_nb_command(args: argparse.Namespace) -> int:
    candidates: list[tuple[float, int]] = []
    for summary_path in Path(args.result_dir).glob("characterization-nb*/summary.json"):
        summary = json.loads(summary_path.read_text(encoding="utf-8"))
        if summary.get("valid") and summary.get("median_gflops") is not None:
            candidates.append((float(summary["median_gflops"]), int(summary["nb"])))
    if not candidates:
        print("no valid block-size characterization results", file=sys.stderr)
        return 2
    candidates.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    print(candidates[0][1])
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    subcommands = root.add_subparsers(dest="command", required=True)
    run = subcommands.add_parser("run")
    run.add_argument("--xhpl", required=True)
    run.add_argument("--mpirun", required=True)
    run.add_argument("--output-dir", required=True)
    run.add_argument("--run-id", required=True)
    run.add_argument("--top500-revision", required=True)
    run.add_argument("--label", required=True)
    run.add_argument("--stage", required=True)
    run.add_argument("--comparison", default="none")
    run.add_argument("--target", required=True)
    run.add_argument("--cpu-family", required=True)
    run.add_argument("--n", type=int, required=True)
    run.add_argument("--nb", type=int, required=True)
    run.add_argument("--p", type=int, required=True)
    run.add_argument("--q", type=int, required=True)
    run.add_argument("--ranks", type=int, required=True)
    run.add_argument("--core-count", type=int, required=True)
    run.add_argument("--warmups", type=int, default=0)
    run.add_argument("--runs", type=int, default=1)
    run.add_argument("--max-extra-runs", type=int, default=2)
    run.add_argument("--cov-limit-percent", type=float, default=3.0)
    run.add_argument("--binding", choices=("core", "hwthread"), default="core")
    run.add_argument("--hostfile", default="")
    run.add_argument("--members", default="")
    select = subcommands.add_parser("select-nb")
    select.add_argument("--result-dir", required=True)
    return root


def main() -> int:
    args = parser().parse_args()
    if args.command == "run":
        return run_command(args)
    return select_nb_command(args)


if __name__ == "__main__":
    raise SystemExit(main())
