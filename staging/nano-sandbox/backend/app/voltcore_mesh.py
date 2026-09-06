"""VoltCore mesh subscriber. HMAC-gated control flags. Does not touch engines."""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Any

from app import voltcore_telemetry as telemetry

_DRAIN = False


def mesh_secret() -> str:
    return (os.environ.get("NANO_SANDBOX_MESH_HMAC") or os.environ.get("MESH_HMAC") or "").strip()


def verify(timestamp: str, nonce: str, signature: str) -> None:
    secret = mesh_secret()
    if not secret:
        raise PermissionError("mesh_unconfigured")
    try:
        ts = int(timestamp)
    except (TypeError, ValueError) as exc:
        raise PermissionError("mesh_clock") from exc
    if abs(int(time.time() * 1000) - ts) > 120_000:
        raise PermissionError("mesh_clock")
    if not nonce or len(nonce) < 8:
        raise PermissionError("mesh_nonce")
    expect = hmac.new(secret.encode(), f"{timestamp}.{nonce}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expect, (signature or "").lower()):
        raise PermissionError("mesh_sig")


def draining() -> bool:
    return _DRAIN


def apply_command(action: str) -> dict[str, Any]:
    global _DRAIN
    action = (action or "").strip().lower()
    if action in {"ping", "heartbeat"}:
        telemetry.emit("mesh.ping" if action == "ping" else "health.heartbeat", "info", telemetry.health_payload({"mesh": action}))
        return {"ok": True, "action": action, "drain": _DRAIN}
    if action == "drain":
        _DRAIN = True
        telemetry.emit("mesh.drain", "info", {"drain": True})
        return {"ok": True, "action": "drain", "drain": True}
    if action == "undrain":
        _DRAIN = False
        telemetry.emit("mesh.undrain", "info", {"drain": False})
        return {"ok": True, "action": "undrain", "drain": False}
    raise ValueError("unknown_action")
