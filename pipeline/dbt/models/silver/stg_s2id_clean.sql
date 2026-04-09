-- Silver: limpeza, deduplicação, enriquecimento com IBGE
-- Regras: UF válida, data parseable, município não nulo, dedup por id
-- Join com IBGE para cod_ibge do município

{{ config(
    materialized='incremental',
    schema='silver',
    unique_key='decree_id',
    incremental_strategy='delete+insert'
) }}

WITH bronze AS (
    SELECT * FROM {{ ref('stg_s2id_raw') }}
),

ibge AS (
    SELECT * FROM {{ ref('stg_ibge_municipalities') }}
),

valid_ufs AS (
    SELECT unnest([
        'AC','AL','AM','AP','BA','CE','DF','ES','GO',
        'MA','MG','MS','MT','PA','PB','PE','PI','PR',
        'RJ','RN','RO','RR','RS','SC','SE','SP','TO'
    ]) AS uf
),

cleaned AS (
    SELECT
        COALESCE(b.id, b._row_hash)       AS decree_id,
        b._ingested_at,
        b._row_hash,

        TRY_CAST(b.date AS DATE)           AS event_date,
        YEAR(TRY_CAST(b.date AS DATE))     AS event_year,
        MONTH(TRY_CAST(b.date AS DATE))    AS event_month,
        b.date                             AS event_date_raw,

        UPPER(TRIM(b.uf))                  AS uf,
        TRIM(b.municipality)               AS municipality,

        UPPER(TRIM(b.type))                AS disaster_type,
        LOWER(TRIM(b.source))              AS data_source,

        GREATEST(b.affected, 0)            AS affected_count,

        b.status,
        b.report_type,
        b.collected_at,
        i.cod_ibge

    FROM bronze b
    INNER JOIN valid_ufs v ON UPPER(TRIM(b.uf)) = v.uf
    LEFT JOIN ibge i
        ON UPPER(TRIM(b.municipality)) = i.municipality_normalized
        AND UPPER(TRIM(b.uf)) = i.uf
    WHERE
        b.municipality IS NOT NULL
        AND TRIM(b.municipality) != ''
        AND TRY_CAST(b.date AS DATE) IS NOT NULL

    {% if is_incremental() %}
        AND b._ingested_at > (SELECT MAX(_ingested_at) FROM {{ this }})
    {% endif %}
),

deduped AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY decree_id
            ORDER BY _ingested_at DESC
        ) AS rn
    FROM cleaned
)

SELECT
    decree_id,
    _ingested_at,
    _row_hash,
    event_date,
    event_year,
    event_month,
    event_date_raw,
    uf,
    municipality,
    disaster_type,
    data_source,
    affected_count,
    status,
    report_type,
    collected_at,
    cod_ibge
FROM deduped
WHERE rn = 1
