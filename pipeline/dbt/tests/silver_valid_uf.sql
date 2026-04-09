-- Teste: todos os registros têm UF válida (já garantido pela Silver, mas verificamos Gold)
SELECT uf, COUNT(*) AS cnt
FROM {{ ref('mart_disasters') }}
WHERE uf NOT IN (
    'AC','AL','AM','AP','BA','CE','DF','ES','GO',
    'MA','MG','MS','MT','PA','PB','PE','PI','PR',
    'RJ','RN','RO','RR','RS','SC','SE','SP','TO'
)
HAVING COUNT(*) > 0
