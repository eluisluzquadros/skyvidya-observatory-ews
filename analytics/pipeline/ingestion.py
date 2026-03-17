"""
S2ID Analytics Pipeline - Data Ingestion Module
Port of Notebook 00: 00_ingestao_mdr_s2id_v2.ipynb

Reads existing Atlas CSV data (already collected by the Express.js backend),
loads IBGE municipality boundaries, performs COBRADE taxonomy mapping,
temporal aggregation, and population-normalized rate calculations.
"""

import os
import glob
import logging
import re
from datetime import datetime, timedelta
from functools import reduce
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd
from unidecode import unidecode

from config import (
    ATLAS_DATA_DIR,
    S2ID_DATA_DIR,
    IBGE_DATA_DIR,
    IBGE_GEOPARQUET_FILENAME,
    COBRADE_MAP,
    COBRADES_OF_INTEREST,
    PERIODS_CONFIG,
    DEFAULT_VALIDITY_DAYS,
    UFS_TO_FILTER,
    GEOJSON_SIMPLIFY_TOLERANCE,
)

logger = logging.getLogger(__name__)


def read_geoparquet_municipios(
    path: Path,
    filename: str,
    ufs_of_interest: list[str] | None = None,
) -> gpd.GeoDataFrame:
    """
    Load IBGE municipality boundaries from GeoParquet and preprocess names.
    """
    file_path = path / filename
    logger.info(f"Reading municipality data from: {file_path}")

    if not file_path.exists():
        raise FileNotFoundError(
            f"IBGE GeoParquet not found at {file_path}. "
            f"Run 'python scripts/download_ibge.py' first."
        )

    municipios = gpd.read_parquet(str(file_path))

    if ufs_of_interest:
        municipios = municipios[municipios["SIGLA_UF"].isin(ufs_of_interest)]
        logger.info(f"Filtered to {len(municipios)} municipalities in UFs: {ufs_of_interest}")

    municipios["NM_MUN_SEM_ACENTO"] = (
        municipios["NM_MUN"].apply(unidecode).str.upper()
    )

    # Drop unnecessary columns if present
    drop_cols = ["index", "CENSO_2010_POP", "TX_CRESC", "VAR_ABS", "h3_polyfill"]
    municipios = municipios.drop(
        columns=[c for c in drop_cols if c in municipios.columns], errors="ignore"
    )

    return municipios


