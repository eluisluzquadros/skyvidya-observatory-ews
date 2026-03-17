"""
S2ID Analytics Pipeline - Reporting Charts & Assets
Port of Notebook 03: 03_analise_mdr_s2id_relatorios_v2.ipynb

Generates static PNG maps/charts and CSV tables for reports and frontend display.
"""

import logging
from itertools import islice
from pathlib import Path

import geopandas as gpd
import matplotlib
matplotlib.use("Agg")  # headless rendering — must be before pyplot import
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# ── Colour Palettes ──────────────────────────────────────────────────────────

RISK_COLORS = {
    "Muito Baixo": "#2c7bb6",
    "Baixo":       "#abd9e9",
    "Médio":       "#ffffbf",
    "Alto":        "#fdae61",
    "Muito Alto":  "#d7191c",
}

TREND_COLORS = {
    "Decrescente": "#1a9641",
    "Estável":     "#ffffbf",
    "Crescente":   "#d7191c",
}

LISA_COLORS = {
    "1 HH (Hot Spot)":       "#d7191c",
    "2 LH (Anel Baixo-Alto)": "#fdae61",
    "3 LL (Cold Spot)":       "#2c7bb6",
    "4 HL (Anel Alto-Baixo)": "#abd9e9",
    "0 ns (Não Significativo)": "#cccccc",
}

# Threat colour cycle (auto-assigned)
THREAT_CMAP = "tab20"

# ── Helpers ──────────────────────────────────────────────────────────────────

_STYLE = {
    "facecolor": "#0B0F14",
    "edgecolor": "#1A2332",
    "title_color": "white",
    "label_color": "#8899AA",
}


def _apply_dark_style(ax, title: str = "", dpi: int = 150):
    ax.set_facecolor(_STYLE["facecolor"])
    ax.figure.set_facecolor(_STYLE["facecolor"])
    ax.set_axis_off()
    if title:
        ax.set_title(
            title,
            fontsize=9,
            fontweight="bold",
            color=_STYLE["title_color"],
            pad=6,
        )


def _filter_state(gdf: gpd.GeoDataFrame, state: str | None) -> gpd.GeoDataFrame:
    if state and "SIGLA_UF" in gdf.columns:
        return gdf[gdf["SIGLA_UF"] == state]
    return gdf


def _legend_patches(color_map: dict) -> list:
    return [
        mpatches.Patch(facecolor=c, edgecolor="#333", label=lbl, linewidth=0.3)
        for lbl, c in color_map.items()
    ]


