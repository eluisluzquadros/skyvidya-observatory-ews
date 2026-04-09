"""
Bronze Ingest — Skyvidya EWS
Converte database.json → GeoParquet na camada Bronze do DuckDB.
Pode ser chamado standalone (python bronze_ingest.py) ou pelo Kestra.
"""
import duckdb
import json
import os
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "server" / "data"
BRONZE_DIR = DATA_DIR / "duckdb" / "bronze"
DB_PATH = DATA_DIR / "database.json"


def ingest():
    BRONZE_DIR.mkdir(parents=True, exist_ok=True)

    if not DB_PATH.exists():
        print(f"[bronze_ingest] ERRO: {DB_PATH} não encontrado", file=sys.stderr)
        sys.exit(1)

    with open(DB_PATH, encoding='utf-8') as f:
        db = json.load(f)

    disasters = db.get("disasters", [])
    if not disasters:
        print("[bronze_ingest] Nenhum registro em database.json — nada a ingerir")
        return

    print(f"[bronze_ingest] Ingerindo {len(disasters)} registros...")

    # Dump flat JSON para DuckDB leitura (DuckDB lê JSON array diretamente)
    flat_path = BRONZE_DIR / "source_disasters.json"
    with open(flat_path, "w") as f:
        json.dump(disasters, f)

    con = duckdb.connect()
    try:
        con.execute("INSTALL spatial; LOAD spatial;")
    except Exception:
        pass  # Extensão já instalada

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    con.execute(f"""
        CREATE TABLE bronze_disasters AS
        SELECT
            '{run_id}'          AS _pipeline_run_id,
            CURRENT_TIMESTAMP   AS _ingested_at,
            'database.json'     AS _source_file,
            *
        FROM read_json_auto('{flat_path}', ignore_errors=true, auto_detect=true)
        WHERE id IS NOT NULL
    """)

    count = con.execute("SELECT COUNT(*) FROM bronze_disasters").fetchone()[0]

    # Salvar snapshot com timestamp
    snapshot_path = BRONZE_DIR / f"s2id_disasters_{run_id}.parquet"
    con.execute(f"COPY bronze_disasters TO '{snapshot_path}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    # Salvar latest.parquet (referenciado pelo dbt Bronze model)
    latest_path = BRONZE_DIR / "latest.parquet"
    con.execute(f"COPY bronze_disasters TO '{latest_path}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    con.close()
    print(f"[bronze_ingest] OK: {count} registros -> {snapshot_path.name} + latest.parquet")


if __name__ == "__main__":
    ingest()
