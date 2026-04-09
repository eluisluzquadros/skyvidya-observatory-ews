"""
verify_setup.py — Skyvidya EWS Pipeline Setup Checker
Roda antes do primeiro 'npm run pipeline:full' para garantir que tudo está configurado.

Uso: python pipeline/scripts/verify_setup.py
"""
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PASS = "\033[32m[OK]\033[0m"
FAIL = "\033[31m[FAIL]\033[0m"
WARN = "\033[33m[WARN]\033[0m"

errors = 0

def check(label, ok, detail=""):
    global errors
    status = PASS if ok else FAIL
    suffix = f" — {detail}" if detail else ""
    print(f"  {status} {label}{suffix}")
    if not ok:
        errors += 1

def section(title):
    print(f"\n{'─' * 50}")
    print(f"  {title}")
    print('─' * 50)


# ─── Python ───────────────────────────────────────────────
section("Python & Packages")
check(f"Python {sys.version.split()[0]}", True)

for pkg in ["duckdb", "pyarrow", "pandas", "geopandas", "dbt"]:
    try:
        mod = __import__(pkg.replace("-", "_"))
        ver = getattr(mod, "__version__", "?")
        check(f"  {pkg}", True, ver)
    except ImportError:
        check(f"  {pkg}", False, f"pip install {pkg}")


# ─── Source Data ──────────────────────────────────────────
section("Dados de Origem")

db_path = ROOT / "server" / "data" / "database.json"
if db_path.exists():
    with open(db_path) as f:
        db = json.load(f)
    n = len(db.get("disasters", []))
    check("database.json", n > 0, f"{n} registros")
    if n == 0:
        print("    → Execute 'npm run dev:all' e deixe o scraper rodar primeiro")
else:
    check("database.json", False, "arquivo não encontrado")

risk_path = ROOT / "server" / "data" / "analytics" / "risk_analysis.json"
check("risk_analysis.json (mapeamento IBGE)", risk_path.exists(),
      "necessário para stg_ibge_municipalities")

geojson_path = ROOT / "server" / "data" / "analytics" / "municipality_geometries.geojson"
check("municipality_geometries.geojson (base)", geojson_path.exists(),
      "necessário para mart_disasters_geo")


# ─── DuckDB ───────────────────────────────────────────────
section("DuckDB")

import duckdb  # noqa (já validado acima)

con = duckdb.connect()
try:
    con.execute("INSTALL spatial; LOAD spatial;")
    check("Extensão spatial", True)
except Exception as e:
    check("Extensão spatial", False, str(e))
con.close()

bronze_dir = ROOT / "server" / "data" / "duckdb" / "bronze"
latest = bronze_dir / "latest.parquet"
if latest.exists():
    check("Bronze latest.parquet", True, f"{latest.stat().st_size // 1024} KB")
else:
    print(f"  {WARN} Bronze latest.parquet não existe ainda")
    print("    → Execute: npm run bronze:ingest")

ews_db = ROOT / "server" / "data" / "duckdb" / "ews.duckdb"
if ews_db.exists():
    con2 = duckdb.connect(str(ews_db), read_only=True)
    for schema, table in [("silver", "stg_s2id_clean"), ("gold", "mart_disasters"),
                           ("gold", "mart_analytics"), ("gold", "mart_disasters_geo")]:
        try:
            n = con2.execute(f"SELECT COUNT(*) FROM {schema}.{table}").fetchone()[0]
            check(f"ews.duckdb {schema}.{table}", n > 0, f"{n} linhas")
        except Exception as e:
            print(f"  {WARN} {schema}.{table} — {e}")
            print("    → Execute: npm run dbt:run")
    con2.close()
else:
    print(f"  {WARN} ews.duckdb não existe ainda")
    print("    → Execute: npm run bronze:ingest && npm run dbt:run")


# ─── dbt ──────────────────────────────────────────────────
section("dbt")

import subprocess
result = subprocess.run(["dbt", "--version"], capture_output=True, text=True)
if result.returncode == 0:
    ver = result.stdout.strip().split("\n")[0]
    check("dbt CLI", True, ver)
else:
    check("dbt CLI", False, "pip install dbt-duckdb")

dbt_project = ROOT / "pipeline" / "dbt" / "dbt_project.yml"
check("dbt_project.yml", dbt_project.exists())

packages = ROOT / "pipeline" / "dbt" / "dbt_packages"
check("dbt_packages/ (dbt deps executado)", packages.exists(),
      "execute: cd pipeline/dbt && dbt deps" if not packages.exists() else "ok")


# ─── Docker / Kestra ──────────────────────────────────────
section("Docker / Kestra (opcional)")

result = subprocess.run(["docker", "ps"], capture_output=True, text=True)
if result.returncode == 0:
    kestra_up = "ews-kestra" in result.stdout
    check("Docker Desktop rodando", True)
    check("Kestra container ativo", kestra_up,
          "npm run stack:up" if not kestra_up else "http://localhost:8080")
else:
    print(f"  {WARN} Docker não acessível — Kestra não disponível")
    print("    → Kestra é opcional: pipeline manual funciona sem ele")


# ─── Resultado ────────────────────────────────────────────
print(f"\n{'=' * 50}")
if errors == 0:
    print("  \033[32m[OK] Tudo pronto para executar o pipeline!\033[0m")
    print("\n  Próximos passos:")
    print("    npm run pipeline:full   # bronze + dbt + geo-export")
    print("    npm run stack:up        # Kestra UI (opcional)")
else:
    print(f"  \033[31m✗ {errors} problema(s) encontrado(s). Resolva antes de continuar.\033[0m")
print('=' * 50)
sys.exit(0 if errors == 0 else 1)
