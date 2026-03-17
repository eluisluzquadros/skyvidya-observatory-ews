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
from fastapi.responses import Response
from pydantic import BaseModel

from config import (
    ANALYTICS_OUTPUT_DIR,
    FASTAPI_HOST,
    FASTAPI_PORT,
    UFS_TO_FILTER,
    LLM_REPORTS_DIR,
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


class GeoRAGExportRequest(BaseModel):
    query: str
    format: str = "csv"  # "csv" or "geojson"


class LLMReportRequest(BaseModel):
    cd_mun: str | None = None   # Single municipality (7-digit IBGE code)
    uf: str | None = None       # State (e.g. "RS"); None = national report


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


@app.post("/llm/generate-report")
async def llm_generate_report(request: LLMReportRequest):
    """
    Generate an AI narrative report for a municipality, state, or Brazil.
    Reads from risk_analysis.json and calls Gemini AI.
    Saves the report to server/data/analytics/generated_reports/{scope}_report.json.
    """
    risk_file = ANALYTICS_OUTPUT_DIR / "risk_analysis.json"
    if not risk_file.exists():
        raise HTTPException(
            status_code=404,
            detail="risk_analysis.json not found. Run the analytics pipeline first.",
        )

    try:
        import json
        risk_data = json.loads(risk_file.read_text(encoding="utf-8"))

        from llm_generation import LLMContentGenerator, load_saved_report

        gen = LLMContentGenerator()
        report = gen.generate_full_report(
            risk_data,
            cd_mun=request.cd_mun,
            uf=request.uf,
        )

        # Persist to disk
        scope_key = request.cd_mun or request.uf or "BR"
        out_path = LLM_REPORTS_DIR / f"{scope_key}_report.json"
        out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(f"Saved LLM report: {out_path}")

        return {"success": True, "data": report}

    except EnvironmentError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"LLM report generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@app.get("/llm/report/{scope}")
async def llm_get_report(scope: str):
    """
    Retrieve a previously generated LLM report.
    scope: UF code (e.g. 'RS'), municipality cd_mun, or 'BR' for national.
    """
    report_path = LLM_REPORTS_DIR / f"{scope}_report.json"
    if not report_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"No saved report for scope '{scope}'. Call POST /llm/generate-report first.",
        )
    try:
        import json
        report = json.loads(report_path.read_text(encoding="utf-8"))
        return {"success": True, "data": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read report: {str(e)}")


@app.get("/georag/kepler-config")
async def georag_kepler_config(query: str):
    """
    Return a Kepler.gl config JSON for the results of a GeoRAG query.
    Used by the frontend to render interactive maps.
    """
    try:
        from georag.engine import GeoRAGEngine

        engine = GeoRAGEngine.get_instance()
        result = engine.query(query)
        config = engine.prepare_kepler_config(result["municipalities"])

        return {"success": True, "data": config}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Kepler config failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/georag/export")
async def georag_export(request: GeoRAGExportRequest):
    """
    Execute a GeoRAG query and return results as CSV or GeoJSON download.
    """
    try:
        from georag.engine import GeoRAGEngine

        engine = GeoRAGEngine.get_instance()
        result = engine.query(request.query)
        municipalities = result["municipalities"]

        if request.format == "csv":
            csv_data = engine.export_results_csv(municipalities)
            return Response(
                content=csv_data,
                media_type="text/csv; charset=utf-8",
                headers={"Content-Disposition": "attachment; filename=\"georag_results.csv\""},
            )
        elif request.format == "geojson":
            import json as _json
            geojson = engine.export_results_geojson(municipalities)
            return Response(
                content=_json.dumps(geojson, ensure_ascii=False),
                media_type="application/geo+json",
                headers={"Content-Disposition": "attachment; filename=\"georag_results.geojson\""},
            )
        else:
            raise HTTPException(status_code=400, detail="format must be 'csv' or 'geojson'")

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GeoRAG export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
