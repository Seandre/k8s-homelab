#!/usr/bin/env python3
"""Behavioral tests for the local HPL execution and summary helpers."""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock


ROLE_FILES = Path(__file__).resolve().parents[1] / "files"


def load_module(name: str, path: Path):  # type: ignore[no-untyped-def]
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load_module("hpl_runner_tested", ROLE_FILES / "hpl_runner.py")
summarizer = load_module("summarize_hpl_tested", ROLE_FILES / "summarize_hpl.py")


def valid_result(gflops: float, ranks: int = 2) -> dict[str, object]:
    return {
        "return_code": 0,
        "gflops": gflops,
        "residual_passed": True,
        "bindings": [
            {"process": rank, "bitmap": "10" if rank == 0 else "01"}
            for rank in range(ranks)
        ],
        "swap_delta": {},
        "thermal_throttle_delta": {},
    }


class RunnerTests(unittest.TestCase):
    def test_upstream_algorithm_defaults_and_hydra_command(self) -> None:
        data = runner.hpl_dat(7680, 192, 1, 2)
        self.assertIn("0            PMAP", data)
        self.assertIn("2            PFACTs", data)
        self.assertIn("1            RFACTs", data)
        self.assertIn("1            BCASTs", data)

        args = argparse.Namespace(
            mpirun="/opt/top500/mpich/bin/mpirun",
            ranks=2,
            hostfile="/tmp/cluster-hosts",
            binding="core",
            xhpl="/opt/top500/tmp/hpl-2.3/bin/top500/xhpl",
        )
        command = runner.mpi_command(args)
        self.assertEqual(command[:3], [args.mpirun, "-n", "2"])
        self.assertIn("-genv", command)
        self.assertEqual(command[9:11], ["-f", args.hostfile])
        self.assertEqual(command[-5:-1], ["-bind-to", "core", "-map-by", "core"])

    def test_hydra_binding_and_hpl_result_parsing(self) -> None:
        output = "\n".join(
            [
                "process 0 binding: 1100",
                "process 1 binding: 0011",
                "WR11C2R4 7680 192 1 2 1.00 123.45",
                "PASSED",
            ]
        )
        gflops, residual, bindings = runner.parse_hpl_output(output)
        self.assertEqual(gflops, 123.45)
        self.assertTrue(residual)
        self.assertEqual(len(bindings), 2)
        result = valid_result(123.45)
        result["bindings"] = bindings
        self.assertEqual(runner.invalid_reasons(result, 2), [])
        self.assertIn("binding", runner.invalid_reasons(result, 3)[0])

    def test_high_variance_adds_a_measured_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            args = argparse.Namespace(
                mpirun="/opt/top500/mpich/bin/mpirun",
                xhpl="/opt/top500/tmp/hpl-2.3/bin/top500/xhpl",
                output_dir=temporary_directory,
                run_id="test-run",
                top500_revision="e71588f33fcf358910047de25720e3147d627be4",
                label="node-test",
                stage="isolated-node",
                comparison="standard",
                target="node-01",
                cpu_family="test-cpu",
                n=7680,
                nb=192,
                p=1,
                q=2,
                ranks=2,
                core_count=2,
                warmups=1,
                runs=3,
                max_extra_runs=2,
                cov_limit_percent=3.0,
                binding="core",
                hostfile="",
                members="",
            )
            results = [
                valid_result(value) for value in (100.0, 100.0, 104.0, 96.0, 102.0)
            ]
            with mock.patch.object(
                runner, "run_once", side_effect=results
            ) as mocked_run:
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(runner.run_command(args), 0)
            self.assertEqual(mocked_run.call_count, 5)
            summary = json.loads(
                (Path(temporary_directory) / "summary.json").read_text(encoding="utf-8")
            )
            self.assertEqual(summary["measured_runs"], 4)
            self.assertEqual(summary["benchmark_basis"], "geerlingguy/top500-benchmark")
            self.assertTrue(summary["valid"])


class SummarizerTests(unittest.TestCase):
    def test_sanitized_rows_keep_upstream_identity_and_scaling(self) -> None:
        node = {
            "run_id": "run-1",
            "benchmark_basis": "geerlingguy/top500-benchmark",
            "top500_revision": "e71588f",
            "mpi_implementation": "MPICH/Hydra",
            "stage": "isolated-node",
            "comparison": "standard",
            "target": "node-01",
            "cpu_family": "test-cpu",
            "ranks": 2,
            "core_count": 2,
            "n": 7680,
            "nb": 192,
            "median_gflops": 100.0,
            "min_gflops": 99.0,
            "max_gflops": 101.0,
            "coefficient_of_variation_percent": 1.0,
            "residual_status": "PASS",
            "valid": True,
            "distributed": False,
        }
        group = dict(node)
        group.update(
            {
                "stage": "isolated-group",
                "target": "group-01",
                "members": ["node-01"],
                "distributed": True,
                "median_gflops": 90.0,
            }
        )
        rows = [node, group]
        summarizer.add_scaling(rows)
        self.assertEqual(group["distributed_scaling_efficiency_percent"], 90.0)
        csv_row = summarizer.csv_row(group)
        self.assertEqual(csv_row["benchmark_basis"], "geerlingguy/top500-benchmark")
        self.assertEqual(csv_row["mpi_implementation"], "MPICH/Hydra")
        markdown = summarizer.markdown(rows, "run-1")
        self.assertIn("`geerlingguy/top500-benchmark` at `e71588f`", markdown)


if __name__ == "__main__":
    unittest.main()
