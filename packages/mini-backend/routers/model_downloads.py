"""Per-job download routes — the single authority for installation.

POST creates a job and returns immediately (never blocks); the shell polls
GET to convert state into model-manager:event events. The legacy
/models/install* endpoints still exist as synchronous wrappers in
routers/model_install.py (same JobManager underneath).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.download_jobs import ACTIVE_STATES, get_job_manager
from routers.model_install import install_managed_model_sync


router = APIRouter(tags=["model-downloads"])

# Installer wiring: JobManager lives in core and does not know about routers;
# this module bridges the two (tests replace manager.installer).
_MANAGED_JOB_MANAGER = get_job_manager()
_MANAGED_JOB_MANAGER.installer = install_managed_model_sync


class ModelDownloadRequest(BaseModel):
    model_id: str
    source_language: str | None = None
    required_disk_bytes: int | None = None
    # Extras for models without a dedicated dispatch (registry direct_download):
    download_url: str | None = None
    checksum_sha256: str | None = None
    expected_download_bytes: int | None = None


@router.post("/models/downloads", status_code=202)
async def create_model_download(payload: ModelDownloadRequest) -> dict[str, Any]:
    model_id = payload.model_id.strip().lower()
    if not model_id:
        raise HTTPException(status_code=400, detail="model_id is required.")

    extras = {
        key: value
        for key, value in {
            "download_url": payload.download_url,
            "checksum_sha256": payload.checksum_sha256,
            "expected_download_bytes": payload.expected_download_bytes,
        }.items()
        if value is not None
    }

    manager = _MANAGED_JOB_MANAGER
    job, created = manager.submit(
        model_id,
        payload.source_language,
        int(payload.required_disk_bytes or 0),
        extras,
    )
    snapshot = job.snapshot()
    return {
        "jobId": snapshot["jobId"],
        "state": snapshot["state"],
        "created": created,
    }


@router.get("/models/downloads")
async def list_model_downloads(
    modelId: str | None = None,
    state: str | None = None,
) -> dict[str, Any]:
    manager = _MANAGED_JOB_MANAGER
    jobs = manager.list_snapshots(include_finished=state != "active")
    if modelId:
        wanted = modelId.strip().lower()
        jobs = [job for job in jobs if job["modelId"] == wanted]
    if state == "active":
        jobs = [job for job in jobs if job["state"] in ACTIVE_STATES]
    return {"jobs": jobs}


@router.get("/models/downloads/{job_id}")
async def get_model_download(job_id: str) -> dict[str, Any]:
    job = _MANAGED_JOB_MANAGER.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown download job: {job_id}")
    return job.snapshot()


@router.post("/models/downloads/{job_id}/cancel")
async def cancel_model_download(job_id: str) -> dict[str, Any]:
    job = _MANAGED_JOB_MANAGER.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Unknown download job: {job_id}")
    cancelled = job.request_cancel()
    snapshot = job.snapshot()
    return {
        "ok": cancelled,
        "jobId": snapshot["jobId"],
        "state": snapshot["state"],
    }
