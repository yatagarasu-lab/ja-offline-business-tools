#!/usr/bin/env python3
"""Apple Silicon Mac ローカルAI（MLX / 日本語リランカー / NLI検閲）1秒環境診断CLI（無料公開版）。

標準ライブラリのみで動作し、外部通信は一切行いません。
実行すると、お使いのMacのチップ・ユニファイドメモリ容量・Python環境を診断し、
メモリ不足で落ちない安全なローカルモデル規模と推奨LoRAパラメータを表示します。
"""

from __future__ import annotations

import importlib.util
import json
import platform
import subprocess
import sys
from typing import Any


def _sysctl_value(key: str) -> str:
    try:
        res = subprocess.run(
            ["sysctl", "-n", key],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        return res.stdout.strip() if res.returncode == 0 else ""
    except Exception:
        return ""


def detect_mac_specs() -> dict[str, Any]:
    os_name = platform.system()
    arch = platform.machine()
    chip = _sysctl_value("machdep.cpu.brand_string") if os_name == "Darwin" else platform.processor()
    mem_raw = _sysctl_value("hw.memsize") if os_name == "Darwin" else ""
    mem_gb = round(int(mem_raw) / (1024**3), 1) if mem_raw.isdigit() else 0.0

    pkgs = {}
    for mod in ("mlx", "mlx_lm", "torch", "transformers", "sentencepiece"):
        pkgs[mod] = importlib.util.find_spec(mod) is not None

    is_apple_silicon = os_name == "Darwin" and arch == "arm64"
    if not is_apple_silicon:
        tier = "NON_APPLE_SILICON"
        recommended_llm = "CPU/CUDA環境向けモデル（MLXはApple Silicon Mac専用）"
        lora_profile = {"supported": False, "reason": "MLX LoRAはApple Silicon Mac（M1〜M4）専用です"}
    elif mem_gb >= 32:
        tier = "PRO_32GB_PLUS"
        recommended_llm = "mlx-community/Qwen2.5-14B-Instruct-4bit または 32B-4bit"
        lora_profile = {
            "supported": True,
            "model": "mlx-community/Qwen2.5-14B-Instruct-4bit",
            "batch_size": 2,
            "num_layers": 16,
            "lora_rank": 16,
            "max_seq_length": 1024,
            "grad_checkpoint": False,
        }
    elif mem_gb >= 24:
        tier = "VERIFIED_24GB"
        recommended_llm = "mlx-community/Qwen2.5-14B-Instruct-4bit（実測75秒LoRA学習・スワップなし）"
        lora_profile = {
            "supported": True,
            "model": "mlx-community/Qwen2.5-14B-Instruct-4bit",
            "batch_size": 1,
            "num_layers": 8,
            "lora_rank": 8,
            "max_seq_length": 768,
            "grad_checkpoint": True,
        }
    elif mem_gb >= 16:
        tier = "COMPACT_16GB"
        recommended_llm = "mlx-community/Qwen2.5-7B-Instruct-4bit（14B LoRAはスワップ注意・7B推奨）"
        lora_profile = {
            "supported": True,
            "model": "mlx-community/Qwen2.5-7B-Instruct-4bit",
            "batch_size": 1,
            "num_layers": 8,
            "lora_rank": 8,
            "max_seq_length": 512,
            "grad_checkpoint": True,
        }
    else:
        tier = "ENTRY_8GB"
        recommended_llm = "mlx-community/Qwen2.5-3B-Instruct-4bit（推論＋軽量リランカー向け）"
        lora_profile = {
            "supported": False,
            "reason": "8GBメモリでは14B/7BのLoRA学習はスワップ過多になります。3B推論＋日本語検索を推奨します。",
        }

    return {
        "os": os_name,
        "arch": arch,
        "chip": chip or "unknown",
        "memory_gb": mem_gb,
        "python_version": sys.version.split()[0],
        "apple_silicon": is_apple_silicon,
        "tier": tier,
        "recommended_llm": recommended_llm,
        "lora_profile": lora_profile,
        "packages_installed": pkgs,
        "reranker_ready": bool(pkgs["transformers"] and pkgs["torch"] and pkgs["sentencepiece"]),
        "nli_guard_ready": bool(pkgs["transformers"] and pkgs["torch"] and pkgs["sentencepiece"]),
        "install_command_hint": (
            "pip install -U mlx-lm torch transformers sentencepiece"
        ),
    }


def main() -> int:
    report = detect_mac_specs()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
