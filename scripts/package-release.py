#!/usr/bin/env python3
"""Create a deterministic ZIP of the source release using only Python's standard library."""
from __future__ import annotations
import hashlib
import os
from pathlib import Path
import stat
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
INCLUDE_ROOT_FILES = {
    "package.json", "README.md", "LICENSE", "CHANGELOG.md", "SECURITY.md",
    "CONTRIBUTING.md", "cordis.patch.yml", ".gitignore", ".npmignore",
}
INCLUDE_DIRS = {"src", "skills", "scripts", "tests", "docs", "assets"}
EXCLUDED_DIRS = {".git", "node_modules", "release-artifacts", "__pycache__", "coverage"}
EXCLUDED_FILES = {".DS_Store", "Thumbs.db"}


def gather() -> list[Path]:
    items: list[Path] = []
    for child in ROOT.iterdir():
        if child.name in INCLUDE_ROOT_FILES and child.is_file():
            items.append(child)
        elif child.name in INCLUDE_DIRS and child.is_dir():
            for path in child.rglob("*"):
                if path.is_symlink():
                    raise ValueError(f"symlink is not packageable: {path.relative_to(ROOT)}")
                rel_parts = path.relative_to(ROOT).parts
                if any(part in EXCLUDED_DIRS for part in rel_parts):
                    continue
                if path.is_dir():
                    continue
                if not path.is_file() or path.name in EXCLUDED_FILES or path.suffix == ".pyc":
                    continue
                if path.name.startswith(".env") or path.name in {".npmrc", "id_rsa", "id_ed25519", "credentials.json", "secrets.yaml", "secrets.yml"}:
                    raise ValueError(f"secret-shaped file is not packageable: {path.relative_to(ROOT)}")
                items.append(path)
    return sorted(set(items), key=lambda p: p.relative_to(ROOT).as_posix())


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/package-release.py <output.zip>", file=sys.stderr)
        return 2
    output = Path(sys.argv[1]).expanduser().resolve()
    if output == ROOT or output.is_dir():
        print("Output must be a ZIP file path, not a directory or project root.", file=sys.stderr)
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    files = gather()
    output.unlink(missing_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9, strict_timestamps=True) as zf:
        for path in files:
            rel = path.relative_to(ROOT).as_posix()
            info = zipfile.ZipInfo(rel, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            mode = stat.S_IMODE(path.stat().st_mode)
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.flag_bits |= 0x800
            zf.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    print(f"Created {output}")
    print(f"Files: {len(files)}")
    print(f"Bytes: {output.stat().st_size}")
    print(f"SHA256: {digest}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
