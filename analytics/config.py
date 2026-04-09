"""
S2ID Disaster Monitor - Analytics Pipeline Configuration
"""
import os
from pathlib import Path

# === Base Paths ===
PROJECT_ROOT = Path(__file__).parent.parent
ANALYTICS_ROOT = Path(__file__).parent
SERVER_DATA_DIR = PROJECT_ROOT / "server" / "data"
ATLAS_DATA_DIR = SERVER_DATA_DIR / "atlas"
S2ID_DATA_DIR = SERVER_DATA_DIR / "s2id"
ANALYTICS_OUTPUT_DIR = SERVER_DATA_DIR / "analytics"
IBGE_DATA_DIR = ANALYTICS_ROOT / "data" / "ibge"
LOCAL_OUTPUT_DIR = ANALYTICS_ROOT / "data" / "output"
RELATORIOS_DATA_DIR = ANALYTICS_ROOT / "data" / "mdr" / "01_bronze" / "relatorios"

# Ensure output directories exist
ANALYTICS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOCAL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# === IBGE Data ===
IBGE_GEOPARQUET_FILENAME = "BR_Municipios_2024.geoparquet"
IBGE_GEOPARQUET_URL = "https://github.com/skyvidya/ibge-geospatial/raw/main/BR_Municipios_2024.geoparquet"

# Enriched municipal data (população + indicadores socioeconômicos)
# Gerado por: br/02_ingestao_dados_municipios_v1.ipynb
IBGE_ENRIQUECIDO_FILENAME = "BR_Municipios_2024_enriquecido.parquet"

# Colunas socioeconômicas adicionadas pelo enriquecimento
ENRICHED_COLUMNS = [
    "pib_per_capita",
    "pib_total",
    "idhm",
    "densidade_demografica",
    "taxa_mortalidade_infantil",
    "receitas_brutas",
    "despesas_brutas",
]

# === COBRADE Disaster Type Taxonomy ===
# 5-digit codes mapping to disaster names (Portuguese)
COBRADE_MAP = {
    "11321": "Deslizamentos",
    "11331": "Corridas de Massa (Solo/Lama)",
    "11332": "Corridas de Massa (Rocha/Detrito)",
    "12100": "Inundações",
    "12200": "Enxurradas",
    "12300": "Alagamentos",
    "13111": "Estiagem",
    "13112": "Seca",
    "13213": "Tempestade de Granizo",
    "13214": "Chuvas Intensas",
    "13215": "Vendavais",
    "24200": "Rompimento de Barragem",
}

# COBRADE codes for geohidrological threats analysis
COBRADES_OF_INTEREST = list(COBRADE_MAP.keys())

# === Temporal Aggregation Periods ===
# (years_back_from_now, offset_years) - 0 offset means "until now"
PERIODS_CONFIG = {
    "HISTORIC": (100, 0),       # All-time (up to 100 years back)
    "LAST10_YEARS": (10, 0),    # Last 10 years
    "LAST05_YEARS": (5, 0),     # Last 5 years
    "LAST02_YEARS": (2, 0),     # Last 2 years
}

# === MCDA Risk Scoring ===
# 8 criteria for Multi-Criteria Decision Analysis
COLUMNS_FOR_RISK_SCORE_MCDA = [
    "HISTORIC_COUNT",
    "LAST10_YEARS_COUNT",
    "LAST05_YEARS_COUNT",
    "LAST02_YEARS_COUNT",
    "HISTORIC_COUNT_POR_10K_HAB",
    "LAST10_YEARS_COUNT_POR_10K_HAB",
    "LAST05_YEARS_COUNT_POR_10K_HAB",
    "LAST02_YEARS_COUNT_POR_10K_HAB",
]

# Risk categories (5 levels, Portuguese)
RISK_CATEGORIES = ["Muito Baixo", "Baixo", "Médio", "Alto", "Muito Alto"]

# === LISA Spatial Analysis ===
LISA_CONFIG = {
    "DEFAULT_WEIGHT_TYPE": "queen",  # queen, rook, or knn
    "DEFAULT_KNN_K": 8,
    "DEFAULT_P_VALUE_THRESHOLD": 0.05,
    "DEFAULT_PERMUTATIONS": 999,
    "SEED": 12345,
}

# LISA quadrant labels
LISA_QUADRANT_LABELS = {
    1: "HH (Alto-Alto)",
    2: "LH (Baixo-Alto)",
    3: "LL (Baixo-Baixo)",
    4: "HL (Alto-Baixo)",
}

