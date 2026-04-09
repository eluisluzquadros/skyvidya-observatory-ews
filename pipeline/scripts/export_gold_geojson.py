"""
Gold GeoJSON Exporter — Skyvidya EWS
Lê mart_disasters_geo do DuckDB (Gold layer) e exporta como GeoJSON
para server/data/analytics/municipality_geometries.geojson.

Estratégia: sobrescreve o arquivo existente (gerado pelo pipeline Python)
com versão enriquecida — adiciona risk_score EWS, events_per_100k, etc.
Zero breaking change: o Express e o ChoroplethMap continuam lendo o mesmo path.

Pode ser chamado standalone: python export_gold_geojson.py
Ou pelo Kestra (task 7 do DAG s2id-ingestion).
"""
import duckdb
import json
import sys
import shutil
from datetime import datetime
from pathlib import Path

ROOT      = Path(__file__).resolve().parents[2]
DB_PATH   = ROOT / "server" / "data" / "duckdb" / "ews.duckdb"
OUT_PATH  = ROOT / "server" / "data" / "analytics" / "municipality_geometries.geojson"
BACKUP    = ROOT / "server" / "data" / "analytics" / "municipality_geometries.backup.geojson"


def export():
    if not DB_PATH.exists():
        print(f"[export_gold_geojson] AVISO: {DB_PATH} não encontrado — abortando", file=sys.stderr)
        sys.exit(0)  # Não falha — pipeline pode ter sido pulado

    print(f"[export_gold_geojson] Conectando a {DB_PATH}...")
    con = duckdb.connect(str(DB_PATH), read_only=True)

    try:
        con.execute("INSTALL spatial; LOAD spatial;")
    except Exception:
        pass

    # Verifica se o modelo foi materializado
    try:
        count = con.execute("SELECT COUNT(*) FROM gold.mart_disasters_geo").fetchone()[0]
    except Exception as e:
        print(f"[export_gold_geojson] Gold spatial model não encontrado: {e}", file=sys.stderr)
        print("[export_gold_geojson] Execute 'dbt run --select gold' primeiro.")
        sys.exit(0)

    print(f"[export_gold_geojson] {count} municipios no Gold layer -> exportando GeoJSON...")

    rows = con.execute("""
        SELECT
            cod_ibge,
            municipality,
            uf,
            risk_score,
            risk_category,
            total_events,
            last_10y_count,
            last_1y_count,
            total_affected,
            latest_event_date::VARCHAR  AS latest_event_date,
            primary_disaster_type,
            pop_2020,
            area_km2,
            events_per_100k,
            mcda_score,
            mcda_category,
            principal_threat,
            lat,
            lng,
            geometry_geojson            AS geometry_json
        FROM gold.mart_disasters_geo
        WHERE geometry_geojson IS NOT NULL
        ORDER BY risk_score DESC
    """).fetchall()

    cols = [
        "cod_ibge", "municipality", "uf", "risk_score", "risk_category",
        "total_events", "last_10y_count", "last_1y_count", "total_affected",
        "latest_event_date", "primary_disaster_type", "pop_2020", "area_km2",
        "events_per_100k", "mcda_score", "mcda_category", "principal_threat",
        "lat", "lng", "geometry_json",
    ]

    features = []
    for row in rows:
        r = dict(zip(cols, row))
        try:
            geom = json.loads(r.pop("geometry_json"))
        except Exception:
            continue

        features.append({
            "type": "Feature",
            "properties": {
                "CD_MUN":                r["cod_ibge"],
                "municipality":          r["municipality"],
                "uf":                    r["uf"],
                "risk_score":            r["risk_score"],
                "risk_category":         r["risk_category"],
                "total_events":          r["total_events"],
                "LAST10_YEARS_COUNT":    r["last_10y_count"],
                "last_1y_count":         r["last_1y_count"],
                "total_affected":        r["total_affected"],
                "latest_event_date":     r["latest_event_date"],
                "primary_disaster_type": r["primary_disaster_type"],
                "CENSO_2020_POP":        r["pop_2020"],
                "AREA_KM2":              r["area_km2"],
                "events_per_100k":       r["events_per_100k"],
                "Risco_Ampliado_MCDA_Score": r["mcda_score"],
                "Risco_Ampliado_MCDA_Cat":   r["mcda_category"],
                "principal_ameaca":      r["principal_threat"],
                "lat":                   r["lat"],
                "lng":                   r["lng"],
                "_pipeline_source":      "duckdb_gold",
                "_exported_at":          datetime.now().isoformat(),
            },
            "geometry": geom,
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
        "_meta": {
            "source": "duckdb_gold.mart_disasters_geo",
            "exported_at": datetime.now().isoformat(),
            "count": len(features),
        },
    }

    con.close()

    # Backup do arquivo atual antes de sobrescrever
    if OUT_PATH.exists():
        shutil.copy2(OUT_PATH, BACKUP)
        print(f"[export_gold_geojson] Backup salvo em {BACKUP.name}")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = OUT_PATH.stat().st_size / 1_048_576
    print(f"[export_gold_geojson] OK: {len(features)} features -> {OUT_PATH.name} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    export()
