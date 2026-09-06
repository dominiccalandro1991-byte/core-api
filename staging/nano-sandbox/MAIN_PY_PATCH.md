# nano-sandbox `backend/app/main.py` — two-line mesh include

Do not rewrite engines. Apply only:

1. Extend the routers import to include `voltcore_mesh`.
2. After `app.include_router(billing.router)` add `app.include_router(voltcore_mesh.router)`.

New files:
- `backend/app/voltcore_mesh.py`
- `backend/app/routers/voltcore_mesh.py`

Render env: `MESH_HMAC` or `NANO_SANDBOX_MESH_HMAC` (same value as Worker `MESH_HMAC`).
