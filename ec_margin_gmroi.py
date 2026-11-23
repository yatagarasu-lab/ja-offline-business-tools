#!/usr/bin/env python3
"""5-Platform Japanese EC Margin, Max-Cost & GMROI Calculator CLI (Zero Dependencies)."""

from __future__ import annotations

import argparse
import json

PLATFORM_FEES: dict[str, float] = {
    "mercari": 0.10,
    "amazon": 0.10,
    "rakuten": 0.085,
    "yahoo": 0.065,
    "base": 0.066,
}


def calculate_ec_metrics(
    *,
    price_yen: int,
    cost_yen: int,
    shipping_yen: int,
    packaging_yen: int = 80,
    platform: str = "mercari",
    return_reserve_rate: float = 0.02,
    expected_sell_days: int = 14,
    target_margin_rate: float = 0.20,
) -> dict[str, object]:
    fee_rate = PLATFORM_FEES.get(platform.lower(), 0.10)
    fee_yen = int(round(price_yen * fee_rate))
    reserve_yen = int(round(price_yen * return_reserve_rate))
    net_profit = price_yen - fee_yen - shipping_yen - packaging_yen - reserve_yen - cost_yen
    net_margin_pct = round((net_profit / max(1, price_yen)) * 100.0, 2)
    roi_pct = round((net_profit / max(1, cost_yen)) * 100.0, 2)
    annual_turns = round(365.0 / max(1, expected_sell_days), 2)
    gmroi_pct = round(roi_pct * annual_turns, 1)
    max_cost_for_target = int(price_yen * (1.0 - fee_rate - return_reserve_rate - target_margin_rate) - shipping_yen - packaging_yen)
    return {
        "platform": platform.lower(),
        "price_yen": price_yen,
        "cost_yen": cost_yen,
        "platform_fee_yen": fee_yen,
        "shipping_plus_packaging_yen": shipping_yen + packaging_yen,
        "return_reserve_yen": reserve_yen,
        "net_profit_yen": net_profit,
        "net_margin_pct": net_margin_pct,
        "roi_pct": roi_pct,
        "annual_turns": annual_turns,
        "gmroi_pct": gmroi_pct,
        "max_purchase_cost_for_20pct_margin_yen": max(0, max_cost_for_target),
        "pass_strict_gate": net_margin_pct >= 20.0 and roi_pct >= 25.0 and net_profit > 0,
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Japanese 5-Platform EC Net Margin & GMROI Calculator")
    p.add_argument("--price", type=int, required=True, help="Selling price in JPY")
    p.add_argument("--cost", type=int, required=True, help="Purchase cost in JPY")
    p.add_argument("--shipping", type=int, default=210, help="Shipping fee in JPY (default: 210)")
    p.add_argument("--packaging", type=int, default=80, help="Packaging material cost in JPY (default: 80)")
    p.add_argument("--platform", choices=sorted(PLATFORM_FEES), default="mercari")
    p.add_argument("--days", type=int, default=14, help="Expected days to sell (default: 14)")
    args = p.parse_args()
    out = calculate_ec_metrics(
        price_yen=args.price,
        cost_yen=args.cost,
        shipping_yen=args.shipping,
        packaging_yen=args.packaging,
        platform=args.platform,
        expected_sell_days=args.days,
    )
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
