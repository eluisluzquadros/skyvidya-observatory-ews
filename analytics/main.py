"""
S2ID Disaster Monitor - Analytics Microservice (FastAPI)

Provides:
- POST /pipeline/run - Execute full analytics pipeline
- GET /pipeline/status - Check pipeline status
- POST /georag/query - Natural language spatial query
- GET /health - Health check
"""

import asyncio
import logging
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    ANALYTICS_OUTPUT_DIR,
    FASTAPI_HOST,
    FASTAPI_PORT,
    UFS_TO_FILTER,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("analytics")

app = FastAPI(
    title="S2ID Analytics Microservice",
    description="Spatial analysis, MCDA risk scoring, and GeoRAG for disaster monitoring",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pipeline state
pipeline_state = {
    "status": "idle",  # idle, running, completed, error
    "last_run": None,
    "last_duration": None,
    "last_error": None,
    "progress": "",
}


class PipelineRequest(BaseModel):
    ufs: list[str] | None = None  # Filter by specific UFs
    lisa_variables: list[str] | None = None  # Specific LISA variables (None = auto-detect)


class GeoRAGQuery(BaseModel):
    query: str


def run_pipeline_sync(ufs: list[str] | None = None, lisa_variables: list[str] | None = None):
    """
    Execute the full analytics pipeline synchronously.
    Called as a background task.
    """
    global pipeline_state

    try:
        pipeline_state["status"] = "running"
        pipeline_state["progress"] = "Starting pipeline..."
        start_time = time.time()

        # Import pipeline modules
        from pipeline.ingestion import run_ingestion
        from pipeline.lisa_analysis import run_lisa
        from pipeline.mcda_trend import run_mcda_trend
        from pipeline.report_data import save_analytics_output

        # Step 1: Data Ingestion
        pipeline_state["progress"] = "Step 1/4: Data ingestion (IBGE + Atlas + S2ID)..."
        logger.info("=" * 60)
        logger.info("STEP 1/4: DATA INGESTION")
        logger.info("=" * 60)
        gdf = run_ingestion(ufs_filter=ufs)

        if gdf.empty or len(gdf) == 0:
            raise ValueError("Ingestion produced empty GeoDataFrame. Check data sources.")

        # Step 2: LISA Spatial Analysis
        pipeline_state["progress"] = f"Step 2/4: LISA spatial analysis ({len(gdf)} municipalities)..."
        logger.info("=" * 60)
        logger.info("STEP 2/4: LISA SPATIAL ANALYSIS")
        logger.info("=" * 60)
        gdf, global_moran = run_lisa(gdf, variables=lisa_variables)

        # Step 3: MCDA Risk Scoring & Trend Analysis
        pipeline_state["progress"] = "Step 3/4: MCDA risk scoring & trend analysis..."
        logger.info("=" * 60)
        logger.info("STEP 3/4: MCDA RISK SCORING & TREND ANALYSIS")
        logger.info("=" * 60)
        gdf = run_mcda_trend(gdf)

        # Step 4: Serialize to JSON
        duration = time.time() - start_time
        pipeline_state["progress"] = "Step 4/4: Saving analytics output..."
        logger.info("=" * 60)
        logger.info("STEP 4/4: SAVING ANALYTICS OUTPUT")
        logger.info("=" * 60)
        outputs = save_analytics_output(gdf, global_moran, pipeline_duration=duration)

        pipeline_state["status"] = "completed"
        pipeline_state["last_run"] = datetime.now().isoformat()
        pipeline_state["last_duration"] = round(duration, 2)
        pipeline_state["last_error"] = None
        pipeline_state["progress"] = f"Completed in {duration:.1f}s"

        logger.info("=" * 60)
        logger.info(f"PIPELINE COMPLETE in {duration:.1f}s")
        logger.info(f"Output files: {list(outputs.keys())}")
        logger.info("=" * 60)

    except Exception as e:
        pipeline_state["status"] = "error"
        pipeline_state["last_error"] = str(e)
        pipeline_state["progress"] = f"Error: {str(e)}"
        logger.error(f"Pipeline failed: {e}", exc_info=True)


@app.post("/pipeline/run")
async def trigger_pipeline(
    request: PipelineRequest,
    background_tasks: BackgroundTasks,
):
    """Trigger the full analytics pipeline as a background task."""
    if pipeline_state["status"] == "running":
        raise HTTPException(
            status_code=409,
            detail="Pipeline is already running. Check /pipeline/status for progress.",
        )

    background_tasks.add_task(
        run_pipeline_sync,
        ufs=request.ufs,
        lisa_variables=request.lisa_variables,
    )

    return {
        "success": True,
        "message": "Pipeline started in background",
        "status": "running",
    }


@app.get("/pipeline/status")
async def get_pipeline_status():
    """Check pipeline execution status."""
    # Check for existing output files
    output_files = {}
    if ANALYTICS_OUTPUT_DIR.exists():
        for f in ANALYTICS_OUTPUT_DIR.iterdir():
            if f.is_file():
                output_files[f.name] = {
                    "size_kb": round(f.stat().st_size / 1024, 1),
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                }

    return {
        "success": True,
        "pipeline": pipeline_state,
        "outputFiles": output_files,
    }


@app.post("/georag/query")
async def georag_query(request: GeoRAGQuery):
    """Execute a natural language geospatial query via GeoRAG."""
    try:
        from georag.engine import GeoRAGEngine

        engine = GeoRAGEngine.get_instance()
        result = engine.query(request.query)

        return {
            "success": True,
            "data": result,
        }
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=f"Analytics data not found. Run the pipeline first. {e}",
        )
    except Exception as e:
        logger.error(f"GeoRAG query failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"GeoRAG query failed: {str(e)}",
        )


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    has_data = (ANALYTICS_OUTPUT_DIR / "risk_analysis.json").exists()
    return {
        "status": "healthy",
        "service": "s2id-analytics",
        "analyticsDataAvailable": has_data,
        "pipelineStatus": pipeline_state["status"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=FASTAPI_HOST,
        port=FASTAPI_PORT,
        reload=True,
        log_level="info",
    )
