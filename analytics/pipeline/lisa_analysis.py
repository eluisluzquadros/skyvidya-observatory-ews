"""
S2ID Analytics Pipeline - LISA Spatial Autocorrelation Analysis
Port of Notebook 01: 01_analise_mdr_s2id_lisa_v2.ipynb

Performs Local Indicators of Spatial Association (LISA) analysis
using Local Moran's I to identify hot spots, cold spots, and spatial outliers.
"""

import logging
from typing import Literal

import numpy as np
import pandas as pd
import geopandas as gpd
from libpysal import weights
from esda import Moran, Moran_Local

from config import LISA_CONFIG, LISA_QUADRANT_LABELS, LISA_SPOT_LABELS

logger = logging.getLogger(__name__)


def calculate_spatial_weights(
    gdf: gpd.GeoDataFrame,
    weight_type: Literal["queen", "rook", "knn"] = "queen",
    k: int = 8,
    id_variable: str | None = None,
) -> weights.W:
    """
    Construct a spatial weight matrix from a GeoDataFrame.

    Args:
        gdf: GeoDataFrame with valid geometries
        weight_type: Type of spatial weights (queen, rook, or knn)
        k: Number of neighbors for KNN
        id_variable: Column name to use as IDs (defaults to CD_MUN if available)

    Returns:
        Row-standardized spatial weight matrix
    """
    logger.info(f"Calculating spatial weights (type={weight_type}, k={k})...")

    if id_variable is None and "CD_MUN" in gdf.columns:
        id_variable = "CD_MUN"

    if weight_type == "queen":
        w = weights.Queen.from_dataframe(gdf, idVariable=id_variable)
    elif weight_type == "rook":
        w = weights.Rook.from_dataframe(gdf, idVariable=id_variable)
    elif weight_type == "knn":
        w = weights.KNN.from_dataframe(gdf, k=k, idVariable=id_variable)
    else:
        raise ValueError(f"Unknown weight type: {weight_type}")

    w.transform = "R"  # Row-standardize
    logger.info(
        f"Weights computed: {w.n} observations, "
        f"mean neighbors: {w.mean_neighbors:.1f}"
    )
    return w


def detect_lisa_variables(gdf: gpd.GeoDataFrame) -> list[str]:
    """
    Auto-detect columns suitable for LISA analysis.
    Selects columns containing 'COUNT' or 'POR_10K_HAB' with numeric values.
    """
    candidates = []
    for col in gdf.columns:
        if ("COUNT" in col.upper() or "POR_10K_HAB" in col.upper()):
            if pd.api.types.is_numeric_dtype(gdf[col]):
                # Skip columns that are all zeros
                if gdf[col].sum() > 0:
                    candidates.append(col)
    logger.info(f"Detected {len(candidates)} variables for LISA analysis")
    return candidates


