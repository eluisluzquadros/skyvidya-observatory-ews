"""
S2ID Analytics - GeoRAG Engine
Port of Notebook 05: 05_analise_mdr_s2id_rag_geoespacial.ipynb

Retrieval-Augmented Generation with geospatial disaster risk data.
Uses vector embeddings for semantic search, DuckDB for spatial queries,
and rule-based query parsing for natural language understanding.
"""

import csv
import io
import json
import logging
import re
from itertools import islice
from pathlib import Path
from typing import Any

import pandas as pd

from config import ANALYTICS_OUTPUT_DIR, COBRADE_MAP, RISK_CATEGORIES

logger = logging.getLogger(__name__)

# Chromadb/embeddings persisted path
CHROMA_DIR = Path(__file__).resolve().parent.parent / "data" / "chroma"
EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

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
        self._chroma_col: Any = None  # Populated by setup_vector_store()
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

    # ── C1: Vector Embeddings ─────────────────────────────────────────────────

    def setup_vector_store(self) -> bool:
        """
        Build a ChromaDB collection with municipality embeddings.
        Uses paraphrase-multilingual-MiniLM-L12-v2 (~420MB, multilingual).
        Persists to analytics/data/chroma/ to avoid re-building on restart.
        Returns True if newly built, False if loaded from cache.
        """
        try:
            import chromadb
            from sentence_transformers import SentenceTransformer

            CHROMA_DIR.mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=str(CHROMA_DIR))

            # If collection already exists with the right count, skip rebuild
            try:
                col = client.get_collection("municipios")
                if col.count() >= len(self.risk_data) * 0.95:
                    self._chroma_col = col
                    logger.info(f"ChromaDB: loaded existing collection ({col.count()} docs)")
                    return False
            except Exception:
                pass

            logger.info("ChromaDB: building embeddings (first run may take a few minutes)...")
            model = SentenceTransformer(EMBED_MODEL)

            # Build document per municipality
            ids, docs, metas = [], [], []
            for r in self.risk_data:
                cd = str(r.get("cd_mun", ""))
                name = r.get("name", "")
                uf = r.get("uf", "")
                cat = r.get("riskCategory", "")
                trend = r.get("trend", "")
                threat = r.get("principalThreat", "")
                score = r.get("riskScore", 0)
                pop = r.get("population", 0)
                historic = r.get("historicCount", 0)

                doc = (
                    f"Município {name} em {uf}. "
                    f"Risco {cat} (score {score:.3f}). "
                    f"Tendência {trend}. "
                    f"Ameaça principal: {threat}. "
                    f"População: {pop:,}. "
                    f"Histórico: {historic} desastres."
                )
                ids.append(cd)
                docs.append(doc)
                metas.append({"cd_mun": cd, "name": name, "uf": uf,
                               "riskCategory": cat, "trend": trend, "principalThreat": threat})

            # Embed in batches of 512
            batch_size = 512
            embeddings: list[list[float]] = []
            for i in range(0, len(docs), batch_size):
                batch: list[str] = list(islice(docs, i, i + batch_size))
                vecs = model.encode(batch, show_progress_bar=False)
                embeddings.extend(vecs.tolist())

            # (Re)create collection
            try:
                client.delete_collection("municipios")
            except Exception:
                pass
            col = client.create_collection("municipios")
            col.add(ids=ids, documents=docs, embeddings=embeddings, metadatas=metas)

            self._chroma_col = col
            logger.info(f"ChromaDB: built collection with {len(ids)} documents")
            return True

        except Exception as e:
            logger.warning(f"ChromaDB setup failed (semantic search disabled): {e}")
            self._chroma_col = None
            return False

    def semantic_search(self, query: str, top_k: int = 20) -> list[dict]:
        """
        Semantic similarity search via ChromaDB embeddings.
        Complements (does not replace) rule-based SQL search.
        Returns list of municipality dicts sorted by similarity.
        """
        if not hasattr(self, "_chroma_col") or self._chroma_col is None:
            return []

        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(EMBED_MODEL)
            vec = model.encode([query])[0].tolist()
            results = self._chroma_col.query(query_embeddings=[vec], n_results=min(top_k, self._chroma_col.count()))
            ids = results["ids"][0] if results["ids"] else []
            # Return risk records matching the found ids
            id_set = set(ids)
            return [r for r in self.risk_data if str(r.get("cd_mun", "")) in id_set]
        except Exception as e:
            logger.warning(f"Semantic search failed: {e}")
            return []

    def hybrid_query(self, user_question: str, top_k: int = 20) -> list[dict]:
        """
        Combine rule-based SQL results with semantic search results.
        Re-ranks by riskScore to produce a unified list.
        """
        parsed = self.parse_query(user_question)
        sql_df = self.execute_query(parsed)
        sql_records = sql_df.to_dict("records") if not sql_df.empty else []

        semantic_records = self.semantic_search(user_question, top_k=top_k)

        # Merge by cd_mun, preferring SQL result order; append semantic-only results
        seen: set[str] = set()
        merged = []
        for r in sql_records:
            cd = str(r.get("cd_mun", ""))
            if cd not in seen:
                seen.add(cd)
                merged.append(r)
        for r in semantic_records:
            cd = str(r.get("cd_mun", ""))
            if cd not in seen:
                seen.add(cd)
                merged.append(r)

        return merged[:parsed["limite"]]

    # ── C2: Kepler.gl Visualization Config ────────────────────────────────────

    def prepare_kepler_config(self, results: list[dict]) -> dict:
        """
        Generate a Kepler.gl-compatible configuration for a set of municipality results.

        Returns:
            {
                dataset: { fields, rows },
                config: Kepler.gl config object (dark map, Brazil centered),
            }
        """
        fields = [
            {"name": "cd_mun",           "type": "string"},
            {"name": "name",             "type": "string"},
            {"name": "uf",               "type": "string"},
            {"name": "lat",              "type": "real"},
            {"name": "lng",              "type": "real"},
            {"name": "riskScore",        "type": "real"},
            {"name": "riskCategory",     "type": "string"},
            {"name": "trend",            "type": "string"},
            {"name": "principalThreat",  "type": "string"},
            {"name": "population",       "type": "integer"},
            {"name": "historicCount",    "type": "integer"},
        ]

        rows = []
        for r in results:
            rows.append([
                r.get("cd_mun", ""),
                r.get("name", ""),
                r.get("uf", ""),
                r.get("lat") or 0,
                r.get("lng") or 0,
                round(float(r.get("riskScore", 0)), 4),
                r.get("riskCategory", ""),
                r.get("trend", ""),
                r.get("principalThreat", ""),
                int(r.get("population", 0)),
                int(r.get("historicCount", 0)),
            ])

        kepler_config = {
            "version": "v1",
            "config": {
                "visState": {
                    "layers": [{
                        "type": "point",
                        "config": {
                            "dataId": "s2id_results",
                            "label": "Municípios",
                            "columns": {"lat": "lat", "lng": "lng"},
                            "visConfig": {
                                "radius": 6,
                                "colorRange": {
                                    "colors": ["#2c7bb6", "#abd9e9", "#ffffbf", "#fdae61", "#d7191c"]
                                },
                                "colorField": {"name": "riskScore", "type": "real"},
                            },
                        },
                    }],
                    "interactionConfig": {
                        "tooltip": {
                            "fieldsToShow": {
                                "s2id_results": [
                                    {"name": "name"}, {"name": "uf"}, {"name": "riskCategory"},
                                    {"name": "trend"}, {"name": "principalThreat"},
                                ]
                            },
                            "enabled": True,
                        }
                    },
                },
                "mapState": {"latitude": -15.78, "longitude": -47.93, "zoom": 4},
                "mapStyle": {"styleType": "dark"},
            },
        }

        return {
            "dataset": {"fields": fields, "rows": rows},
            "config": kepler_config,
        }

    # ── C3: Data Export ───────────────────────────────────────────────────────

    def export_results_csv(self, results: list[dict]) -> str:
        """Return CSV string for the given result municipalities."""
        columns = ["name", "uf", "riskScore", "riskCategory", "trend",
                   "principalThreat", "population", "historicCount",
                   "last10yrCount", "last5yrCount", "last2yrCount"]

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore",
                                lineterminator="\n")
        writer.writeheader()
        for r in results:
            row = {k: r.get(k, "") for k in columns}
            row["riskScore"] = round(float(row.get("riskScore") or 0), 4)
            writer.writerow(row)
        return output.getvalue()

    def export_results_geojson(self, results: list[dict]) -> dict:
        """Return GeoJSON FeatureCollection for the given result municipalities."""
        features = []
        for r in results:
            lat = r.get("lat")
            lng = r.get("lng")
            if lat is None or lng is None:
                continue
            props = {k: r.get(k) for k in
                     ["cd_mun", "name", "uf", "riskScore", "riskCategory",
                      "trend", "principalThreat", "population", "historicCount"]}
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": props,
            })
        return {"type": "FeatureCollection", "features": features}

    # ── Query pipeline ────────────────────────────────────────────────────────

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
