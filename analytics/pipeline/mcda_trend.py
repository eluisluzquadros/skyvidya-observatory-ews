"""
S2ID Analytics Pipeline - MCDA Risk Scoring & Trend Analysis
Port of Notebook 02: 02_analise_mdr_s2id_tendencia_v2.ipynb

Performs Multi-Criteria Decision Analysis (MCDA) for risk scoring,
trend detection (Crescente/Estavel/Decrescente), and principal
threat identification per municipality.
"""

import logging

import numpy as np
import pandas as pd
import geopandas as gpd
from sklearn.preprocessing import MinMaxScaler

from config import (
    COBRADE_MAP,
    COBRADES_OF_INTEREST,
    COLUMNS_FOR_RISK_SCORE_MCDA,
    RISK_CATEGORIES,
)

logger = logging.getLogger(__name__)


def identify_main_threat(
    df: pd.DataFrame | gpd.GeoDataFrame,
    cobrade_map: dict = COBRADE_MAP,
    cobrade_codes: list[str] = COBRADES_OF_INTEREST,
    timeframe_prefix: str = "LAST10_YEARS_COUNT",
) -> pd.Series:
    """
    Identify the principal threat (dominant disaster type) per municipality.

    Strategy:
    1. Use `timeframe_prefix` count columns (default: LAST10_YEARS) to rank threats.
    2. If a municipality has zero events in that timeframe, fall back to HISTORIC_COUNT
       (captures events older than 10 years that would otherwise be invisible).
    3. When counts are tied, break the tie using impact:
       score = count * (1 + log1p(total_human_damage))
       where damage comes from HISTORIC_IMPACT_DANOS_{code} columns, if available.

    Returns:
        Series with threat names per municipality.
    """
    logger.info(f"Identifying main threats using {timeframe_prefix} (with HISTORIC fallback + impact weighting)...")

    # ── Step 1: primary count columns (e.g. LAST10_YEARS_COUNT_{code}) ──
    primary_cols = [f"{timeframe_prefix}_{code}" for code in cobrade_codes]
    existing_primary = [c for c in primary_cols if c in df.columns]

    if not existing_primary:
        logger.warning(
            f"No threat columns found for prefix '{timeframe_prefix}'. "
            f"Returning 'Nenhuma Ameaça Dominante' for all municipalities."
        )
        return pd.Series(["Nenhuma Ameaça Dominante"] * len(df), index=df.index)

    count_data = df[existing_primary].copy().fillna(0)

    # ── Step 2: fallback to HISTORIC_COUNT for rows with all-zero primary ──
    all_zero_primary = count_data.max(axis=1) == 0
    if all_zero_primary.any():
        historic_cols = [f"HISTORIC_COUNT_{code}" for code in cobrade_codes]
        existing_historic = [c for c in historic_cols if c in df.columns]
        if existing_historic:
            historic_data = df.loc[all_zero_primary, existing_historic].fillna(0)
            # Rename historic columns to match the count_data column order by code suffix
            rename_map = {
                f"HISTORIC_COUNT_{code}": f"{timeframe_prefix}_{code}"
                for code in cobrade_codes
                if f"HISTORIC_COUNT_{code}" in existing_historic
                and f"{timeframe_prefix}_{code}" in existing_primary
            }
            historic_data = historic_data.rename(columns=rename_map)
            for col in count_data.columns:
                if col in historic_data.columns:
                    count_data.loc[all_zero_primary, col] = historic_data[col].values
            n_fallback = int(all_zero_primary.sum())
            logger.info(f"  Fallback to HISTORIC_COUNT for {n_fallback} municipalities with no recent events")

    # ── Step 3: impact-weighted score = count × (1 + log1p(afetados)) ──
    # Uses HISTORIC_IMPACT_DANOS_{code} columns if available
    impact_cols = {
        code: f"HISTORIC_IMPACT_DANOS_{code}"
        for code in cobrade_codes
        if f"HISTORIC_IMPACT_DANOS_{code}" in df.columns
    }

    if impact_cols:
        score_data = count_data.copy()
        for code in cobrade_codes:
            primary_col = f"{timeframe_prefix}_{code}"
            impact_col  = f"HISTORIC_IMPACT_DANOS_{code}"
            if primary_col in score_data.columns and impact_col in df.columns:
                impact = df[impact_col].fillna(0)
                score_data[primary_col] = score_data[primary_col] * (1 + np.log1p(impact))
        max_col = score_data.idxmax(axis=1)
    else:
        max_col = count_data.idxmax(axis=1)

    has_threat = count_data.max(axis=1) > 0

    # Extract COBRADE code from column name (last token after underscore)
    codes = max_col.str.rsplit("_", n=1).str[-1]
    threat_names = codes.map(cobrade_map).fillna("Outro")

    result = np.where(has_threat, threat_names, "Nenhuma Ameaça Dominante")
    return pd.Series(result, index=df.index)