def perform_lisa_analysis(
    gdf: gpd.GeoDataFrame,
    variables: list[str],
    w: weights.W,
    p_threshold: float = 0.05,
    permutations: int = 999,
    seed: int = 12345,
) -> gpd.GeoDataFrame:
    """
    Perform LISA (Local Moran's I) analysis for multiple variables.

    For each variable, computes:
    - Global Moran's I (overall spatial autocorrelation)
    - Local Moran's I for each municipality
    - Quadrant classification (HH, LH, LL, HL)
    - Significance testing via permutations
    - Spatial lag values

    Args:
        gdf: GeoDataFrame with municipalities and disaster metrics
        variables: List of column names to analyze
        w: Spatial weight matrix
        p_threshold: Significance threshold for cluster identification
        permutations: Number of permutations for significance testing
        seed: Random seed for reproducibility

    Returns:
        GeoDataFrame with LISA results columns added for each variable
    """
    result = gdf.copy()
    total = len(variables)
    global_results = []

    for i, var in enumerate(variables):
        if var not in result.columns:
            logger.warning(f"Variable '{var}' not found in GeoDataFrame, skipping")
            continue

        if not pd.api.types.is_numeric_dtype(result[var]):
            logger.warning(f"Variable '{var}' is not numeric, skipping")
            continue

        logger.info(f"LISA analysis [{i+1}/{total}]: {var}")

        values = result[var].fillna(0).values

        # Skip if all values are the same (no variance)
        if np.std(values) == 0:
            logger.warning(f"Variable '{var}' has zero variance, skipping")
            continue

        try:
            # Global Moran's I
            moran_global = Moran(values, w, permutations=permutations)
            global_results.append({
                "variable": var,
                "moran_I": float(moran_global.I),
                "p_value": float(moran_global.p_sim),
                "z_score": float(moran_global.z_sim),
                "significant": bool(moran_global.p_sim < p_threshold),
            })
            logger.info(
                f"  Global Moran's I: {moran_global.I:.4f} "
                f"(p={moran_global.p_sim:.4f})"
            )

            # Local Moran's I
            lisa = Moran_Local(values, w, permutations=permutations, seed=seed)

            # Store results
            result[f"{var}_lisa_I"] = lisa.Is
            result[f"{var}_lisa_p_sim"] = lisa.p_sim
            result[f"{var}_lisa_sig"] = lisa.p_sim < p_threshold

            # Quadrant classification (1=HH, 2=LH, 3=LL, 4=HL)
            result[f"{var}_lisa_q_code"] = lisa.q

            # Map quadrant codes to labels
            result[f"{var}_lisa_q"] = pd.Series(lisa.q).map(
                LISA_QUADRANT_LABELS
            ).fillna("N/A")

            # Cluster labels (significant only)
            labels = []
            for q, sig in zip(lisa.q, lisa.p_sim < p_threshold):
                if not sig:
                    labels.append(LISA_SPOT_LABELS[0])  # Not significant
                else:
                    labels.append(LISA_SPOT_LABELS[q])
            result[f"{var}_lisa_labels"] = labels

            # Spatial lag
            result[f"w_{var}"] = weights.lag_spatial(w, values)

        except Exception as e:
            logger.error(f"Error in LISA analysis for '{var}': {e}")
            continue

    logger.info(
        f"LISA analysis complete: {len(global_results)} variables analyzed, "
        f"{result.shape[1]} total columns"
    )

    return result, global_results


def run_lisa(
    gdf: gpd.GeoDataFrame,
    variables: list[str] | None = None,
    weight_type: str | None = None,
    k: int | None = None,
    p_threshold: float | None = None,
) -> tuple[gpd.GeoDataFrame, list[dict]]:
    """
    Execute the full LISA analysis pipeline.

    Args:
        gdf: GeoDataFrame from ingestion pipeline
        variables: Specific variables to analyze (auto-detects if None)
        weight_type: Override default weight type
        k: Override default KNN k
        p_threshold: Override default p-value threshold

    Returns:
        Tuple of (enriched GeoDataFrame, global Moran's I results)
    """
    # Validate and repair geometries — never drop municipalities
    invalid_mask = ~gdf.geometry.is_valid | gdf.geometry.is_empty
    invalid_count = invalid_mask.sum()
    if invalid_count > 0:
        bad = gdf.loc[invalid_mask, ["CD_MUN"] + [c for c in ["NM_MUN", "NM_MUN_SEM_ACENTO", "SIGLA_UF"] if c in gdf.columns]]
        logger.warning(
            f"{invalid_count} invalid/empty geometries — attempting buffer(0) repair\n"
            f"  Affected: {bad.to_dict('records')}"
        )
        gdf = gdf.copy()
        gdf.loc[invalid_mask, "geometry"] = (
            gdf.loc[invalid_mask, "geometry"].buffer(0)
        )
        # If still invalid after repair, replace with centroid buffer as last resort
        still_invalid = ~gdf.geometry.is_valid | gdf.geometry.is_empty
        if still_invalid.sum() > 0:
            logger.warning(
                f"{still_invalid.sum()} geometries still invalid after buffer(0) — "
                "using convex_hull fallback (municipality kept in analysis)"
            )
            gdf.loc[still_invalid, "geometry"] = (
                gdf.loc[still_invalid, "geometry"].convex_hull
            )

    # Auto-detect variables if not specified
    if variables is None:
        variables = detect_lisa_variables(gdf)

    if not variables:
        logger.warning("No variables to analyze")
        return gdf, []

    # Calculate spatial weights
    wt = weight_type or LISA_CONFIG["DEFAULT_WEIGHT_TYPE"]
    kk = k or LISA_CONFIG["DEFAULT_KNN_K"]
    pt = p_threshold or LISA_CONFIG["DEFAULT_P_VALUE_THRESHOLD"]
    perms = LISA_CONFIG["DEFAULT_PERMUTATIONS"]
    seed = LISA_CONFIG["SEED"]

    w = calculate_spatial_weights(gdf, weight_type=wt, k=kk)

    # Run LISA
    result, global_results = perform_lisa_analysis(
        gdf, variables, w, p_threshold=pt, permutations=perms, seed=seed
    )

    return result, global_results
