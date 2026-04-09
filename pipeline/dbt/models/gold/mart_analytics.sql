-- Gold: dados para o painel analítico (LISA input, MCDA, distribuições)
-- Alimenta /api/analytics/* do Express
-- Granularidade: UF × ano × tipo de desastre

{{ config(materialized='table', schema='gold') }}

WITH silver AS (
    SELECT * FROM {{ ref('stg_s2id_clean') }}
),

-- Série temporal por UF e ano
uf_year_series AS (
    SELECT
        uf,
        event_year,
        COUNT(*)            AS event_count,
        SUM(affected_count) AS total_affected,
        COUNT(DISTINCT municipality) AS municipalities_hit,
        COUNT(DISTINCT disaster_type) AS disaster_type_diversity,
        -- Tipos mais comuns como lista
        LIST(DISTINCT disaster_type ORDER BY disaster_type)[:5] AS top_disaster_types
    FROM silver
    WHERE event_year IS NOT NULL
    GROUP BY uf, event_year
),

-- Ranking de UFs por décadas
uf_rankings AS (
    SELECT
        uf,
        SUM(event_count)    AS total_events,
        SUM(total_affected) AS total_affected,
        -- Ranking por contagem de eventos (1 = mais afetado)
        RANK() OVER (ORDER BY SUM(event_count) DESC)    AS rank_by_events,
        RANK() OVER (ORDER BY SUM(total_affected) DESC) AS rank_by_affected
    FROM uf_year_series
    GROUP BY uf
),

-- Distribuição por tipo de desastre (para gráfico de pizza/barras no frontend)
type_distribution AS (
    SELECT
        disaster_type,
        COUNT(*)                                    AS total,
        COUNT(*) FILTER (WHERE event_year >= 2015)  AS since_2015,
        ROUND(COUNT(*)::FLOAT / SUM(COUNT(*)) OVER () * 100, 1) AS pct_total
    FROM silver
    WHERE disaster_type IS NOT NULL
    GROUP BY disaster_type
    ORDER BY total DESC
)

-- Resultado: uma linha por UF com métricas agregadas
SELECT
    r.uf,
    r.total_events,
    r.total_affected,
    r.rank_by_events,
    r.rank_by_affected,
    -- Série temporal como JSON embarcado (para recharts no frontend)
    TO_JSON(
        LIST({
            year: s.event_year,
            count: s.event_count,
            affected: s.total_affected
        } ORDER BY s.event_year)
    ) AS yearly_series,
    CURRENT_TIMESTAMP AS _computed_at
FROM uf_rankings r
LEFT JOIN uf_year_series s USING (uf)
GROUP BY r.uf, r.total_events, r.total_affected, r.rank_by_events, r.rank_by_affected
ORDER BY r.rank_by_events