LISA_SPOT_LABELS = [
    "0 ns (Não Significativo)",
    "1 HH (Hot Spot)",
    "2 LH (Anel Baixo-Alto)",
    "3 LL (Cold Spot)",
    "4 HL (Anel Alto-Baixo)",
]

# === Validity Period ===
DEFAULT_VALIDITY_DAYS = 90

# === GeoJSON Simplification ===
GEOJSON_SIMPLIFY_TOLERANCE = 0.005  # Douglas-Peucker tolerance for web rendering

# === Atlas CSV Column Mapping ===
# Maps Atlas Digital CSV columns to internal standardized names
ATLAS_CSV_COLUMNS = {
    "Cod_Cobrade": "COD_COBRADE",
    "Nome_Cobrade": "COBRADE_NAME",
    "Cod_IBGE_Municipio": "CD_MUN",
    "Nome_Municipio": "NM_MUN",
    "UF": "SIGLA_UF",
    "Data_Registro": "DATA_REGISTRO",
    "Data_Evento": "DATA_EVENTO",
    "Tipo_Desastre": "TIPO_DESASTRE",
    "Grupo_De_Desastre": "GRUPO_DE_DESASTRE",
    "Status": "STATUS",
    "Protocolo": "PROTOCOLO",
}

# === Human Damage Fields (from Danos_Informados CSVs) ===
HUMAN_DAMAGE_FIELDS = [
    "DH_Mortos",
    "DH_Feridos",
    "DH_Enfermos",
    "DH_Desabrigados",
    "DH_Desalojados",
    "DH_Desaparecidos",
    "DH_Outros Afetados",
]

# === Economic Damage Fields (from Danos_Informados CSVs) ===
# PEPR = Perdas Econômicas Setor Privado (R$)
# PEPL = Perdas em Serviços Públicos Essenciais (R$)
ECONOMIC_DAMAGE_FIELDS = [
    "PEPR_Agricultura (R$)",
    "PEPR_Pecuária (R$)",
    "PEPR_Indústria (R$)",
    "PEPR_Comércio (R$)",
    "PEPR_Serviços (R$)",
    "PEPL_Assistência médica, saúde pública e atendimento de emergências médicas (R$)",
    "PEPL_Ensino (R$)",
    "PEPL_Transportes locais, regionais e de longo curso (R$)",
    "PEPL_Geração e distribuição de energia elétrica (R$)",
]

# Short keys for JSON output (mapped from ECONOMIC_DAMAGE_FIELDS)
DAMAGE_COLUMN_MAP = {
    "PEPR_Agricultura (R$)":   "peprAgricultura",
    "PEPR_Pecuária (R$)":      "peprPecuaria",
    "PEPR_Indústria (R$)":     "peprIndustria",
    "PEPR_Comércio (R$)":      "peprComercio",
    "PEPR_Serviços (R$)":      "peprServicos",
    "PEPL_Assistência médica, saúde pública e atendimento de emergências médicas (R$)": "peplSaude",
    "PEPL_Ensino (R$)":        "peplEnsino",
    "PEPL_Transportes locais, regionais e de longo curso (R$)": "peplTransportes",
    "PEPL_Geração e distribuição de energia elétrica (R$)":     "peplEnergia",
    "DH_Mortos":               "dhMortos",
    "DH_Desabrigados":         "dhDesabrigados",
    "DH_Desalojados":          "dhDesalojados",
    "DH_Outros Afetados":      "dhOutrosAfetados",
}

# === Server Configuration ===
FASTAPI_HOST = "0.0.0.0"
FASTAPI_PORT = 8000
EXPRESS_BACKEND_URL = "http://localhost:3001"

# === UF Filter (None = all states) ===
UFS_TO_FILTER = None  # Set to ["RS"] to filter to Rio Grande do Sul only

# === LLM Generated Reports ===
LLM_REPORTS_DIR = ANALYTICS_OUTPUT_DIR / "generated_reports"
LLM_REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# === Reporting Assets Configuration ===
REPORTING_CONFIG = {
    "OUTPUT_DIR": ANALYTICS_OUTPUT_DIR / "report_assets",
    "TOP_N_MUNICIPALITIES": 10,
    "STATES_TO_GENERATE": None,  # None = only national; list like ["RS", "SC"] for per-state
    "DPI": 150,
    "LISA_VARIABLES": None,      # None = first 2 available; or ["HISTORIC_COUNT", "LAST10_YEARS_COUNT"]
}
