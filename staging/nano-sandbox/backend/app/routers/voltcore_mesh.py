"""POST /mesh/command — HMAC mesh subscriber for nano-sandbox-api."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from app import voltcore_mesh as mesh

router = APIRouter(prefix="/mesh", tags=["mesh"])


class CommandIn(BaseModel):
    action: str
    source: str | None = None


@router.get("/health")
def mesh_health() -> dict[str, Any]:
    return {"ok": True, "configured": bool(mesh.mesh_secret()), "drain": mesh.draining()}


@router.post("/command")
def mesh_command(
    body: CommandIn,
    x_voltcore_timestamp: str | None = Header(default=None),
    x_voltcore_nonce: str | None = Header(default=None),
    x_voltcore_signature: str | None = Header(default=None),
) -> dict[str, Any]:
    try:
        mesh.verify(x_voltcore_timestamp or "", x_voltcore_nonce or "", x_voltcore_signature or "")
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    try:
        return mesh.apply_command(body.action)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
