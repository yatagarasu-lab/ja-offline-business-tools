#!/usr/bin/env python3
"""Japan 2026-10 Invoice System (80% -> 70% Deduction) Estimator & T-Number Modulus-11 Checker."""

from __future__ import annotations

import argparse
import json
import re


def verify_corporate_t_number(t_number: str) -> dict[str, object]:
    """Validate a Japanese T+13-digit invoice registration number using NTA Modulus-11 check digit."""
    cleaned = t_number.strip().upper()
    if not re.fullmatch(r"T\d{13}", cleaned):
        return {"input": t_number, "valid_format": False, "check_digit_ok": False}
    digits = [int(ch) for ch in cleaned[1:]]
    check_digit = digits[0]
    body = digits[1:]  # 12 digits (d12..d1 from left to right)
    weighted_sum = 0
    for idx_from_right, d in enumerate(reversed(body), start=1):
        weight = 1 if idx_from_right % 2 == 1 else 2
        weighted_sum += d * weight
    expected = 9 - (weighted_sum % 9)
    return {
        "input": cleaned,
        "valid_format": True,
        "expected_check_digit": expected,
        "actual_check_digit": check_digit,
        "check_digit_ok": check_digit == expected,
    }


def estimate_oct2026_deduction_delta(*, amount_incl_tax_yen: int, count: int = 1, tax_rate: float = 0.10) -> dict[str, object]:
    """Estimate the deduction difference between 80% (until 2026-09-30) and 70% (from 2026-10-01)."""
    total_gross = amount_incl_tax_yen * max(1, count)
    tax_portion = int(round(total_gross * tax_rate / (1.0 + tax_rate)))
    deductible_80 = int(round(tax_portion * 0.80))
    deductible_70 = int(round(tax_portion * 0.70))
    return {
        "total_gross_yen": total_gross,
        "tax_portion_yen": tax_portion,
        "deductible_80pct_yen": deductible_80,
        "deductible_70pct_yen": deductible_70,
        "additional_tax_burden_yen": deductible_80 - deductible_70,
        "note": "General arithmetic estimate only; consult NTA official guidance or a licensed tax accountant.",
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Japan 2026-10 Invoice 80%->70% Estimator & T-Number Checker")
    p.add_argument("--amount-incl-tax", type=int, default=0, help="Tax-inclusive payment per invoice (JPY)")
    p.add_argument("--count", type=int, default=1, help="Number of invoices per year")
    p.add_argument("--verify-t-number", type=str, default="", help="Validate a T+13-digit registration number")
    args = p.parse_args()
    result: dict[str, object] = {}
    if args.amount_incl_tax > 0:
        result["deduction_estimate"] = estimate_oct2026_deduction_delta(
            amount_incl_tax_yen=args.amount_incl_tax,
            count=args.count,
        )
    if args.verify_t_number.strip():
        result["t_number_check"] = verify_corporate_t_number(args.verify_t_number)
    if not result:
        p.print_help()
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