def dissolve_municipalities(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Dissolve multi-part municipality geometries by CD_MUN code.
    """
    dissolved = gdf.copy().dissolve(by="CD_MUN").reset_index()
    if "h3_polyfill" in dissolved.columns:
        dissolved = dissolved.drop(columns=["h3_polyfill"])
    return dissolved


def find_atlas_csv() -> str | None:
    """
    Find the Atlas CSV file in the existing server data directory.
    Searches for atlas_data.csv or any CSV in the atlas directory.
    """
    # Check for the standard file first
    standard_path = ATLAS_DATA_DIR / "atlas_data.csv"
    if standard_path.exists():
        return str(standard_path)

    # Search for any CSV file in the atlas directory
    if ATLAS_DATA_DIR.exists():
        csv_files = list(ATLAS_DATA_DIR.glob("*.csv"))
        if csv_files:
            return str(csv_files[0])

    return None


def find_s2id_csvs() -> list[str]:
    """
    Find S2ID report CSV files in the existing server data directory.
    """
    if not S2ID_DATA_DIR.exists():
        return []
    return [str(f) for f in S2ID_DATA_DIR.glob("*.csv")]


def read_s2id_report_files(
    file_paths: list[str],
    header: int = 1,
    skiprows: int = 3,
    sep: str = ";",
    encoding: str = "ISO-8859-1",
) -> pd.DataFrame:
    """
    Read and aggregate multiple S2ID report CSV files into a single DataFrame.
    """
    if not file_paths:
        logger.warning("No S2ID report files found")
        return pd.DataFrame()

    dfs = []
    for f in file_paths:
        try:
            df = pd.read_csv(f, header=header, skiprows=skiprows, sep=sep,
                             encoding=encoding, low_memory=False)
            dfs.append(df)
            logger.info(f"Read S2ID report: {f} ({len(df)} rows)")
        except Exception as e:
            logger.warning(f"Error reading {f}: {e}")

    if not dfs:
        return pd.DataFrame()

    return pd.concat(dfs, ignore_index=True)


def transform_s2id_data(df: pd.DataFrame, source_type: str = "atlas") -> pd.DataFrame:
    """
    Transform S2ID data: normalize columns, parse dates, extract COBRADE codes.

    Args:
        df: Raw DataFrame from S2ID source
        source_type: "atlas" for Atlas Digital CSV, "report" for S2ID reports
    """
    if df.empty:
        return df

    logger.info(f"Transforming S2ID data (source: {source_type}, {len(df)} rows)...")
    result = df.copy()

    # Normalize column names (remove accents, uppercase)
    result.columns = (
        result.columns.str.normalize("NFKD")
        .str.encode("ascii", errors="ignore")
        .str.decode("utf-8")
    )
    result.columns = [c.upper() for c in result.columns]

    if source_type == "report":
        if "REGISTRO" in result.columns:
            result["DATA_REGISTRO"] = pd.to_datetime(
                result["REGISTRO"], dayfirst=True, errors="coerce"
            )
        else:
            result["DATA_REGISTRO"] = pd.NaT

        if "PROTOCOLO" in result.columns:
            result["CD_MUN"] = result["PROTOCOLO"].astype(str).str[5:12]

        if "COBRADE" in result.columns:
            result["COD_COBRADE"] = result["COBRADE"].astype(str).str[0:5]
            result["COBRADE_NAME"] = result["COBRADE"].astype(str).str[7:]

        result = result.rename(
            columns={"UF": "SIGLA_UF", "MUNICIPIO": "NM_MUN"}, errors="ignore"
        )

    elif source_type == "atlas":
        rename_map = {
            "PROTOCOLO_S2ID": "PROTOCOLO",
            "NOME_MUNICIPIO": "NM_MUN",
            "CD_IBGE_MUN": "CD_MUN",
            "DM_UNI_HABITA_DANIFICADAS": "DM_UNIDADES_HABITACIONAIS_DANIFICADAS",
        }
        result = result.rename(columns=rename_map, errors="ignore")

        if "COD_COBRADE" in result.columns:
            result["COD_COBRADE"] = (
                result["COD_COBRADE"]
                .astype(str)
                .str.strip()
                .str.replace(r"\.0$", "", regex=True)
            )

        if "CD_MUN" in result.columns:
            result["CD_MUN"] = (
                result["CD_MUN"]
                .astype(str)
                .str.strip()
                .str.replace(r"\.0$", "", regex=True)
            )

        cols_to_drop = [
            "REGIAO", "SETORES_CENSITARIOS", "DH_DESCRICAO",
            "DM_DESCRICAO", "DA_DESCRICAO", "PEPL_DESCRICAO", "PEPR_DESCRICAO",
        ]
        result = result.drop(
            columns=[c for c in cols_to_drop if c in result.columns], errors="ignore"
        )

        for date_col in ["DATA_REGISTRO", "DATA_EVENTO"]:
            if date_col in result.columns:
                result[date_col] = pd.to_datetime(
                    result[date_col], dayfirst=True, errors="coerce"
                )

    # Extract year/month from registration date
    if "DATA_REGISTRO" in result.columns and pd.api.types.is_datetime64_any_dtype(
        result["DATA_REGISTRO"]
    ):
        result["ANO"] = result["DATA_REGISTRO"].dt.year
        result["MES"] = result["DATA_REGISTRO"].dt.month
        result = result.sort_values(by="DATA_REGISTRO", ascending=True)

    # Normalize municipality names (remove accents, uppercase)
    if "NM_MUN" in result.columns:
        result["NM_MUN_SEM_ACENTO"] = (
            result["NM_MUN"].apply(lambda x: unidecode(str(x))).str.upper()
        )

    return result


def get_cobrade_details(
    df_main: pd.DataFrame,
    df_reference: pd.DataFrame,
    cobrade_col: str = "COD_COBRADE",
    details_cols: list[str] | None = None,
) -> pd.DataFrame:
    """
    Enrich a DataFrame with COBRADE taxonomy details from a reference DataFrame.
    """
    if details_cols is None:
        details_cols = ["TIPOLOGIA", "DESCRICAO_TIPOLOGIA", "GRUPO_DE_DESASTRE"]

    if cobrade_col not in df_main.columns or cobrade_col not in df_reference.columns:
        return df_main

    result = df_main.copy()
    ref = df_reference.copy()

    # Normalize COBRADE codes
    result[cobrade_col] = (
        result[cobrade_col].astype(str).str.strip().str.replace(r"\.0$", "", regex=True)
    )
    ref[cobrade_col] = (
        ref[cobrade_col].astype(str).str.strip().str.replace(r"\.0$", "", regex=True)
    )

    existing_cols = [c for c in details_cols if c in ref.columns]
    if not existing_cols:
        return result

    ref_unique = ref[[cobrade_col] + existing_cols].drop_duplicates(
        subset=[cobrade_col], keep="first"
    )

    return result.merge(ref_unique, on=cobrade_col, how="left", suffixes=("", "_ref"))


def clean_value_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean monetary and population value columns (Brazilian number format).
    """
    keywords = ["VALOR", "R$", "POP", "CUSTO"]

    def _clean(value):
        if isinstance(value, str):
            cleaned = "".join(c for c in value if c.isdigit() or c in ".,")
            cleaned = cleaned.replace(",", ".")
            try:
                return float(cleaned)
            except ValueError:
                return np.nan
        elif pd.isna(value):
            return np.nan
        return value

    for kw in keywords:
        for col in df.columns:
            if kw.upper() in col.upper() and df[col].dtype == "object":
                df[col] = df[col].apply(_clean)

    return df


def summarize_disasters_by_period(
    df: pd.DataFrame,
    periods_config: dict,
    cobrades_of_interest: list[str] | None = None,
    validity_days: int = DEFAULT_VALIDITY_DAYS,
    date_col: str = "DATA_REGISTRO",
) -> pd.DataFrame:
    """
    Aggregate disaster events by time period and COBRADE code.
    """
    logger.info("Summarizing disasters by period...")
    result = df.copy()
    group_cols = ["COD_COBRADE", "SIGLA_UF", "NM_MUN_SEM_ACENTO", "VALIDITY"]

    # Filter by COBRADE codes of interest
    if cobrades_of_interest and "COD_COBRADE" in result.columns:
        codes = [
            str(c).strip().replace(".0", "") for c in cobrades_of_interest
        ]
        result["COD_COBRADE"] = (
            result["COD_COBRADE"].astype(str).str.strip().str.replace(r"\.0$", "", regex=True)
        )
        result = result[result["COD_COBRADE"].isin(codes)]

    # Calculate validity flag
    if date_col in result.columns and pd.api.types.is_datetime64_any_dtype(result[date_col]):
        cutoff = datetime.now() - timedelta(days=validity_days)
        result["VALIDITY"] = result[date_col].apply(
            lambda x: "Sim" if pd.notnull(x) and x >= cutoff else "Não"
        )
    else:
        result["VALIDITY"] = "Indeterminado"

    period_summaries = []
    for period_name, (years_back, offset) in periods_config.items():
        if date_col not in result.columns or not pd.api.types.is_datetime64_any_dtype(
            result[date_col]
        ):
            continue

        start_date = datetime.now() - timedelta(days=365.25 * years_back)
        end_date = datetime.now() if offset == 0 else datetime.now() - timedelta(
            days=365.25 * offset
        )

        period_df = result[
            (result[date_col] >= start_date) & (result[date_col] <= end_date)
        ]

        valid_group_cols = [c for c in group_cols if c in period_df.columns]
        if not valid_group_cols:
            continue

        agg = period_df.groupby(valid_group_cols).size().reset_index(
            name=f"{period_name}_COUNT"
        )
        period_summaries.append(agg)

    if not period_summaries:
        return pd.DataFrame()

    if len(period_summaries) == 1:
        return period_summaries[0].fillna(0)

    merge_cols = [c for c in group_cols if c in period_summaries[0].columns]

    def safe_merge(df1, df2):
        common = [c for c in merge_cols if c in df1.columns and c in df2.columns]
        if not common:
            return df1
        return pd.merge(df1, df2, on=common, how="outer")

    return reduce(safe_merge, period_summaries).fillna(0)


def aggregate_and_pivot_summary(
    summary_df: pd.DataFrame,
    municipios_pop_df: gpd.GeoDataFrame,
    periods_config: dict,
    pop_col: str = "CENSO_2020_POP",
) -> pd.DataFrame:
    """
    Aggregate summary by municipality, calculate per-capita rates, and pivot by COBRADE.
    """
    if summary_df.empty:
        return pd.DataFrame()

    logger.info("Aggregating summary, calculating per-capita rates, pivoting by COBRADE...")

    count_cols = [
        f"{p}_COUNT" for p in periods_config if f"{p}_COUNT" in summary_df.columns
    ]
    group_cols = ["SIGLA_UF", "NM_MUN_SEM_ACENTO"]

    # Aggregate by municipality (sum across COBRADEs)
    agg_funcs = {col: "sum" for col in count_cols}
    by_city = summary_df.groupby(group_cols).agg(agg_funcs).reset_index()

    # Merge with population data
    pop_data = municipios_pop_df[["SIGLA_UF", "NM_MUN_SEM_ACENTO", pop_col]].copy()
    by_city = by_city.merge(pop_data, on=group_cols, how="left")
    by_city[pop_col] = pd.to_numeric(by_city[pop_col], errors="coerce").fillna(0)

    # Calculate per-capita rates (per 10K inhabitants)
    for col in count_cols:
        by_city[f"{col}_POR_10K_HAB"] = np.where(
            by_city[pop_col] > 0,
            (by_city[col] / by_city[pop_col]) * 10000,
            0,
        )

    # Pivot by COBRADE code
    if "COD_COBRADE" not in summary_df.columns:
        return by_city.fillna(0)

    summary_with_pop = summary_df.merge(pop_data, on=group_cols, how="left")
    summary_with_pop[pop_col] = pd.to_numeric(
        summary_with_pop[pop_col], errors="coerce"
    ).fillna(0)

    # Per-capita rates for COBRADE-level data
    rate_cols = []
    for col in count_cols:
        rate_col = f"{col}_POR_10K_HAB"
        summary_with_pop[rate_col] = np.where(
            summary_with_pop[pop_col] > 0,
            (summary_with_pop[col] / summary_with_pop[pop_col]) * 10000,
            0,
        )
        rate_cols.append(rate_col)

    summary_with_pop["COD_COBRADE"] = (
        summary_with_pop["COD_COBRADE"]
        .astype(str)
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
    )

    pivot = summary_with_pop.pivot_table(
        index=group_cols,
        columns="COD_COBRADE",
        values=count_cols + rate_cols,
        aggfunc="sum",
        fill_value=0,
    )
    pivot.columns = [
        "_".join(str(s).strip() for s in col if s != "").upper()
        for col in pivot.columns.values
    ]
    pivot.reset_index(inplace=True)

    final = by_city.merge(pivot, on=group_cols, how="left")
    return final.fillna(0)


def aggregate_geospatial_data(
    geo_df: gpd.GeoDataFrame,
    summary_df: pd.DataFrame,
    pop_col: str = "CENSO_2020_POP",
) -> gpd.GeoDataFrame:
    """
    Merge geospatial municipality boundaries with disaster summary data.
    """
    logger.info("Merging geospatial data with disaster summary...")
    merge_cols = ["SIGLA_UF", "NM_MUN_SEM_ACENTO"]

    summary_processed = summary_df.copy()
    if pop_col in summary_processed.columns and pop_col in geo_df.columns:
        summary_processed = summary_processed.drop(columns=[pop_col])

    merged = geo_df.merge(summary_processed, how="left", on=merge_cols)
    merged = merged.drop_duplicates()
    merged.fillna(0, inplace=True)
    return merged


def run_ingestion(
    ufs_filter: list[str] | None = None,
) -> gpd.GeoDataFrame:
    """
    Execute the full ingestion pipeline.

    1. Load IBGE municipality boundaries
    2. Read Atlas CSV (already downloaded by Express.js backend)
    3. Read S2ID report CSVs (if available)
    4. Transform, aggregate by time periods, calculate per-capita rates
    5. Merge with geometry

    Returns:
        GeoDataFrame with ~510 columns: municipality geometry + disaster statistics
    """
    ufs = ufs_filter or UFS_TO_FILTER

    # 1. Load IBGE municipalities
    logger.info("Step 1/5: Loading IBGE municipality boundaries...")
    municipios = read_geoparquet_municipios(
        IBGE_DATA_DIR, IBGE_GEOPARQUET_FILENAME, ufs
    )
    municipios_dissolved = dissolve_municipalities(municipios)
    logger.info(f"Loaded {len(municipios_dissolved)} municipalities")

    # 2. Read Atlas CSV
    logger.info("Step 2/5: Reading Atlas Digital CSV...")
    atlas_path = find_atlas_csv()
    atlas_df = pd.DataFrame()
    if atlas_path:
        logger.info(f"Found Atlas CSV: {atlas_path}")
        atlas_raw = pd.read_csv(atlas_path, sep=";", encoding="Latin-1", low_memory=False)
        atlas_df = transform_s2id_data(atlas_raw, source_type="atlas")
        logger.info(f"Atlas data: {len(atlas_df)} records")
    else:
        logger.warning("No Atlas CSV found in server/data/atlas/")

    # 3. Read S2ID reports
    logger.info("Step 3/5: Reading S2ID report files...")
    s2id_paths = find_s2id_csvs()
    reports_df = pd.DataFrame()
    if s2id_paths:
        reports_raw = read_s2id_report_files(s2id_paths)
        if not reports_raw.empty:
            reports_df = transform_s2id_data(reports_raw, source_type="report")
            logger.info(f"S2ID reports: {len(reports_df)} records")
    else:
        logger.warning("No S2ID report CSVs found in server/data/s2id/")

    # Cross-enrich COBRADE details between sources
    cobrade_detail_cols = [
        "COBRADE", "COBRADE_NAME", "TIPOLOGIA",
        "DESCRICAO_TIPOLOGIA", "GRUPO_DE_DESASTRE",
    ]
    if not atlas_df.empty and not reports_df.empty:
        atlas_details = [c for c in cobrade_detail_cols if c in atlas_df.columns]
        report_details = [c for c in cobrade_detail_cols if c in reports_df.columns]
        if atlas_details:
            reports_df = get_cobrade_details(reports_df, atlas_df, details_cols=atlas_details)
        if report_details:
            atlas_df = get_cobrade_details(atlas_df, reports_df, details_cols=report_details)

    # 4. Combine sources and aggregate
    logger.info("Step 4/5: Aggregating and calculating statistics...")
    if not atlas_df.empty and not reports_df.empty:
        common_cols = list(set(atlas_df.columns) & set(reports_df.columns))
        historical = pd.concat(
            [atlas_df[common_cols], reports_df[common_cols]],
            ignore_index=True, sort=False,
        )
        if "PROTOCOLO" in historical.columns:
            historical = historical.drop_duplicates(subset=["PROTOCOLO"])
        else:
            historical = historical.drop_duplicates()
    elif not atlas_df.empty:
        historical = atlas_df
    elif not reports_df.empty:
        historical = reports_df
    else:
        logger.error("No data sources available. Returning empty GeoDataFrame.")
        return municipios_dissolved

    historical = clean_value_columns(historical)

    # Get all unique COBRADE codes
    if "COD_COBRADE" in historical.columns:
        historical["COD_COBRADE"] = (
            historical["COD_COBRADE"]
            .astype(str)
            .str.strip()
            .str.replace(r"\.0$", "", regex=True)
        )
        all_cobrades = historical["COD_COBRADE"].unique().tolist()
    else:
        all_cobrades = []

    summary = summarize_disasters_by_period(
        historical, PERIODS_CONFIG, all_cobrades, DEFAULT_VALIDITY_DAYS
    )

    pivot_final = aggregate_and_pivot_summary(
        summary, municipios_dissolved, PERIODS_CONFIG
    )

    # 5. Merge with geometry
    logger.info("Step 5/5: Merging with municipality geometries...")
    geo_cols_to_keep = [
        c for c in municipios_dissolved.columns if c != "NM_MUN"
    ]
    result = aggregate_geospatial_data(
        municipios_dissolved[geo_cols_to_keep],
        pivot_final,
    )

    if "CENSO_2020_POP" in result.columns:
        result["CENSO_2020_POP"] = result["CENSO_2020_POP"].astype(int)

    logger.info(
        f"Ingestion complete: {result.shape[0]} municipalities, "
        f"{result.shape[1]} columns"
    )
    return result
