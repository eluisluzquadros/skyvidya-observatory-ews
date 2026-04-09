-- Bronze: ingestão raw do database.json → DuckDB
-- Schema real: id, municipality, uf, type, date, status, affected, source, reportType, collectedAt
-- Sem transformações — preserva dado exatamente como veio da fonte
-- Adiciona colunas de auditoria: _ingested_at, _source_file, _row_hash

{{ config(materialized='table', schema='bronze') }}

WITH source AS (
    SELECT
        _pipeline_run_id,
        _ingested_at,
        _source_file,
        md5(id || COALESCE(date::VARCHAR,'') || COALESCE(municipality,'')) AS _row_hash,

        -- Campos originais do database.json (schema real validado em 2026-04-03)
        id,
        date::VARCHAR               AS date,
        municipality,
        uf,
        type,
        COALESCE(status, 'active')  AS status,
        CAST(COALESCE(affected, 0) AS INTEGER) AS affected,
        source,
        reportType                  AS report_type,
        collectedAt                 AS collected_at
    FROM read_parquet(
        '{{ env_var("EWS_DATA_DIR", "../../server/data") }}/duckdb/bronze/latest.parquet'
    )
    WHERE id IS NOT NULL
)

SELECT * FROM source
