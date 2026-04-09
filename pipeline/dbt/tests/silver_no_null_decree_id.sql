-- Teste: nenhum decree_id nulo na camada Silver
SELECT COUNT(*) AS null_count
FROM {{ ref('stg_s2id_clean') }}
WHERE decree_id IS NULL
HAVING COUNT(*) > 0
