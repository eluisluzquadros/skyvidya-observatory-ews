"""
S2ID Analytics - GeoRAG Engine
Port of Notebook 05: 05_analise_mdr_s2id_rag_geoespacial.ipynb

Retrieval-Augmented Generation with geospatial disaster risk data.
Uses vector embeddings for semantic search, DuckDB for spatial queries,
and rule-based query parsing for natural language understanding.
"""

import json
import logging
import re
from pathlib import Path
from typing import Any

import pandas as pd

from config import ANALYTICS_OUTPUT_DIR, COBRADE_MAP, RISK_CATEGORIES

logger = logging.getLogger(__name__)

# Lazy imports for heavy dependencies
_engine_instance = None


class GeoRAGEngine:
    """
    Geospatial RAG engine for querying municipality risk profiles.

    Uses:
    - DuckDB for efficient SQL-based spatial queries
    - Rule-based query parsing (no LLM needed for query understanding)
    - Pre-computed risk data from the analytics pipeline
    """

    def __init__(self):
        self.risk_data: list[dict] = []
        self.conn = None
        self._load_data()
        self._setup_duckdb()

    def _load_data(self):
        """Load risk analysis data from JSON."""
        risk_path = ANALYTICS_OUTPUT_DIR / "risk_analysis.json"
        if not risk_path.exists():
            raise FileNotFoundError(
                f"Risk analysis data not found at {risk_path}. "
                "Run the analytics pipeline first."
            )

        with open(risk_path, "r", encoding="utf-8") as f:
            self.risk_data = json.load(f)

        logger.info(f"GeoRAG loaded {len(self.risk_data)} municipalities")

    def _setup_duckdb(self):
        """Initialize DuckDB with municipality data."""
        import duckdb

        self.conn = duckdb.connect(":memory:")

        # Convert to DataFrame for DuckDB registration
        df = pd.DataFrame(self.risk_data)

        # Flatten ratesPer10k
        if "ratesPer10k" in df.columns:
            rates = pd.json_normalize(df["ratesPer10k"])
            rates.columns = [f"rate_{c}" for c in rates.columns]
            df = pd.concat([df.drop(columns=["ratesPer10k"]), rates], axis=1)

        # Drop complex nested columns
        if "cobradeBreakdown" in df.columns:
            df = df.drop(columns=["cobradeBreakdown"])

        self.conn.register("municipios", df)
        logger.info("DuckDB initialized with municipality data")

    def parse_query(self, query: str) -> dict:
        """
        Rule-based natural language query parser.

        Detects:
        - Query type: ranking, filter, or general
        - Criteria: seguranca, risco, trend, threat
        - Limit: number of results
        - UF filter: state abbreviation
        """
        q = query.lower().strip()

        # Detect query type
        if any(w in q for w in ["top", "melhores", "primeiras", "maiores", "piores", "ranking"]):
            tipo = "ranking"
        elif any(w in q for w in ["região", "estado", "próximo", "perto", "uf"]):
            tipo = "filtro_espacial"
        else:
            tipo = "busca_geral"

        # Detect criteria
        if any(w in q for w in ["segura", "segurança", "seguro", "menos risco"]):
            criterio = "seguranca"
        elif any(w in q for w in ["risco", "perigosa", "perigoso", "vulnerável", "maior risco"]):
            criterio = "risco"
        elif any(w in q for w in ["crescente", "tendência", "aumentando", "pioran"]):
            criterio = "tendencia_crescente"
        elif any(w in q for w in ["decrescente", "melhorand", "diminuind"]):
            criterio = "tendencia_decrescente"
        elif any(w in q for w in ["inundaç", "enchent", "flood"]):
            criterio = "ameaca_inundacao"
        elif any(w in q for w in ["desliza", "landslide"]):
            criterio = "ameaca_deslizamento"
        elif any(w in q for w in ["seca", "estiag", "drought"]):
            criterio = "ameaca_seca"
        elif any(w in q for w in ["qualidade", "vida", "viver"]):
            criterio = "qualidade"
        else:
            criterio = "geral"

        # Extract limit
        numbers = re.findall(r"\d+", query)
        limite = int(numbers[0]) if numbers else 10

        # Extract UF filter
        ufs = [
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
            "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
            "RS", "RO", "RR", "SC", "SP", "SE", "TO",
        ]
        uf_filter = None
        for uf in ufs:
            if uf.lower() in q or uf in query.upper():
                uf_filter = uf
                break

        # Also check state names
        state_names = {
            "rio grande do sul": "RS", "são paulo": "SP", "santa catarina": "SC",
            "paraná": "PR", "minas gerais": "MG", "rio de janeiro": "RJ",
            "bahia": "BA", "pernambuco": "PE", "ceará": "CE", "amazonas": "AM",
            "pará": "PA", "goiás": "GO", "mato grosso": "MT",
        }
        for name, code in state_names.items():
            if name in q:
                uf_filter = code
                break

        return {
            "tipo": tipo,
            "criterio": criterio,
            "limite": min(limite, 50),  # Cap at 50
            "uf_filter": uf_filter,
            "query_original": query,
        }

    def execute_query(self, parsed: dict) -> pd.DataFrame:
        """Execute spatial query based on parsed parameters."""
        criterio = parsed["criterio"]
        limite = parsed["limite"]
        uf = parsed["uf_filter"]

        uf_clause = f"WHERE uf = '{uf}'" if uf else ""

        if criterio == "seguranca":
            sql = f"""
                SELECT * FROM municipios
                {uf_clause}
                ORDER BY riskScore ASC, population DESC
                LIMIT {limite}
            """
        elif criterio == "risco":
            sql = f"""
                SELECT * FROM municipios
                {uf_clause}
                ORDER BY riskScore DESC
                LIMIT {limite}
            """
        elif criterio == "tendencia_crescente":
            where = f"WHERE trend = 'Crescente'" + (f" AND uf = '{uf}'" if uf else "")
            sql = f"""
                SELECT * FROM municipios
                {where}
                ORDER BY riskScore DESC
                LIMIT {limite}
            """
        elif criterio == "tendencia_decrescente":
            where = f"WHERE trend = 'Decrescente'" + (f" AND uf = '{uf}'" if uf else "")
            sql = f"""
                SELECT * FROM municipios
                {where}
                ORDER BY riskScore DESC
                LIMIT {limite}
            """
        elif "ameaca_" in criterio:
            threat_map = {
                "ameaca_inundacao": ["Inundações", "Enxurradas", "Alagamentos"],
                "ameaca_deslizamento": ["Deslizamentos", "Corridas de Massa"],
                "ameaca_seca": ["Estiagem", "Seca"],
            }
            threats = threat_map.get(criterio, [])
            threat_filter = " OR ".join(f"principalThreat LIKE '%{t}%'" for t in threats)
            where = f"WHERE ({threat_filter})" + (f" AND uf = '{uf}'" if uf else "")
            sql = f"""
                SELECT * FROM municipios
                {where}
                ORDER BY riskScore DESC
                LIMIT {limite}
            """
        else:
            # General/balanced query
            sql = f"""
                SELECT * FROM municipios
                {uf_clause}
                ORDER BY riskScore DESC
                LIMIT {limite}
            """

        try:
            return self.conn.execute(sql).fetchdf()
        except Exception as e:
            logger.error(f"DuckDB query failed: {e}")
            return pd.DataFrame()

    def generate_response(self, query: str, results: pd.DataFrame, parsed: dict) -> str:
        """Generate a formatted text response from query results."""
        if results.empty:
            return "Nenhum município encontrado para os critérios especificados."

        criterio = parsed["criterio"]
        uf = parsed["uf_filter"]
        total = len(results)

        # Header
        uf_text = f" do {uf}" if uf else " do Brasil"
        lines = []

        if criterio == "seguranca":
            lines.append(f"Top {total} municípios mais seguros{uf_text}:\n")
        elif criterio == "risco":
            lines.append(f"Top {total} municípios com maior risco{uf_text}:\n")
        elif criterio == "tendencia_crescente":
            lines.append(f"Municípios com tendência crescente de desastres{uf_text}:\n")
        elif criterio == "tendencia_decrescente":
            lines.append(f"Municípios com tendência decrescente{uf_text}:\n")
        elif "ameaca_" in criterio:
            lines.append(f"Municípios afetados por {criterio.replace('ameaca_', '')}{uf_text}:\n")
        else:
            lines.append(f"Resultado da consulta ({total} municípios{uf_text}):\n")

        # Results table
        for i, (_, row) in enumerate(results.iterrows()):
            risk_pct = row.get("riskScore", 0) * 100
            cat = row.get("riskCategory", "N/A")
            trend = row.get("trend", "N/A")
            name = row.get("name", "N/A")
            uf_val = row.get("uf", "")
            pop = int(row.get("population", 0))
            threat = row.get("principalThreat", "N/A")

            lines.append(
                f"{i+1}. {name} ({uf_val}) - "
                f"Risco: {cat} ({risk_pct:.1f}%) | "
                f"Tendência: {trend} | "
                f"Ameaça: {threat} | "
                f"Pop: {pop:,}"
            )

        # Summary
        if total >= 3:
            high_risk = results[results.get("riskCategory", pd.Series()) == "Muito Alto"]
            growing = results[results.get("trend", pd.Series()) == "Crescente"]
            lines.append(f"\nResumo: {len(high_risk)} em risco muito alto, {len(growing)} com tendência crescente.")

        return "\n".join(lines)

    def query(self, user_question: str) -> dict:
        """
        Complete GeoRAG pipeline: parse -> query -> generate response.

        Returns dict with textResponse, municipalities, queryType, totalResults.
        """
        # Parse
        parsed = self.parse_query(user_question)
        logger.info(f"GeoRAG parsed: {parsed}")

        # Execute
        results = self.execute_query(parsed)

        # Generate text
        text = self.generate_response(user_question, results, parsed)

        # Convert results to municipality format
        municipalities = []
        for _, row in results.iterrows():
            mun = {
                "cd_mun": str(row.get("cd_mun", "")),
                "name": str(row.get("name", "")),
                "uf": str(row.get("uf", "")),
                "population": int(row.get("population", 0)),
                "area_km2": float(row.get("area_km2", 0)),
                "riskScore": float(row.get("riskScore", 0)),
                "riskCategory": str(row.get("riskCategory", "")),
                "trend": str(row.get("trend", "")),
                "principalThreat": str(row.get("principalThreat", "")),
                "historicCount": int(row.get("historicCount", 0)),
                "last10yrCount": int(row.get("last10yrCount", 0)),
                "last5yrCount": int(row.get("last5yrCount", 0)),
                "last2yrCount": int(row.get("last2yrCount", 0)),
                "ratesPer10k": {
                    "historic": float(row.get("rate_historic", 0)),
                    "last10yr": float(row.get("rate_last10yr", 0)),
                    "last5yr": float(row.get("rate_last5yr", 0)),
                    "last2yr": float(row.get("rate_last2yr", 0)),
                },
                "lat": float(row.get("lat", 0)) if row.get("lat") else None,
                "lng": float(row.get("lng", 0)) if row.get("lng") else None,
            }
            municipalities.append(mun)

        return {
            "textResponse": text,
            "municipalities": municipalities,
            "queryType": parsed["criterio"],
            "totalResults": len(municipalities),
        }

    @classmethod
    def get_instance(cls) -> "GeoRAGEngine":
        """Singleton pattern for the GeoRAG engine."""
        global _engine_instance
        if _engine_instance is None:
            _engine_instance = cls()
        return _engine_instance

    @classmethod
    def reset_instance(cls):
        """Reset the singleton (e.g., after pipeline re-run)."""
        global _engine_instance
        _engine_instance = None
