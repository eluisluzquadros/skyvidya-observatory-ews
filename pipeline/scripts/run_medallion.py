"""
run_medallion.py — Skyvidya EWS Medallion Pipeline (dbt-free)
Executa as mesmas transformações dos modelos dbt diretamente via DuckDB.
Usa quando dbt-core não está disponível ou para execução rápida local.

Uso: python pipeline/scripts/run_medallion.py
"""
import duckdb
import sys
from pathlib import Path

ROOT     = Path(__file__).resolve().parents[2]
DB_PATH  = ROOT / "server" / "data" / "duckdb" / "ews.duckdb"
DATA_DIR = str(ROOT / "server" / "data").replace("\\", "/")
BRONZE_PARQUET = f"{DATA_DIR}/duckdb/bronze/latest.parquet"
RISK_JSON      = f"{DATA_DIR}/analytics/risk_analysis.json"

def log(msg): print(f"[medallion] {msg}", flush=True)
def die(msg): print(f"[medallion] ERRO: {msg}", file=sys.stderr); sys.exit(1)


def main():
    # ── Validações ────────────────────────────────────────────────────────
    if not Path(BRONZE_PARQUET).exists():
        die(f"Bronze parquet nao encontrado: {BRONZE_PARQUET}\n  Execute: python pipeline/scripts/bronze_ingest.py")

    if not Path(RISK_JSON).exists():
        die(f"risk_analysis.json nao encontrado: {RISK_JSON}")

    log(f"Conectando em {DB_PATH} ...")
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB_PATH))

    try:
        con.execute("INSTALL spatial; LOAD spatial;")
        log("Extensao spatial carregada")
    except Exception as e:
        log(f"Aviso spatial: {e}")

    # ── BRONZE ────────────────────────────────────────────────────────────
    log("Bronze: criando schema e view ...")
    con.execute("CREATE SCHEMA IF NOT EXISTS bronze")
    con.execute("CREATE SCHEMA IF NOT EXISTS silver")
    con.execute("CREATE SCHEMA IF NOT EXISTS gold")

    con.execute(f"""
        CREATE OR REPLACE TABLE bronze.stg_s2id_raw AS
        SELECT
            _pipeline_run_id,
            _ingested_at,
            _source_file,
            md5(id || COALESCE(date::VARCHAR,'') || COALESCE(municipality,'')) AS _row_hash,
            id,
            date::VARCHAR                           AS date,
            municipality,
            uf,
            type,
            COALESCE(status, 'active')              AS status,
            CAST(COALESCE(affected, 0) AS INTEGER)  AS affected,
            source,
            reportType                              AS report_type,
            collectedAt                             AS collected_at
        FROM read_parquet('{BRONZE_PARQUET}')
        WHERE id IS NOT NULL
    """)
    n = con.execute("SELECT COUNT(*) FROM bronze.stg_s2id_raw").fetchone()[0]
    log(f"Bronze: {n} registros em bronze.stg_s2id_raw")

    # ── SILVER: mapeamento IBGE ───────────────────────────────────────────
    log("Silver: carregando mapeamento IBGE ...")
    con.execute(f"""
        CREATE OR REPLACE TABLE silver.stg_ibge_municipalities AS
        SELECT DISTINCT
            cd_mun                      AS cod_ibge,
            UPPER(TRIM(name))           AS municipality_normalized,
            UPPER(TRIM(uf))             AS uf
        FROM read_json_auto('{RISK_JSON}')
        WHERE cd_mun IS NOT NULL AND name IS NOT NULL AND uf IS NOT NULL
    """)
    n = con.execute("SELECT COUNT(*) FROM silver.stg_ibge_municipalities").fetchone()[0]
    log(f"Silver: {n} municipios IBGE mapeados")

    # ── SILVER: limpeza S2ID ─────────────────────────────────────────────
    log("Silver: limpando e deduplicando registros S2ID ...")
    con.execute("""
        CREATE OR REPLACE TABLE silver.stg_s2id_clean AS
        WITH valid_ufs AS (
            SELECT unnest([
                'AC','AL','AM','AP','BA','CE','DF','ES','GO',
                'MA','MG','MS','MT','PA','PB','PE','PI','PR',
                'RJ','RN','RO','RR','RS','SC','SE','SP','TO'
            ]) AS uf
        ),
        cleaned AS (
            SELECT
                COALESCE(b.id, b._row_hash)         AS decree_id,
                b._ingested_at,
                b._row_hash,
                TRY_CAST(b.date AS DATE)             AS event_date,
                YEAR(TRY_CAST(b.date AS DATE))       AS event_year,
                MONTH(TRY_CAST(b.date AS DATE))      AS event_month,
                b.date                               AS event_date_raw,
                UPPER(TRIM(b.uf))                    AS uf,
                TRIM(b.municipality)                 AS municipality,
                UPPER(TRIM(b.type))                  AS disaster_type,
                LOWER(TRIM(b.source))                AS data_source,
                GREATEST(b.affected, 0)              AS affected_count,
                b.report_type,
                b.collected_at,
                b.status,
                i.cod_ibge
            FROM bronze.stg_s2id_raw b
            INNER JOIN valid_ufs v ON UPPER(TRIM(b.uf)) = v.uf
            LEFT JOIN silver.stg_ibge_municipalities i
                ON UPPER(TRIM(b.municipality)) = i.municipality_normalized
                AND UPPER(TRIM(b.uf)) = i.uf
            WHERE b.municipality IS NOT NULL
              AND TRIM(b.municipality) != ''
              AND TRY_CAST(b.date AS DATE) IS NOT NULL
        ),
        deduped AS (
            SELECT *, ROW_NUMBER() OVER (
                PARTITION BY decree_id ORDER BY _ingested_at DESC
            ) AS rn
            FROM cleaned
        )
        SELECT decree_id, _ingested_at, _row_hash,
               event_date, event_year, event_month, event_date_raw,
               uf, municipality, disaster_type, data_source,
               affected_count, report_type, collected_at, status, cod_ibge
        FROM deduped WHERE rn = 1
    """)
    n = con.execute("SELECT COUNT(*) FROM silver.stg_s2id_clean").fetchone()[0]
    log(f"Silver: {n} registros limpos em silver.stg_s2id_clean")

    # ── GOLD: mart_disasters ─────────────────────────────────────────────
    log("Gold: calculando risk scores por municipio ...")
    con.execute("""
        CREATE OR REPLACE TABLE gold.mart_disasters AS
        WITH counts AS (
            SELECT
                municipality, uf,
                COUNT(*)                                                        AS total_events,
                COUNT(*) FILTER (WHERE event_year >= YEAR(CURRENT_DATE) - 10)  AS last_10y_count,
                COUNT(*) FILTER (WHERE event_year >= YEAR(CURRENT_DATE) - 5)   AS last_5y_count,
                COUNT(*) FILTER (WHERE event_year >= YEAR(CURRENT_DATE) - 1)   AS last_1y_count,
                SUM(affected_count)                                             AS total_affected,
                MAX(event_date)                                                 AS latest_event_date,
                MIN(event_date)                                                 AS earliest_event_date,
                COUNT(DISTINCT disaster_type)                                   AS distinct_disaster_types,
                MODE(disaster_type)                                             AS primary_disaster_type
            FROM silver.stg_s2id_clean
            GROUP BY municipality, uf
        ),
        scored AS (
            SELECT *,
                ROUND((
                    (last_10y_count::FLOAT / NULLIF(MAX(last_10y_count) OVER(), 0)) * 60 +
                    (total_affected::FLOAT  / NULLIF(MAX(total_affected)  OVER(), 0)) * 40
                ) * 100, 1) AS risk_score,
                CASE
                    WHEN last_10y_count >= 20 OR total_affected >= 10000 THEN 'S5 CRITICO'
                    WHEN last_10y_count >= 10 OR total_affected >= 5000  THEN 'S4 ALTO'
                    WHEN last_10y_count >= 5  OR total_affected >= 1000  THEN 'S3 ELEVADO'
                    WHEN last_10y_count >= 2                             THEN 'S2 MODERADO'
                    ELSE 'S1 BAIXO'
                END AS risk_category
            FROM counts
        )
        SELECT municipality, uf, total_events, last_10y_count, last_5y_count,
               last_1y_count, total_affected, latest_event_date, earliest_event_date,
               distinct_disaster_types, primary_disaster_type,
               COALESCE(risk_score, 0) AS risk_score, risk_category,
               CURRENT_TIMESTAMP AS _computed_at
        FROM scored ORDER BY risk_score DESC
    """)
    n = con.execute("SELECT COUNT(*) FROM gold.mart_disasters").fetchone()[0]
    log(f"Gold: {n} municipios em gold.mart_disasters")

    # ── GOLD: mart_analytics ─────────────────────────────────────────────
    log("Gold: calculando serie temporal por UF ...")
    con.execute("""
        CREATE OR REPLACE TABLE gold.mart_analytics AS
        WITH series AS (
            SELECT uf, event_year,
                COUNT(*)            AS event_count,
                SUM(affected_count) AS total_affected
            FROM silver.stg_s2id_clean WHERE event_year IS NOT NULL
            GROUP BY uf, event_year
        ),
        rankings AS (
            SELECT uf,
                SUM(event_count)    AS total_events,
                SUM(total_affected) AS total_affected,
                RANK() OVER (ORDER BY SUM(event_count) DESC)    AS rank_by_events,
                RANK() OVER (ORDER BY SUM(total_affected) DESC) AS rank_by_affected
            FROM series GROUP BY uf
        )
        SELECT r.uf, r.total_events, r.total_affected,
               r.rank_by_events, r.rank_by_affected,
               CURRENT_TIMESTAMP AS _computed_at
        FROM rankings r ORDER BY r.rank_by_events
    """)
    n = con.execute("SELECT COUNT(*) FROM gold.mart_analytics").fetchone()[0]
    log(f"Gold: {n} UFs em gold.mart_analytics")

    # ── GOLD: mart_disasters_geo (spatial) ───────────────────────────────
    geojson = str(ROOT / "server" / "data" / "analytics" / "municipality_geometries.geojson").replace("\\", "/")
    if not Path(geojson).exists():
        log(f"Aviso: municipality_geometries.geojson nao encontrado — pulando mart_disasters_geo")
    else:
        log("Gold: spatial join disasters x geometrias IBGE ...")
        try:
            con.execute(f"""
                CREATE OR REPLACE TABLE gold.mart_disasters_geo AS
                WITH ibge_geo AS (
                    SELECT
                        CD_MUN                              AS cod_ibge,
                        CENSO_2020_POP                      AS pop_2020,
                        AREA_KM2                            AS area_km2,
                        Risco_Ampliado_MCDA_Cat             AS mcda_category,
                        Risco_Ampliado_MCDA_Score           AS mcda_score,
                        principal_ameaca                    AS principal_threat,
                        ST_AsGeoJSON(geom)::VARCHAR         AS geometry_geojson,
                        ST_X(ST_Centroid(geom))             AS lng,
                        ST_Y(ST_Centroid(geom))             AS lat
                    FROM ST_Read('{geojson}')
                    WHERE geom IS NOT NULL
                ),
                ibge_names AS (
                    SELECT DISTINCT cod_ibge, municipality_normalized, uf
                    FROM silver.stg_ibge_municipalities
                ),
                joined AS (
                    SELECT d.municipality, d.uf, g.cod_ibge,
                           d.risk_score, d.risk_category, d.total_events,
                           d.last_10y_count, d.last_5y_count, d.last_1y_count,
                           d.total_affected, d.latest_event_date, d.earliest_event_date,
                           d.distinct_disaster_types, d.primary_disaster_type,
                           g.pop_2020, g.area_km2,
                           ROUND(d.last_10y_count::DOUBLE / NULLIF(g.pop_2020,0) * 100000, 2) AS events_per_100k,
                           g.mcda_category, g.mcda_score, g.principal_threat,
                           g.lat, g.lng, g.geometry_geojson, d._computed_at
                    FROM gold.mart_disasters d
                    LEFT JOIN ibge_names n
                        ON UPPER(TRIM(d.municipality)) = n.municipality_normalized
                        AND d.uf = n.uf
                    LEFT JOIN ibge_geo g ON n.cod_ibge = g.cod_ibge
                )
                SELECT * FROM joined WHERE geometry_geojson IS NOT NULL
            """)
            n = con.execute("SELECT COUNT(*) FROM gold.mart_disasters_geo").fetchone()[0]
            log(f"Gold: {n} municipios em gold.mart_disasters_geo")
        except Exception as e:
            log(f"Aviso: mart_disasters_geo falhou (non-fatal): {e}")

    con.close()

    # ── Resumo ───────────────────────────────────────────────────────────
    print()
    print("=" * 55)
    print("  Pipeline medallion completo!")
    print(f"  DuckDB: {DB_PATH}")
    print()
    print("  Proximos passos:")
    print("    python pipeline/scripts/export_gold_geojson.py")
    print("    npm run dev:all")
    print("=" * 55)


if __name__ == "__main__":
    main()
