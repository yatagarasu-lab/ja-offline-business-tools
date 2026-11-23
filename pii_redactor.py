#!/usr/bin/env python3
"""Zero-Trust Offline PII & API Secret Redactor CLI (Zero Dependencies)."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EMAIL", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("PHONE", re.compile(r"(?:\+81-?|0)\d{1,4}-\d{1,4}-\d{3,4}")),
    ("POSTAL", re.compile(r"〒?\d{3}-\d{4}")),
    ("API_KEY", re.compile(r"\b(?:sk|rk|pk|ghp|gho|AIza)[A-Za-z0-9_-]{12,}\b")),
    ("LONG_ID", re.compile(r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b|\b\d{12,16}\b")),
]


def redact_text(text: str) -> tuple[str, dict[str, str]]:
    token_to_orig: dict[str, str] = {}
    orig_to_token: dict[str, str] = {}
    out = text
    for label, pat in PATTERNS:
        seq = 0

        def _repl(match: re.Match[str], _label: str = label) -> str:
            nonlocal seq
            val = match.group(0)
            if val not in orig_to_token:
                seq += 1
                tok = f"[{_label}_{seq}]"
                orig_to_token[val] = tok
                token_to_orig[tok] = val
            return orig_to_token[val]

        out = pat.sub(_repl, out)
    return out, token_to_orig


def restore_text(text: str, mapping: dict[str, str]) -> str:
    out = text
    for tok, orig in mapping.items():
        out = out.replace(tok, orig)
    return out


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python3 pii_redactor.py <input.txt> [output_masked.txt]")
        return 1
    src_path = Path(sys.argv[1])
    masked, mapping = redact_text(src_path.read_text(encoding="utf-8"))
    out_path = Path(sys.argv[2]) if len(sys.argv) >= 3 else src_path.with_suffix(".masked.txt")
    out_path.write_text(masked, encoding="utf-8")
    map_path = out_path.with_suffix(".map.json")
    map_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Masked {len(mapping)} unique items -> {out_path} (restore map: {map_path})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
