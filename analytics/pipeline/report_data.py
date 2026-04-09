"""
S2ID Analytics Pipeline - Report Data Serialization
Port of Notebook 03: 03_analise_mdr_Script_de_Geracao_de_Relatorio.ipynb

Serializes the final GeoDataFrame analysis results into JSON files
that can be consumed by the Express.js backend and React frontend.
"""

import json
import logging
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import geopandas as gpd

from config import (
    ANALYTICS_OUTPUT_DIR,
    GEOJSON_SIMPLIFY_TOLERANCE,
    COBRADE_MAP,
    RISK_CATEGORIES,
)

logger = logging.getLogger(__name__)


def fix_mojibake(text: str) -> str:
    """Repair UTF-8 \u2192 Latin-1 double-encoding (mojibake).

    Example: 'Est\u00c3\u00a1vel' \u2192 'Est\u00e1vel', 'Inunda\u00c3\u00a7\u00c3\u00b5es' \u2192 'Inunda\u00e7\u00f5es'.
    If the string is already correct or cannot be repaired, returns as-is.
    """
    if not isinstance(text, str):
        return str(text)
    try:
        repaired = text.encode("latin-1").decode("utf-8")
        return repaired
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


class NumpyEncoder(json.JSONEncoder):
    """JSON encoder that handles numpy types."""

    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return round(float(obj), 6)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if pd.isna(obj):
            return None
        return super().default(obj)


def serialize_risk_analysis(gdf: gpd.GeoDataFrame) -> list[dict]:
    """
    Serialize municipality risk analysis data to a list of dicts.

    Each municipality gets:
    - Identity: cd_mun, name, uf, population
    - Risk: score, category, trend, principal threat
    - Counts: historic, 10yr, 5yr, 2yr
    - Rates: per 10K inhabitants for each period
    - Coordinates: centroid lat/lng
    """
    logger.info("Serializing risk analysis data...")
    records = []

    for _, row in gdf.iterrows():
        # Calculate centroid for point representation
        centroid = row.geometry.centroid if hasattr(row, "geometry") and row.geometry else None

        record = {
            "cd_mun": str(row.get("CD_MUN", "")),
            "name": str(row.get("NM_MUN_SEM_ACENTO", "")),
            "uf": str(row.get("SIGLA_UF", "")),
            "population": int(row.get("CENSO_2020_POP", 0)),
            "area_km2": round(float(row.get("AREA_KM2", 0)), 2),
            "riskScore": round(float(row.get("Risco_Ampliado_MCDA_Score", 0)), 6),
            "riskCategory": fix_mojibake(str(row.get("Risco_Ampliado_MCDA_Cat", "Muito Baixo"))),
            "trend": fix_mojibake(str(row.get("Tendencia_Eventos_Climaticos_Extremos", "Estável"))),
            "principalThreat": fix_mojibake(str(row.get("principal_ameaca", "Nenhuma Ameaça Dominante"))),
            "historicCount": int(row.get("HISTORIC_COUNT", 0)),
            "last10yrCount": int(row.get("LAST10_YEARS_COUNT", 0)),
            "last5yrCount": int(row.get("LAST05_YEARS_COUNT", 0)),
            "last2yrCount": int(row.get("LAST02_YEARS_COUNT", 0)),
            "ratesPer10k": {
                "historic": round(float(row.get("HISTORIC_COUNT_POR_10K_HAB", 0)), 4),
                "last10yr": round(float(row.get("LAST10_YEARS_COUNT_POR_10K_HAB", 0)), 4),
                "last5yr": round(float(row.get("LAST05_YEARS_COUNT_POR_10K_HAB", 0)), 4),
                "last2yr": round(float(row.get("LAST02_YEARS_COUNT_POR_10K_HAB", 0)), 4),
            },
            "lat": round(centroid.y, 6) if centroid else None,
            "lng": round(centroid.x, 6) if centroid else None,
        }

        # Add enriched socioeconomic indicators (when available)
        socio = {}
        for col, key in [
            ("pib_per_capita",           "pibPerCapita"),
            ("pib_total",                "pibTotal"),
            ("idhm",                     "idhm"),
            ("densidade_demografica",    "densidadeDemografica"),
            ("taxa_mortalidade_infantil","taxaMortalidadeInfantil"),
            ("receitas_brutas",          "receitasBrutas"),
            ("despesas_brutas",          "despesasBrutas"),
        ]:
            if col in gdf.columns and pd.notna(row.get(col)):
                socio[key] = round(float(row.get(col)), 4)
        if socio:
            record["socioeconomico"] = socio

        # Add aggregated damage data from Danos_Informados reports (PEPR/PEPL/DH)
        danos = {}
        danos_field_map = [
            ("danos_peprAgricultura",   "peprAgricultura"),
            ("danos_peprPecuaria",      "peprPecuaria"),
            ("danos_peprIndustria",     "peprIndustria"),
            ("danos_peprComercio",      "peprComercio"),
            ("danos_peprServicos",      "peprServicos"),
            ("danos_peplSaude",         "peplSaude"),
            ("danos_peplEnsino",        "peplEnsino"),
            ("danos_peplTransportes",   "peplTransportes"),
            ("danos_peplEnergia",       "peplEnergia"),
            ("danos_dhMortos",          "dhMortos"),
            ("danos_dhDesabrigados",    "dhDesabrigados"),
            ("danos_dhDesalojados",     "dhDesalojados"),
            ("danos_dhOutrosAfetados",  "dhOutrosAfetados"),
        ]
        for col, key in danos_field_map:
            if col in gdf.columns:
                raw = row.get(col)  # type: ignore[union-attr]
                if pd.notna(raw):
                    fval = float(raw)  # type: ignore[arg-type]
                    if fval > 0:
                        danos[key] = int(fval)
        if danos:
            record["danos"] = danos

        # Add per-COBRADE breakdown: last-10yr count, historic count, historic impact
        cobrade_counts = {}
        for code, name in COBRADE_MAP.items():
            col_10y     = f"LAST10_YEARS_COUNT_{code}"
            col_hist    = f"HISTORIC_COUNT_{code}"
            col_impact  = f"HISTORIC_IMPACT_DANOS_{code}"
            if col_10y in gdf.columns or col_hist in gdf.columns:
                entry: dict = {
                    "name":  name,
                    "count": int(row.get(col_10y, 0)),
                }
                if col_hist in gdf.columns:
                    entry["historicCount"] = int(row.get(col_hist, 0))
                if col_impact in gdf.columns:
                    entry["historicImpact"] = int(row.get(col_impact, 0))
                cobrade_counts[code] = entry
        if cobrade_counts:
            record["cobradeBreakdown"] = cobrade_counts

        records.append(record)

    logger.info(f"Serialized {len(records)} municipality risk records")
    return records