def calculate_mcda_risk_score(
    df: pd.DataFrame | gpd.GeoDataFrame,
    criteria_columns: list[str] = COLUMNS_FOR_RISK_SCORE_MCDA,
    score_col: str = "Risco_Ampliado_MCDA_Score",
    category_col: str = "Risco_Ampliado_MCDA_Cat",
    categories: list[str] = RISK_CATEGORIES,
) -> pd.DataFrame | gpd.GeoDataFrame:
    """
    Calculate MCDA risk score using MinMax normalization and equal weighting.

    Steps:
    1. Select the 8 criteria columns (counts + per-capita rates)
    2. Fill NaN with 0
    3. Normalize each criterion to [0, 1] range using MinMaxScaler
    4. Calculate arithmetic mean of normalized values
    5. Categorize into 5 quantile-based risk levels

    Args:
        df: DataFrame with disaster statistics columns
        criteria_columns: List of column names to use as MCDA criteria
        score_col: Name for the output score column
        category_col: Name for the output category column
        categories: List of risk category labels (lowest to highest)

    Returns:
        DataFrame with added score and category columns
    """
    logger.info("Calculating MCDA risk score...")
    result = df.copy()

    existing_criteria = [c for c in criteria_columns if c in result.columns]
    if not existing_criteria:
        logger.error("No MCDA criteria columns found in DataFrame")
        result[score_col] = 0.0
        result[category_col] = categories[0]
        return result

    logger.info(f"Using {len(existing_criteria)} criteria: {existing_criteria}")

    # Prepare data
    score_data = result[existing_criteria].copy().fillna(0)

    # MinMax normalization
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(score_data)

    # Average normalized score
    result[score_col] = scaled.mean(axis=1)

    # Categorize into risk levels using quantiles
    try:
        result[category_col] = pd.qcut(
            result[score_col],
            q=len(categories),
            labels=categories,
            duplicates="drop",
        )
    except ValueError:
        # Fallback to pd.cut if qcut fails due to too many duplicate edges
        logger.warning("qcut failed, falling back to pd.cut with equal intervals")
        result[category_col] = pd.cut(
            result[score_col],
            bins=len(categories),
            labels=categories,
            include_lowest=True,
        )

    # Fill any remaining NaN categories
    result[category_col] = result[category_col].fillna(categories[0])

    # Log distribution
    dist = result[category_col].value_counts()
    for cat in categories:
        count = dist.get(cat, 0)
        logger.info(f"  {cat}: {count} municipalities")

    return result


def analyze_disaster_trend(
    df: pd.DataFrame | gpd.GeoDataFrame,
    col_10yr: str = "LAST10_YEARS_COUNT",
    col_05yr: str = "LAST05_YEARS_COUNT",
    col_02yr: str = "LAST02_YEARS_COUNT",
    trend_col: str = "Tendencia_Eventos_Climaticos_Extremos",
) -> pd.DataFrame | gpd.GeoDataFrame:
    """
    Detect disaster trend by comparing growth rates across time windows.

    Logic:
    - Growth_10a_5a = count_10yr - count_5yr (events in the 10-5 year window)
    - Growth_5a_2a = count_5yr - count_2yr (events in the 5-2 year window)
    - If Growth_5a_2a > Growth_10a_5a: "Crescente" (recent acceleration)
    - If Growth_5a_2a < Growth_10a_5a: "Decrescente" (recent deceleration)
    - If equal: "Estável"

    Args:
        df: DataFrame with temporal count columns
        col_10yr, col_05yr, col_02yr: Column names for time periods
        trend_col: Name for the output trend column

    Returns:
        DataFrame with added trend column
    """
    logger.info("Analyzing disaster trends...")
    result = df.copy()

    for col in [col_10yr, col_05yr, col_02yr]:
        if col not in result.columns:
            logger.warning(f"Column '{col}' not found, filling with 0")
            result[col] = 0

    # Calculate growth differences between periods
    growth_early = result[col_10yr] - result[col_05yr]  # Older period growth
    growth_recent = result[col_05yr] - result[col_02yr]  # Recent period growth

    def _determine_trend(row_idx):
        early = growth_early.iloc[row_idx]
        recent = growth_recent.iloc[row_idx]
        if recent > early:
            return "Crescente"
        elif recent < early:
            return "Decrescente"
        return "Estável"

    result[trend_col] = [_determine_trend(i) for i in range(len(result))]

    # Log distribution
    dist = result[trend_col].value_counts()
    for trend in ["Crescente", "Estável", "Decrescente"]:
        count = dist.get(trend, 0)
        logger.info(f"  {trend}: {count} municipalities")

    return result


def run_mcda_trend(
    gdf: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    """
    Execute the full MCDA risk scoring and trend analysis pipeline.

    1. Identify principal threat per municipality
    2. Calculate MCDA risk score (8 criteria, MinMax, 5 categories)
    3. Analyze disaster trend (Crescente/Estavel/Decrescente)

    Args:
        gdf: GeoDataFrame from LISA analysis pipeline

    Returns:
        GeoDataFrame with added columns:
        - principal_ameaca: Primary threat type name
        - Risco_Ampliado_MCDA_Score: Risk score [0, 1]
        - Risco_Ampliado_MCDA_Cat: Risk category label
        - Tendencia_Eventos_Climaticos_Extremos: Trend direction
    """
    # Step 1: Identify main threat
    gdf["principal_ameaca"] = identify_main_threat(gdf)

    # Step 2: Calculate MCDA risk score
    gdf = calculate_mcda_risk_score(gdf)

    # Step 3: Analyze trend
    gdf = analyze_disaster_trend(gdf)

    logger.info(
        f"MCDA/Trend analysis complete. "
        f"Final shape: {gdf.shape[0]} rows x {gdf.shape[1]} columns"
    )

    return gdf
