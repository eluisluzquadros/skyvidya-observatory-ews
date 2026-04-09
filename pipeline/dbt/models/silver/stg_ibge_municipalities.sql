-- Silver: referência IBGE de municípios
-- Fonte: risk_analysis.json (gerado pelo pipeline Python existente)
-- Fornece cod_ibge para enriquecer stg_s2id_clean e futuros spatial joins

{{ config(materialized='table', schema='silver') }}

SELECT
    cd_mun                          AS cod_ibge,
    UPPER(TRIM(name))               AS municipality_normalized,
    UPPER(TRIM(uf))                 AS uf
FROM read_json_auto(
    '{{ env_var("EWS_DATA_DIR", "../../server/data") }}/analytics/risk_analysis.json'
)
WHERE cd_mun IS NOT NULL
  AND name IS NOT NULL
  AND uf IS NOT NULL