def serialize_lisa_clusters(
    gdf: gpd.GeoDataFrame,
    global_results: list[dict],
) -> dict:
    """
    Serialize LISA cluster data to a dict with per-variable cluster info.
    """
    logger.info("Serializing LISA cluster data...")

    # Find all LISA result columns
    lisa_vars = set()
    for col in gdf.columns:
        if col.endswith("_lisa_q"):
            var_name = col.replace("_lisa_q", "")
            lisa_vars.add(var_name)

    clusters_by_variable = {}
    for var in sorted(lisa_vars):
        q_col = f"{var}_lisa_q"
        sig_col = f"{var}_lisa_sig"
        i_col = f"{var}_lisa_I"
        p_col = f"{var}_lisa_p_sim"

        if q_col not in gdf.columns:
            continue

        municipalities = []
        for _, row in gdf.iterrows():
            if not row.get(sig_col, False):
                continue  # Only include significant clusters

            municipalities.append({
                "cd_mun": str(row.get("CD_MUN", "")),
                "name": str(row.get("NM_MUN_SEM_ACENTO", "")),
                "uf": str(row.get("SIGLA_UF", "")),
                "clusterType": fix_mojibake(str(row.get(q_col, "N/A"))),
                "moranI": round(float(row.get(i_col, 0)), 6),
                "pValue": round(float(row.get(p_col, 1)), 6),
            })

        # Count by cluster type
        cluster_counts = {}
        for m in municipalities:
            ct = m["clusterType"]
            cluster_counts[ct] = cluster_counts.get(ct, 0) + 1

        clusters_by_variable[var] = {
            "municipalities": municipalities,
            "summary": cluster_counts,
            "totalSignificant": len(municipalities),
        }

    # Add global Moran's I results
    result = {
        "variables": clusters_by_variable,
        "globalMoranI": global_results,
        "totalVariables": len(lisa_vars),
    }

    logger.info(f"Serialized LISA data for {len(lisa_vars)} variables")
    return result


def serialize_municipality_geojson(
    gdf: gpd.GeoDataFrame,
    simplify_tolerance: float = GEOJSON_SIMPLIFY_TOLERANCE,
) -> dict:
    """
    Serialize municipality boundaries to simplified GeoJSON for web rendering.
    """
    logger.info(f"Serializing GeoJSON (simplify tolerance={simplify_tolerance})...")

    # Simplify geometries for web rendering (Douglas-Peucker)
    simplified = gdf.copy()
    simplified["geometry"] = simplified.geometry.simplify(
        simplify_tolerance, preserve_topology=True
    )

    # Keep only essential columns for the GeoJSON
    keep_cols = [
        "CD_MUN", "NM_MUN_SEM_ACENTO", "SIGLA_UF", "CENSO_2020_POP",
        "AREA_KM2", "geometry",
    ]
    # Add risk columns if present
    risk_cols = [
        "Risco_Ampliado_MCDA_Score", "Risco_Ampliado_MCDA_Cat",
        "Tendencia_Eventos_Climaticos_Extremos", "principal_ameaca",
    ]
    keep_cols.extend([c for c in risk_cols if c in simplified.columns])

    existing_cols = [c for c in keep_cols if c in simplified.columns]
    simplified = simplified[existing_cols]

    geojson = json.loads(simplified.to_json())
    logger.info(
        f"GeoJSON: {len(geojson.get('features', []))} features, "
        f"~{len(json.dumps(geojson)) / 1024:.0f} KB"
    )
    return geojson


