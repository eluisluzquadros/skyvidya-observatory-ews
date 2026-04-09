-- Gold Espacial: join mart_disasters × geometrias IBGE via cod_ibge
-- Usa DuckDB spatial extension (ST_Read, ST_Centroid, ST_AsGeoJSON)
-- Substitui gradualmente o centróide por UF por coordenadas municipais precisas
-- Output: GeoParquet com geometry column — lido por bronze_ingest.py → GeoJSON Express

{{ config(
    materialized='table',
    schema='gold',
    tags=['gold', 'spatial', 'geojson']
) }}

-- Carrega geometrias IBGE diretamente do GeoParquet (fonte primária — 5573 municípios)
-- Evita dependência circular com municipality_geometries.geojson (arquivo de saída)
WITH ibge_geo AS (
    SELECT
        CD_MUN                      AS cod_ibge,
        CENSO_2020_POP              AS pop_2020,
        AREA_KM2                    AS area_km2,
        NULL::VARCHAR               AS mcda_category,
        NULL::DOUBLE                AS mcda_score,
        NULL::VARCHAR               AS principal_threat,
        geom                        AS geometry,
        ST_X(ST_Centroid(geom))     AS lng,
        ST_Y(ST_Centroid(geom))     AS lat
    FROM ST_Read(
        '{{ env_var("EWS_ANALYTICS_DIR", "../../../analytics/data/ibge") }}/BR_Municipios_2024.geoparquet'
    )
    WHERE geom IS NOT NULL
),

disasters AS (
    SELECT * FROM {{ ref('mart_disasters') }}
),

-- Mapeamento Silver: municipality normalizado → cod_ibge
ibge_names AS (
    SELECT DISTINCT cod_ibge, municipality_normalized, uf
    FROM {{ ref('stg_ibge_municipalities') }}
),

joined AS (
    SELECT
        -- Identificação
        d.municipality,
        d.uf,
        g.cod_ibge,

        -- Risco EWS (calculado pelo pipeline)
        d.risk_score,
        d.risk_category,
        d.total_events,
        d.last_10y_count,
        d.last_5y_count,
        d.last_1y_count,
        d.total_affected,
        d.latest_event_date,
        d.earliest_event_date,
        d.distinct_disaster_types,
        d.primary_disaster_type,

        -- Contexto IBGE
        g.pop_2020,
        g.area_km2,
        -- Risco por população (eventos por 100k hab)
        ROUND(
            d.last_10y_count::DOUBLE / NULLIF(g.pop_2020, 0) * 100000
        , 2)                                AS events_per_100k,
        g.mcda_category,
        g.mcda_score,
        g.principal_threat,

        -- Coordenadas precisas do centróide municipal
        g.lat,
        g.lng,

        -- Geometria do polígono (para choropleth)
        g.geometry,

        d._computed_at
    FROM disasters d
    -- Step 1: resolve municipality name → cod_ibge via Silver mapping table
    LEFT JOIN ibge_names n
        ON UPPER(TRIM(d.municipality)) = n.municipality_normalized
        AND d.uf = n.uf
    -- Step 2: join geometry using cod_ibge resolved above
    LEFT JOIN ibge_geo g ON n.cod_ibge = g.cod_ibge
),

-- Municípios IBGE sem match no pipeline (tem geometria mas não tem eventos)
-- Incluídos com risk_score = 0 para choropleth completo do Brasil
ibge_only AS (
    SELECT
        g.cod_ibge,
        NULL::VARCHAR       AS municipality,
        NULL::VARCHAR       AS uf,
        0.0                 AS risk_score,
        'S1 BAIXO'          AS risk_category,
        0                   AS total_events,
        0                   AS last_10y_count,
        0                   AS last_5y_count,
        0                   AS last_1y_count,
        0                   AS total_affected,
        NULL::DATE          AS latest_event_date,
        NULL::DATE          AS earliest_event_date,
        0                   AS distinct_disaster_types,
        NULL::VARCHAR       AS primary_disaster_type,
        g.pop_2020,
        g.area_km2,
        0.0                 AS events_per_100k,
        g.mcda_category,
        g.mcda_score,
        g.principal_threat,
        g.lat,
        g.lng,
        g.geometry,
        CURRENT_TIMESTAMP   AS _computed_at
    FROM ibge_geo g
    WHERE g.cod_ibge NOT IN (SELECT cod_ibge FROM joined WHERE cod_ibge IS NOT NULL)
)

SELECT * FROM joined   WHERE geometry IS NOT NULL
UNION ALL
SELECT * FROM ibge_only WHERE geometry IS NOT NULL
