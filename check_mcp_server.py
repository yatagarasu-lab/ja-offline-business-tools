#!/usr/bin/env python3
"""Zero-Dependency MCP (Model Context Protocol) Stdio Server Doctor CLI (MIT Open Source).

Spawns any local stdio MCP server command and verifies:
1. Zero stdout pollution before JSON-RPC response (the #1 cause of Claude Desktop / Cursor disconnects)
2. Valid MCP `initialize` handshake & protocol version negotiation
3. Valid `tools/list` JSON schema discovery
4. Round-trip latency in milliseconds

Usage:
    python3 check_mcp_server.py -- python3 mcp_readonly_sqlite_server.py --db ./sample.sqlite3
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from typing import Any


def _send_jsonrpc(proc: subprocess.Popen[str], payload: dict[str, Any]) -> bool:
    if proc.stdin is None or proc.poll() is not None:
        return False
    try:
        proc.stdin.write(json.dumps(payload, ensure_ascii=False) + "\n")
        proc.stdin.flush()
        return True
    except (BrokenPipeError, OSError):
        return False


def _read_jsonrpc_line(proc: subprocess.Popen[str], timeout_sec: float = 5.0) -> tuple[dict[str, Any] | None, list[str]]:
    assert proc.stdout is not None
    pollution: list[str] = []
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        line = proc.stdout.readline()
        if not line:
            break
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("{"):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, dict):
                    return parsed, pollution
            except json.JSONDecodeError:
                pollution.append(stripped[:160])
        else:
            pollution.append(stripped[:160])
    return None, pollution


def diagnose_mcp_stdio_server(command: list[str], timeout_sec: float = 5.0) -> dict[str, Any]:
    if not command:
        raise ValueError("Empty command")
    t0 = time.perf_counter()
    proc = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    try:
        _send_jsonrpc(
            proc,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "ja-offline-mcp-doctor", "version": "1.0.0"},
                },
            },
        )
        init_resp, pol1 = _read_jsonrpc_line(proc, timeout_sec=timeout_sec)
        init_ms = round((time.perf_counter() - t0) * 1000.0, 1)

        tools_resp: dict[str, Any] | None = None
        pol2: list[str] = []
        tools_ms = 0.0
        if init_resp is not None and _send_jsonrpc(proc, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}):
            t1 = time.perf_counter()
            if _send_jsonrpc(proc, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}):
                tools_resp, pol2 = _read_jsonrpc_line(proc, timeout_sec=timeout_sec)
                tools_ms = round((time.perf_counter() - t1) * 1000.0, 1)

        all_pollution = pol1 + pol2
        tools = (((tools_resp or {}).get("result") or {}).get("tools")) if isinstance(tools_resp, dict) else []
        server_info = (((init_resp or {}).get("result") or {}).get("serverInfo")) if isinstance(init_resp, dict) else {}
        protocol = (((init_resp or {}).get("result") or {}).get("protocolVersion")) if isinstance(init_resp, dict) else ""

        ok = bool(
            init_resp
            and "result" in init_resp
            and tools_resp
            and "result" in tools_resp
            and isinstance(tools, list)
            and len(all_pollution) == 0
        )
        return {
            "ok": ok,
            "command": command,
            "protocol_version": protocol,
            "server_info": server_info,
            "stdout_pollution_count": len(all_pollution),
            "stdout_pollution_samples": all_pollution[:5],
            "tools_count": len(tools) if isinstance(tools, list) else 0,
            "tool_names": [str(t.get("name") or "") for t in (tools or []) if isinstance(t, dict)],
            "initialize_ms": init_ms,
            "tools_list_ms": tools_ms,
        }
    finally:
        for stream in (proc.stdin, proc.stdout, proc.stderr):
            if stream is not None:
                try:
                    stream.close()
                except OSError:
                    pass
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            proc.kill()


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose any local stdio MCP server without external dependencies.")
    parser.add_argument("--timeout", type=float, default=5.0, help="Read timeout per RPC step (seconds)")
    parser.add_argument("cmd", nargs=argparse.REMAINDER, help="Server command after '--'")
    args = parser.parse_args()
    cmd = [c for c in args.cmd if c != "--"]
    if not cmd:
        print("Usage: python3 check_mcp_server.py -- python3 your_mcp_server.py", file=sys.stderr)
        return 2
    res = diagnose_mcp_stdio_server(cmd, timeout_sec=args.timeout)
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0 if res["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