def serialize_distributions(gdf: gpd.GeoDataFrame) -> dict:
    """
    Serialize distribution statistics for risk categories, trends, and threats.
    """
    distributions = {}

    # Risk categories
    if "Risco_Ampliado_MCDA_Cat" in gdf.columns:
        risk_dist = gdf["Risco_Ampliado_MCDA_Cat"].value_counts().to_dict()
        distributions["riskCategories"] = [
            {"category": fix_mojibake(str(cat)), "count": int(count)}
            for cat, count in risk_dist.items()
        ]

    # Trends
    if "Tendencia_Eventos_Climaticos_Extremos" in gdf.columns:
        trend_dist = gdf["Tendencia_Eventos_Climaticos_Extremos"].value_counts().to_dict()
        distributions["trends"] = [
            {"trend": fix_mojibake(str(trend)), "count": int(count)}
            for trend, count in trend_dist.items()
        ]

    # Threats
    if "principal_ameaca" in gdf.columns:
        threat_dist = gdf["principal_ameaca"].value_counts().to_dict()
        distributions["threats"] = [
            {"threat": fix_mojibake(str(threat)), "count": int(count)}
            for threat, count in threat_dist.items()
        ]

    return distributions


def serialize_analytics_metadata(
    gdf: gpd.GeoDataFrame,
    pipeline_duration_seconds: float = 0,
) -> dict:
    """
    Create metadata for the analytics pipeline run.
    """
    ufs = sorted(gdf["SIGLA_UF"].unique().tolist()) if "SIGLA_UF" in gdf.columns else []

    return {
        "lastUpdated": datetime.now().isoformat(),
        "version": "1.0.0",
        "totalMunicipalities": len(gdf),
        "totalColumns": len(gdf.columns),
        "ufsAnalyzed": ufs,
        "pipelineDurationSeconds": round(pipeline_duration_seconds, 2),
        "dataRange": {
            "periods": ["HISTORIC", "LAST10_YEARS", "LAST05_YEARS", "LAST02_YEARS"],
        },
        "riskCategories": RISK_CATEGORIES,
        "cobradeTypes": COBRADE_MAP,
    }


def save_analytics_output(
    gdf: gpd.GeoDataFrame,
    global_moran_results: list[dict],
    pipeline_duration: float = 0,
    output_dir: Path = ANALYTICS_OUTPUT_DIR,
) -> dict[str, Path]:
    """
    Save all analytics output files to the server/data/analytics/ directory.

    Returns dict of output file paths.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {}

    # 1. Risk analysis JSON
    risk_path = output_dir / "risk_analysis.json"
    risk_data = serialize_risk_analysis(gdf)
    with open(risk_path, "w", encoding="utf-8") as f:
        json.dump(risk_data, f, cls=NumpyEncoder, ensure_ascii=False, indent=2)
    outputs["risk_analysis"] = risk_path
    logger.info(f"Saved: {risk_path} ({risk_path.stat().st_size / 1024:.0f} KB)")

    # 2. LISA clusters JSON
    lisa_path = output_dir / "lisa_clusters.json"
    lisa_data = serialize_lisa_clusters(gdf, global_moran_results)
    with open(lisa_path, "w", encoding="utf-8") as f:
        json.dump(lisa_data, f, cls=NumpyEncoder, ensure_ascii=False, indent=2)
    outputs["lisa_clusters"] = lisa_path
    logger.info(f"Saved: {lisa_path} ({lisa_path.stat().st_size / 1024:.0f} KB)")

    # 3. Municipality GeoJSON
    geojson_path = output_dir / "municipality_geometries.geojson"
    geojson_data = serialize_municipality_geojson(gdf)
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, cls=NumpyEncoder, ensure_ascii=False)
    outputs["municipality_geometries"] = geojson_path
    logger.info(f"Saved: {geojson_path} ({geojson_path.stat().st_size / 1024:.0f} KB)")

    # 4. Distributions JSON
    dist_path = output_dir / "distributions.json"
    dist_data = serialize_distributions(gdf)
    with open(dist_path, "w", encoding="utf-8") as f:
        json.dump(dist_data, f, cls=NumpyEncoder, ensure_ascii=False, indent=2)
    outputs["distributions"] = dist_path
    logger.info(f"Saved: {dist_path}")

    # 5. Analytics metadata
    meta_path = output_dir / "analytics_metadata.json"
    meta_data = serialize_analytics_metadata(gdf, pipeline_duration)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta_data, f, cls=NumpyEncoder, ensure_ascii=False, indent=2)
    outputs["analytics_metadata"] = meta_path
    logger.info(f"Saved: {meta_path}")

    logger.info(f"All analytics output saved to {output_dir}")
    return outputs