def _save(fig, path: Path, dpi: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=dpi, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    logger.info(f"  Saved: {path.name}")


# ── Map generators ────────────────────────────────────────────────────────────

def generate_risk_map(
    gdf: gpd.GeoDataFrame,
    output_dir: Path,
    state: str | None = None,
    dpi: int = 150,
) -> Path | None:
    """Choropleth: Risco_Ampliado_MCDA_Cat"""
    col = "Risco_Ampliado_MCDA_Cat"
    if col not in gdf.columns:
        logger.warning(f"Column {col} not found, skipping risk map")
        return None

    data = _filter_state(gdf, state).copy()
    data["_color"] = data[col].astype(str).map(RISK_COLORS).fillna("#555555")

    fig, ax = plt.subplots(1, 1, figsize=(8, 7))
    data.plot(ax=ax, color=data["_color"], linewidth=0.05, edgecolor="#1A2332")

    title = f"Risco MCDA{' — ' + state if state else ' — Brasil'}"
    _apply_dark_style(ax, title)
    ax.legend(
        handles=_legend_patches(RISK_COLORS),
        loc="lower left",
        fontsize=6,
        framealpha=0.2,
        facecolor="#0B0F14",
        labelcolor="white",
        edgecolor="#333",
    )

    suffix = f"_{state}" if state else ""
    out = output_dir / f"map_risco_mcda{suffix}.png"
    _save(fig, out, dpi)
    return out


def generate_trend_map(
    gdf: gpd.GeoDataFrame,
    output_dir: Path,
    state: str | None = None,
    dpi: int = 150,
) -> Path | None:
    """Choropleth: Tendencia_Eventos_Climaticos_Extremos"""
    col = "Tendencia_Eventos_Climaticos_Extremos"
    if col not in gdf.columns:
        logger.warning(f"Column {col} not found, skipping trend map")
        return None

    data = _filter_state(gdf, state).copy()
    data["_color"] = data[col].map(TREND_COLORS).fillna("#555555")

    fig, ax = plt.subplots(1, 1, figsize=(8, 7))
    data.plot(ax=ax, color=data["_color"], linewidth=0.05, edgecolor="#1A2332")

    title = f"Tendência de Eventos{' — ' + state if state else ' — Brasil'}"
    _apply_dark_style(ax, title)
    ax.legend(
        handles=_legend_patches(TREND_COLORS),
        loc="lower left",
        fontsize=6,
        framealpha=0.2,
        facecolor="#0B0F14",
        labelcolor="white",
        edgecolor="#333",
    )

    suffix = f"_{state}" if state else ""
    out = output_dir / f"map_tendencia{suffix}.png"
    _save(fig, out, dpi)
    return out


def generate_threat_map(
    gdf: gpd.GeoDataFrame,
    output_dir: Path,
    state: str | None = None,
    dpi: int = 150,
) -> Path | None:
    """Choropleth categórico: principal_ameaca"""
    col = "principal_ameaca"
    if col not in gdf.columns:
        logger.warning(f"Column {col} not found, skipping threat map")
        return None

    data = _filter_state(gdf, state).copy()
    categories = [c for c in data[col].unique() if pd.notna(c)]
    cmap = plt.get_cmap(THREAT_CMAP, len(categories))
    color_map = {cat: cmap(i) for i, cat in enumerate(sorted(categories))}
    data["_color"] = data[col].map(color_map)

    fig, ax = plt.subplots(1, 1, figsize=(8, 7))
    data.plot(ax=ax, color=data["_color"], linewidth=0.05, edgecolor="#1A2332")

    title = f"Principal Ameaça{' — ' + state if state else ' — Brasil'}"
    _apply_dark_style(ax, title)
    patches = [
        mpatches.Patch(facecolor=c, edgecolor="#333", label=lbl, linewidth=0.3)
        for lbl, c in sorted(color_map.items())
    ]
    ax.legend(
        handles=patches,
        loc="lower left",
        fontsize=5,
        framealpha=0.2,
        facecolor="#0B0F14",
        labelcolor="white",
        edgecolor="#333",
        ncol=2,
    )

    suffix = f"_{state}" if state else ""
    out = output_dir / f"map_principal_ameaca{suffix}.png"
    _save(fig, out, dpi)
    return out


def generate_lisa_map(
    gdf: gpd.GeoDataFrame,
    variable: str,
    output_dir: Path,
    state: str | None = None,
    dpi: int = 150,
) -> Path | None:
    """Choropleth LISA clusters: {variable}_lisa_labels"""
    col = f"{variable}_lisa_labels"
    if col not in gdf.columns:
        logger.warning(f"Column {col} not found, skipping LISA map for {variable}")
        return None

    data = _filter_state(gdf, state).copy()
    data["_color"] = data[col].map(LISA_COLORS).fillna("#555555")

    fig, ax = plt.subplots(1, 1, figsize=(8, 7))
    data.plot(ax=ax, color=data["_color"], linewidth=0.05, edgecolor="#1A2332")

    label = variable.replace("_COUNT", "").replace("_", " ").title()
    title = f"LISA Clusters — {label}{' — ' + state if state else ''}"
    _apply_dark_style(ax, title)
    ax.legend(
        handles=_legend_patches(LISA_COLORS),
        loc="lower left",
        fontsize=5.5,
        framealpha=0.2,
        facecolor="#0B0F14",
        labelcolor="white",
        edgecolor="#333",
    )

    suffix = f"_{state}" if state else ""
    out = output_dir / f"map_lisa_{variable.lower()}{suffix}.png"
    _save(fig, out, dpi)
    return out


# ── Distribution charts ───────────────────────────────────────────────────────

def generate_distribution_charts(
    gdf: gpd.GeoDataFrame,
    output_dir: Path,
    state: str | None = None,
    dpi: int = 150,
) -> list[Path]:
    """Bar/pie distribution charts for risk, trend, and top threats."""
    data = _filter_state(gdf, state)
    outputs = []
    suffix = f"_{state}" if state else ""

    # 1 — Risk category bar chart
    risk_col = "Risco_Ampliado_MCDA_Cat"
    if risk_col in data.columns:
        order = list(RISK_COLORS.keys())
        counts = data[risk_col].value_counts().reindex(order, fill_value=0)
        colors = [RISK_COLORS[k] for k in counts.index]

        fig, ax = plt.subplots(figsize=(6, 3.5))
        fig.patch.set_facecolor(_STYLE["facecolor"])
        ax.set_facecolor(_STYLE["facecolor"])
        bars = ax.barh(counts.index, counts.values, color=colors, edgecolor="#1A2332", linewidth=0.3)
        for bar, val in zip(bars, counts.values):
            ax.text(val + 5, bar.get_y() + bar.get_height() / 2,
                    str(val), va="center", fontsize=7, color="white")
        ax.set_title(f"Distribuição de Risco MCDA{' — ' + state if state else ''}",
                     color="white", fontsize=8, fontweight="bold")
        ax.tick_params(colors="white", labelsize=7)
        ax.spines[:].set_color("#333")
        ax.set_xlabel("Municípios", color=_STYLE["label_color"], fontsize=7)

        out = output_dir / f"chart_distribuicao_risco{suffix}.png"
        _save(fig, out, dpi)
        outputs.append(out)

    # 2 — Trend pie chart
    trend_col = "Tendencia_Eventos_Climaticos_Extremos"
    if trend_col in data.columns:
        order = list(TREND_COLORS.keys())
        counts = data[trend_col].value_counts().reindex(order, fill_value=0)
        colors = [TREND_COLORS[k] for k in counts.index]

        fig, ax = plt.subplots(figsize=(5, 4))
        fig.patch.set_facecolor(_STYLE["facecolor"])
        ax.set_facecolor(_STYLE["facecolor"])
        wedges, texts, autotexts = ax.pie(
            counts.values,
            labels=counts.index,
            colors=colors,
            autopct="%1.1f%%",
            startangle=90,
            textprops={"color": "white", "fontsize": 7},
            wedgeprops={"edgecolor": "#1A2332", "linewidth": 0.5},
        )
        for at in autotexts:
            at.set_fontsize(6)
        ax.set_title(f"Tendência de Eventos{' — ' + state if state else ''}",
                     color="white", fontsize=8, fontweight="bold")

        out = output_dir / f"chart_distribuicao_tendencia{suffix}.png"
        _save(fig, out, dpi)
        outputs.append(out)

    # 3 — Top 5 principal threats bar chart
    threat_col = "principal_ameaca"
    if threat_col in data.columns:
        top5 = (
            data[threat_col]
            .value_counts()
            .head(5)
            .sort_values()
        )
        cmap = plt.get_cmap(THREAT_CMAP, len(top5))
        colors = [cmap(i) for i in range(len(top5))]

        fig, ax = plt.subplots(figsize=(6, 3.5))
        fig.patch.set_facecolor(_STYLE["facecolor"])
        ax.set_facecolor(_STYLE["facecolor"])
        bars = ax.barh(top5.index, top5.values, color=colors, edgecolor="#1A2332", linewidth=0.3)
        for bar, val in zip(bars, top5.values):
            ax.text(val + 3, bar.get_y() + bar.get_height() / 2,
                    str(val), va="center", fontsize=7, color="white")
        ax.set_title(f"Top 5 Ameaças Principais{' — ' + state if state else ''}",
                     color="white", fontsize=8, fontweight="bold")
        ax.tick_params(colors="white", labelsize=7)
        ax.spines[:].set_color("#333")
        ax.set_xlabel("Municípios", color=_STYLE["label_color"], fontsize=7)

        out = output_dir / f"chart_top_ameacas{suffix}.png"
        _save(fig, out, dpi)
        outputs.append(out)

    return outputs


# ── CSV table ─────────────────────────────────────────────────────────────────

def generate_top_municipalities_table(
    gdf: gpd.GeoDataFrame,
    top_n: int,
    output_dir: Path,
    state: str | None = None,
) -> Path | None:
    """CSV: top-N municipalities by Risco_Ampliado_MCDA_Score."""
    score_col = "Risco_Ampliado_MCDA_Score"
    if score_col not in gdf.columns:
        logger.warning(f"Column {score_col} not found, skipping top municipalities table")
        return None

    data = _filter_state(gdf, state)

    cols = []
    for c in ["NM_MUN", "SIGLA_UF", score_col, "Risco_Ampliado_MCDA_Cat",
              "Tendencia_Eventos_Climaticos_Extremos", "principal_ameaca", "CENSO_2020_POP"]:
        if c in data.columns:
            cols.append(c)

    top = (
        data[cols]
        .sort_values(score_col, ascending=False)
        .head(top_n)
        .reset_index(drop=True)
    )
    top.index += 1

    suffix = f"_{state}" if state else ""
    out = output_dir / f"tabela_top_{top_n}_risco{suffix}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    top.to_csv(out, index=True, index_label="Rank", encoding="utf-8-sig")
    logger.info(f"  Saved: {out.name}")
    return out


# ── Orchestrator ──────────────────────────────────────────────────────────────

def run_reporting(
    gdf: gpd.GeoDataFrame,
    output_dir: Path,
    states: list[str] | None = None,
    top_n: int = 10,
    dpi: int = 150,
    lisa_variables: list[str] | None = None,
) -> dict[str, Path]:
    """
    Generate all reporting assets (PNGs + CSV).

    Args:
        gdf: GeoDataFrame from the analytics pipeline (post-MCDA)
        output_dir: Directory to write assets into
        states: List of UF codes to generate per-state maps for (None = skip per-state)
        top_n: Number of municipalities in the CSV ranking table
        dpi: Image resolution
        lisa_variables: LISA variables to map (None = first 2 available)

    Returns:
        Dict mapping asset name -> Path
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Generating report assets → {output_dir}")

    results: dict[str, Path] = {}

    # Determine LISA variables to chart
    if lisa_variables is None:
        available_lisa: list[str] = [
            str(c).replace("_lisa_labels", "")
            for c in gdf.columns
            if str(c).endswith("_lisa_labels")
        ]
        lisa_variables = list(islice(available_lisa, 2))  # default: first 2

    # ── National maps & charts ──
    scopes = [None] + (states or [])
    for scope in scopes:
        tag = scope or "BR"
        logger.info(f"  Scope: {tag}")

        p = generate_risk_map(gdf, output_dir, scope, dpi)
        if p:
            results[f"map_risco_{tag}"] = p

        p = generate_trend_map(gdf, output_dir, scope, dpi)
        if p:
            results[f"map_tendencia_{tag}"] = p

        p = generate_threat_map(gdf, output_dir, scope, dpi)
        if p:
            results[f"map_ameaca_{tag}"] = p

        for var in lisa_variables:
            p = generate_lisa_map(gdf, var, output_dir, scope, dpi)
            if p:
                results[f"map_lisa_{var}_{tag}"] = p

        charts = generate_distribution_charts(gdf, output_dir, scope, dpi)
        for c in charts:
            results[c.stem] = c

        p = generate_top_municipalities_table(gdf, top_n, output_dir, scope)
        if p:
            results[f"tabela_top_{top_n}_{tag}"] = p

    logger.info(f"Reporting complete: {len(results)} assets generated")
    return results
