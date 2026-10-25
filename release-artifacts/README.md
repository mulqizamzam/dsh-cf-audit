# Release artifact checksum

`SHA256SUMS.txt` records the checksum of the reproducible source archive delivered with release `0.1.0`. The ZIP is also available as the release artifact attached to the project handoff; this connected GitHub interface can commit repository files but cannot attach files to a GitHub Releases page.

Rebuild the ZIP from the repository root:

```sh
python3 scripts/package-release.py /path/to/dsh-cf-audit-0.1.0.zip
sha256sum /path/to/dsh-cf-audit-0.1.0.zip
```

The ZIP includes source, skills, validation scripts, tests, docs, license, and package metadata. It excludes Git history and transient files. A checksum match confirms archive identity, not runtime compatibility by itself.
