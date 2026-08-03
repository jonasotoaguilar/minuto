#!/usr/bin/env python3
"""Baseline inventory verifier and generator for the stabilize-project-foundations change."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

DEFAULT_REPO_NAME = "minuto"
EXCLUDED_PREFIXES = ("openspec", "sdd")
INVENTORY_FILENAME = "baseline-inventory.jsonl"
APPLY_PROGRESS_FILENAME = "apply-progress.md"

def run_git(args: list[str], cwd: Path | str) -> str:
    return subprocess.run(
        ["git", *args], cwd=str(cwd), capture_output=True, text=True, check=True
    ).stdout

def repo_root(cwd: Path | str, expected_name: str) -> Path:
    try:
        root = Path(run_git(["rev-parse", "--show-toplevel"], cwd).strip())
    except subprocess.CalledProcessError as exc:
        raise RuntimeError("Not inside a git repository") from exc
    if root.name != expected_name:
        raise RuntimeError(f"Repo root mismatch: expected {expected_name!r}, got {root.name!r}")
    return root

def head_commit(root: Path) -> str:
    return run_git(["rev-parse", "HEAD"], root).strip()

def head_tree(root: Path) -> str:
    return run_git(["rev-parse", "HEAD^{tree}"], root).strip()

def porcelain_status(root: Path) -> str:
    return run_git(
        ["status", "--porcelain=v2", "--branch", "--untracked-files=all", "--ignored=matching"],
        root,
    )

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def chunk_hashes(path: Path, lines_per_chunk: int = 400) -> list[str]:
    chunks: list[str] = []
    block: list[str] = []
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            block.append(line)
            if len(block) == lines_per_chunk:
                chunks.append(hashlib.sha256("".join(block).encode()).hexdigest())
                block = []
    if block:
        chunks.append(hashlib.sha256("".join(block).encode()).hexdigest())
    return chunks

def is_ignored(root: Path, path: str) -> bool:
    try:
        run_git(["check-ignore", "--no-index", path], root)
        return True
    except subprocess.CalledProcessError:
        return False

def is_secret_path(path: str) -> bool:
    name = os.path.basename(path)
    return name.startswith(".env") or name.lower().endswith((".pem", ".key", ".p12", ".pfx", ".keystore"))

def is_excluded_metadata(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in EXCLUDED_PREFIXES)

def _excluded_paths(root: Path, target: Path) -> set[str]:
    try:
        rel = target.resolve().relative_to(root.resolve())
    except ValueError:
        return set()
    excluded = {str(rel)}
    if rel.name == INVENTORY_FILENAME:
        excluded.add(str(rel.with_name(APPLY_PROGRESS_FILENAME)))
    return excluded

def is_excluded_path(path: str, extra: set[str]) -> bool:
    return is_excluded_metadata(path) or path in extra

def make_record(path: str, status: str, mode: str | None, layer: str) -> dict[str, Any]:
    return {"path": path, "status": status, "mode": mode, "layer": layer}

def split_xy(path: str, xy: str, mh: str, mi: str, md: str) -> list[dict[str, Any]]:
    x, y = xy[0], xy[1]
    if x == "D":
        return [make_record(path, "D.", mh, "index")]
    if y == "D":
        return [make_record(path, ".D", mh, "worktree")]
    records = []
    if x != ".":
        records.append(make_record(path, f"{x}.", mi, "index"))
    if y == "M":
        records.append(make_record(path, f".{y}", md, "worktree"))
    if not records:
        records.append(make_record(path, xy, mh, "worktree"))
    return records

def parse_status(output: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line in output.splitlines():
        if not line or line.startswith("#"):
            continue
        if line.startswith("1 "):
            p = line.split(" ")
            if len(p) >= 9:
                records.extend(split_xy(p[8], p[1], p[3], p[4], p[5]))
        elif line.startswith("2 "):
            p = line.split(" ")
            if len(p) >= 10:
                records.extend(split_xy(p[9], p[1], p[3], p[4], p[5]))
        elif line.startswith("? "):
            path = line[2:]
            records.append(make_record(path, "??", "040000" if path.endswith("/") else "100644", "untracked"))
        elif line.startswith("! "):
            records.append(make_record(line[2:], "!!", None, "ignored"))
    return records

def build_record(root: Path, entry: dict[str, Any]) -> dict[str, Any]:
    path = entry["path"]
    status = entry["status"]
    layer = entry["layer"]
    metadata_only = is_secret_path(path) or is_ignored(root, path)
    ignored = layer == "ignored"
    is_dir = path.endswith("/") or (root / path).is_dir()
    sha256_val: str | None = None
    chunks: list[str] | None = None
    full = root / path
    if not metadata_only and not ignored and not is_dir and "D" not in status and full.is_file():
        sha256_val = sha256(full)
        if full.stat().st_size > 1024:
            chunks = chunk_hashes(full)
    return {
        "path": path,
        "layer": layer,
        "status": status,
        "mode": entry["mode"],
        "sha256": sha256_val,
        "chunks": chunks,
        "metadata_only": metadata_only or ignored or is_dir,
        "preserve_equality": True,
    }

def generate_inventory(root: Path, output_path: Path) -> None:
    excluded = _excluded_paths(root, output_path)
    entries = [e for e in parse_status(porcelain_status(root)) if not is_excluded_path(e["path"], excluded)]
    records: list[dict[str, Any]] = [
        {"schema": "baseline-inventory/v1", "type": "head", "commit": head_commit(root), "tree": head_tree(root)}
    ]
    seen: set[tuple[str, str]] = set()
    for entry in entries:
        key = (entry["path"], entry["layer"])
        if key in seen:
            raise RuntimeError(f"Duplicate (path, layer) in status: {key}")
        seen.add(key)
        records.append(build_record(root, entry))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        for r in records:
            f.write(json.dumps(r, sort_keys=True) + "\n")

def read_inventory(path: Path) -> list[dict[str, Any]]:
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]

def verify_inventory(root: Path, inventory_path: Path) -> None:
    inventory = read_inventory(inventory_path)
    heads = [r for r in inventory if r.get("type") == "head"]
    if len(heads) != 1:
        raise RuntimeError(f"Expected exactly one head record, found {len(heads)}")

    excluded = _excluded_paths(root, inventory_path)
    current_entries = [e for e in parse_status(porcelain_status(root)) if not is_excluded_path(e["path"], excluded)]
    current = {(r["path"], r["layer"]): build_record(root, r) for r in current_entries}

    inv_records = [r for r in inventory if "path" in r and r.get("preserve_equality", True) and not is_excluded_path(r["path"], excluded)]
    inv = {(r["path"], r.get("layer")): r for r in inv_records}

    keys = list(inv.keys())
    if len(keys) != len(set(keys)):
        raise RuntimeError("Duplicate (path, layer) entries in inventory")

    for key, cur in current.items():
        if key not in inv:
            raise RuntimeError(f"Missing inventory record: {key}")

    for key, record in inv.items():
        if key not in current:
            raise RuntimeError(f"Drift: {key} in inventory but missing from current state")
        cur = current[key]
        for field in ("status", "mode", "sha256"):
            if record.get(field) != cur.get(field):
                raise RuntimeError(f"{field} drift: {key}")

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate or verify a baseline inventory.")
    parser.add_argument("--output", type=Path, help="Path to write the inventory JSONL.")
    parser.add_argument("--gate", action="store_true", help="Verify the inventory against current state.")
    parser.add_argument("--inventory", type=Path, help="Inventory path to verify.")
    parser.add_argument("--repo-name", default=DEFAULT_REPO_NAME, help="Expected repository root name.")
    args = parser.parse_args()

    root = repo_root(Path.cwd(), args.repo_name)

    if args.output:
        generate_inventory(root, args.output)
        print(f"Inventory written to {args.output}")
        return 0

    inv_path = args.inventory or args.output
    if not inv_path:
        parser.error("--inventory or --output is required with --gate")
    verify_inventory(root, inv_path)
    print(f"Inventory verified: {inv_path}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"verify-baseline: {exc}", file=sys.stderr)
        sys.exit(1)
