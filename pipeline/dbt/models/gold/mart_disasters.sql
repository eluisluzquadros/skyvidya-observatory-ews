-- Gold: agregações por município e UF para o frontend
-- Alimenta os endpoints /api/disasters e /api/stats do Express
-- Serve como base para MCDA scores e rankings

{{ config(materialized='table', schema='gold') }}

WITH silver AS (
    SELECT * FROM {{ ref('stg_s2id_clean') }}
),

-- Contagens por município ao longo do tempo
municipality_counts AS (
    SELECT
        municipality,
        uf,
        COUNT(*)                                          AS total_events,
        COUNT(*) FILTER (WHERE event_year >= YEAR(CURRENT_DATE) - 10) AS last_10y_count,
        COUNT(*) FILTER (WHERE event_year >= YEAR(CURRENT_DATE) - 5)  AS last_5y_count,
        COUNT(*) FILTER (WHERE event_year >= YEAR(CURRENT_DATE) - 1)  AS last_1y_count,
        SUM(affected_count)                               AS total_affected,
        MAX(event_date)                                   AS latest_event_date,
        MIN(event_date)                                   AS earliest_event_date,
        COUNT(DISTINCT disaster_type)                     AS distinct_disaster_types,
        -- Tipo mais frequente
        MODE(disaster_type)                               AS primary_disaster_type
    FROM silver
    GROUP BY municipality, uf
),

-- Score de risco simples (0-100) baseado em frequência e afetados
-- MCDA completo fica no Python pipeline existente
risk_scores AS (
    SELECT
        *,
        ROUND(
            (
                (last_10y_count::FLOAT / NULLIF(MAX(last_10y_count) OVER (), 0)) * 60 +
                (total_affected::FLOAT  / NULLIF(MAX(total_affected)  OVER (), 0)) * 40
            ) * 100
        , 1) AS risk_score_raw,

        CASE
            WHEN last_10y_count >= 20 OR total_affected >= 10000 THEN 'S5 CRÍTICO'
            WHEN last_10y_count >= 10 OR total_affected >= 5000  THEN 'S4 ALTO'
            WHEN last_10y_count >= 5  OR total_affected >= 1000  THEN 'S3 ELEVADO'
            WHEN last_10y_count >= 2                             THEN 'S2 MODERADO'
            ELSE 'S1 BAIXO'
        END AS risk_category
    FROM municipality_counts
)

SELECT
    municipality,
    uf,
    total_events,
    last_10y_count,
    last_5y_count,
    last_1y_count,
    total_affected,
    latest_event_date,
    earliest_event_date,
    distinct_disaster_types,
    primary_disaster_type,
    COALESCE(risk_score_raw, 0) AS risk_score,
    risk_category,
    CURRENT_TIMESTAMP AS _computed_at
FROM risk_scores
ORDER BY risk_score DESC
