#!/usr/bin/env python3
"""Create sanitized CSV and Markdown summaries from fetched HPL result trees."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


CSV_FIELDS = [
    "run_id",
    "benchmark_basis",
    "top500_revision",
    "mpi_implementation",
    "stage",
    "comparison",
    "target",
    "cpu_family",
    "ranks",
    "n",
    "nb",
    "median_gflops",
    "gflops_per_core",
    "min_gflops",
    "max_gflops",
    "coefficient_of_variation_percent",
    "residual_status",
    "valid",
    "live_background_load_impact_percent",
    "distributed_scaling_efficiency_percent",
    "notes",
]


def read_summaries(root: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    run_validation_path = root / "run-validation.json"
    if not run_validation_path.exists():
        run_validation_path = next(
            root.glob("raw/**/run-validation.json"), run_validation_path
        )
    run_validation: dict[str, Any] = {"valid": True, "invalid_reasons": []}
    if run_validation_path.exists():
        try:
            run_validation = json.loads(run_validation_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise SystemExit(f"cannot parse {run_validation_path}: {error}") from error
    for path in root.glob("raw/**/summary.json"):
        try:
            row = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise SystemExit(f"cannot parse {path}: {error}") from error
        validation_path = path.parent / "validation.json"
        if validation_path.exists():
            try:
                validation = json.loads(validation_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                raise SystemExit(f"cannot parse {validation_path}: {error}") from error
            if not validation.get("valid", False):
                row["valid"] = False
                row.setdefault("invalid_reasons", []).extend(
                    validation.get("invalid_reasons", [])
                )
        if str(row.get("stage", "")).startswith("isolated") and not run_validation.get(
            "valid", False
        ):
            row["valid"] = False
            row.setdefault("invalid_reasons", []).extend(
                run_validation.get("invalid_reasons", [])
            )
        row["_path"] = str(path.relative_to(root))
        rows.append(row)
    return rows


def add_scaling(rows: list[dict[str, Any]]) -> None:
    standard_nodes = {
        row["target"]: float(row["median_gflops"])
        for row in rows
        if not row.get("distributed")
        and row.get("comparison") == "standard"
        and row.get("stage") == "isolated-node"
        and row.get("valid")
        and row.get("median_gflops") is not None
    }
    for row in rows:
        row["live_background_load_impact_percent"] = None
        row["distributed_scaling_efficiency_percent"] = None
        if (
            row.get("stage") == "live-node"
            and row.get("comparison") == "standard"
            and row.get("valid")
            and row.get("median_gflops") is not None
            and row.get("target") in standard_nodes
        ):
            isolated = standard_nodes[row["target"]]
            row["live_background_load_impact_percent"] = (
                (isolated - float(row["median_gflops"])) / isolated * 100.0
                if isolated
                else None
            )
        if not row.get("distributed") or row.get("comparison") != "standard":
            continue
        members = row.get("members", [])
        denominator = sum(standard_nodes.get(member, 0.0) for member in members)
        if denominator and len(members) == sum(
            member in standard_nodes for member in members
        ):
            row["distributed_scaling_efficiency_percent"] = (
                float(row["median_gflops"]) / denominator * 100.0
            )


def csv_row(row: dict[str, Any]) -> dict[str, Any]:
    median = row.get("median_gflops")
    ranks = int(row.get("ranks", 0))
    core_count = int(row.get("core_count", ranks))
    reasons = list(row.get("invalid_reasons", []))
    return {
        "run_id": row.get("run_id", ""),
        "benchmark_basis": row.get("benchmark_basis", ""),
        "top500_revision": row.get("top500_revision", ""),
        "mpi_implementation": row.get("mpi_implementation", ""),
        "stage": row.get("stage", ""),
        "comparison": row.get("comparison", ""),
        "target": row.get("target", ""),
        "cpu_family": row.get("cpu_family", ""),
        "ranks": ranks,
        "n": row.get("n", ""),
        "nb": row.get("nb", ""),
        "median_gflops": f"{float(median):.3f}" if median is not None else "",
        "gflops_per_core": (
            f"{float(median) / core_count:.3f}"
            if median is not None and core_count
            else ""
        ),
        "min_gflops": (
            f"{float(row['min_gflops']):.3f}"
            if row.get("min_gflops") is not None
            else ""
        ),
        "max_gflops": (
            f"{float(row['max_gflops']):.3f}"
            if row.get("max_gflops") is not None
            else ""
        ),
        "coefficient_of_variation_percent": (
            f"{float(row.get('coefficient_of_variation_percent', 0.0)):.3f}"
        ),
        "residual_status": row.get("residual_status", ""),
        "valid": "yes" if row.get("valid") else "no",
        "live_background_load_impact_percent": (
            f"{float(row['live_background_load_impact_percent']):.2f}"
            if row.get("live_background_load_impact_percent") is not None
            else ""
        ),
        "distributed_scaling_efficiency_percent": (
            f"{float(row['distributed_scaling_efficiency_percent']):.2f}"
            if row.get("distributed_scaling_efficiency_percent") is not None
            else ""
        ),
        "notes": "; ".join(reasons),
    }


def markdown(rows: list[dict[str, Any]], run_id: str) -> str:
    basis = rows[0].get("benchmark_basis", "geerlingguy/top500-benchmark")
    revision = rows[0].get("top500_revision", "unknown")
    mpi = rows[0].get("mpi_implementation", "MPICH/Hydra")
    output = [
        f"# HPL Benchmark Summary: `{run_id}`",
        "",
        f"Benchmark basis: `{basis}` at `{revision}` using {mpi}.",
        "",
        "VM and bare-metal results below describe capability on different CPU families. "
        "They must not be interpreted as a measurement of virtualization overhead.",
        "",
        "| Stage | Target | Ranks | N / NB | Median GFLOPS | Min / max | GFLOPS/core | CV | Residual | Valid | Live impact | Scaling |",
        "|---|---|---:|---:|---:|---:|---:|---:|---|---|---:|---:|",
    ]
    for raw in rows:
        row = csv_row(raw)
        scaling = (
            f"{row['distributed_scaling_efficiency_percent']}%"
            if row["distributed_scaling_efficiency_percent"]
            else "—"
        )
        impact = (
            f"{row['live_background_load_impact_percent']}%"
            if row["live_background_load_impact_percent"]
            else "—"
        )
        output.append(
            "| {stage} | `{target}` | {ranks} | {n} / {nb} | {median} | {minimum} / {maximum} | {per_core} | "
            "{cov}% | {residual} | {valid} | {impact} | {scaling} |".format(
                stage=row["stage"],
                target=row["target"],
                ranks=row["ranks"],
                n=row["n"],
                nb=row["nb"],
                median=row["median_gflops"] or "—",
                minimum=row["min_gflops"] or "—",
                maximum=row["max_gflops"] or "—",
                per_core=row["gflops_per_core"] or "—",
                cov=row["coefficient_of_variation_percent"],
                residual=row["residual_status"],
                valid=row["valid"],
                impact=impact,
                scaling=scaling,
            )
        )
    invalid = [csv_row(row) for row in rows if not row.get("valid")]
    if invalid:
        output += ["", "## Invalid Results", ""]
        output.extend(
            f"- `{row['target']}` / `{row['stage']}`: {row['notes']}" for row in invalid
        )
    output += [
        "",
        "Scaling efficiency is the distributed standard median divided by the sum of "
        "the same members' isolated per-node standard medians. Live results quantify "
        "background-load impact relative to the matching isolated result; a positive "
        "impact means the live result was slower. Isolated results represent repeatable "
        "peak capability.",
        "",
    ]
    return "\n".join(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--result-dir", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()
    root = Path(args.result_dir)
    rows = read_summaries(root)
    if not rows:
        raise SystemExit(f"no summary.json files found below {root / 'raw'}")
    add_scaling(rows)
    rows.sort(key=lambda row: (str(row.get("stage", "")), str(row.get("target", ""))))
    with (root / "summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(csv_row(row) for row in rows)
    (root / "summary.md").write_text(markdown(rows, args.run_id), encoding="utf-8")
    print(f"wrote {root / 'summary.csv'} and {root / 'summary.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
