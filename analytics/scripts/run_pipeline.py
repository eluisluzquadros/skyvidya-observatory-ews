"""
S2ID Analytics Pipeline - CLI Runner

Execute the full analytics pipeline from command line.

Usage:
    python scripts/run_pipeline.py
    python scripts/run_pipeline.py --ufs RS SC PR
    python scripts/run_pipeline.py --ufs RS --lisa-vars LAST10_YEARS_COUNT LAST05_YEARS_COUNT
"""

import argparse
import logging
import sys
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pipeline")


def main():
    parser = argparse.ArgumentParser(description="S2ID Analytics Pipeline Runner")
    parser.add_argument(
        "--ufs",
        nargs="*",
        default=None,
        help="Filter by UF codes (e.g., RS SC PR). Default: all states.",
    )
    parser.add_argument(
        "--lisa-vars",
        nargs="*",
        default=None,
        help="Specific LISA variables to analyze. Default: auto-detect.",
    )
    parser.add_argument(
        "--skip-lisa",
        action="store_true",
        help="Skip LISA spatial analysis (faster, but no cluster data).",
    )
    args = parser.parse_args()

    start_time = time.time()

    try:
        from pipeline.ingestion import run_ingestion
        from pipeline.lisa_analysis import run_lisa
        from pipeline.mcda_trend import run_mcda_trend
        from pipeline.report_data import save_analytics_output
        from pipeline.reporting_charts import run_reporting
        from config import COLUMNS_FOR_RISK_SCORE_MCDA, REPORTING_CONFIG

        # Step 1: Ingestion
        logger.info("=" * 60)
        logger.info("STEP 1: DATA INGESTION")
        logger.info("=" * 60)
        gdf = run_ingestion(ufs_filter=args.ufs)

        if gdf.empty:
            logger.error("Ingestion produced empty result. Check data sources.")
            sys.exit(1)

        # Step 2: LISA — default to 8 core MCDA variables for performance
        global_moran = []
        if not args.skip_lisa:
            lisa_variables = args.lisa_vars or COLUMNS_FOR_RISK_SCORE_MCDA
            logger.info("=" * 60)
            logger.info("STEP 2: LISA SPATIAL ANALYSIS")
            logger.info(f"  Variables: {lisa_variables}")
            logger.info("=" * 60)
            gdf, global_moran = run_lisa(gdf, variables=lisa_variables)
        else:
            logger.info("Skipping LISA analysis (--skip-lisa)")

        # Step 3: MCDA + Trend
        logger.info("=" * 60)
        logger.info("STEP 3: MCDA RISK SCORING & TREND ANALYSIS")
        logger.info("=" * 60)
        gdf = run_mcda_trend(gdf)

        # Step 4: Serialize
        duration = time.time() - start_time
        logger.info("=" * 60)
        logger.info("STEP 4: SAVING OUTPUT")
        logger.info("=" * 60)
        outputs = save_analytics_output(gdf, global_moran, pipeline_duration=duration)

        # Step 5: Reporting charts & assets
        logger.info("=" * 60)
        logger.info("STEP 5: GENERATING REPORT ASSETS")
        logger.info("=" * 60)
        try:
            report_assets = run_reporting(
                gdf,
                output_dir=REPORTING_CONFIG["OUTPUT_DIR"],
                states=REPORTING_CONFIG["STATES_TO_GENERATE"],
                top_n=REPORTING_CONFIG["TOP_N_MUNICIPALITIES"],
                dpi=REPORTING_CONFIG["DPI"],
                lisa_variables=REPORTING_CONFIG["LISA_VARIABLES"],
            )
            logger.info(f"Report assets: {len(report_assets)} files in {REPORTING_CONFIG['OUTPUT_DIR']}")
        except Exception as e:
            logger.warning(f"Report asset generation failed (non-critical): {e}", exc_info=True)
            report_assets = {}

        logger.info("=" * 60)
        logger.info(f"PIPELINE COMPLETE in {duration:.1f}s")
        for name, path in outputs.items():
            size = path.stat().st_size / 1024
            logger.info(f"  {name}: {path} ({size:.0f} KB)")
        logger.info("=" * 60)

    except FileNotFoundError as e:
        logger.error(f"Missing data file: {e}")
        logger.error("Have you run 'python scripts/download_ibge.py' first?")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
