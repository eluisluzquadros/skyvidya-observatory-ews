"""
S2ID Analytics — LLM Content Framework
Port of Notebook 04: 04_analise_mdr_s2id_llm_content_v2.ipynb

Generates professional analytical narratives (executive summaries, risk narratives,
recommendations, and impact projections) for municipalities, states, or Brazil
as a whole, using KPIs extracted from the MCDA analytics pipeline and Gemini AI.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# ── Environment ───────────────────────────────────────────────────────────────

def _load_api_key() -> str:
    """
    Load Gemini API key from environment.
    Searches: environment variables → .env.local → .env
    """
    # Try env var directly first (set in shell or Docker)
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("API_KEY")
    if key:
        return key

    # Walk up from this file to find .env.local / .env
    search = Path(__file__).resolve().parent
    for _ in range(4):
        for fname in (".env.local", ".env"):
            candidate = search / fname
            if candidate.exists():
                load_dotenv(candidate, override=False)
                key = os.environ.get("GEMINI_API_KEY") or os.environ.get("API_KEY")
                if key:
                    return key
        search = search.parent

    raise EnvironmentError(
        "Gemini API key not found. Set GEMINI_API_KEY in environment or .env.local file."
    )


# ── KPI Extraction ────────────────────────────────────────────────────────────

def extract_kpis(risk_data: list[dict], cd_mun: str | None = None, uf: str | None = None) -> dict:
    """
    Extract KPIs from the risk_analysis JSON for a given scope.

    Args:
        risk_data: List of municipality risk records from risk_analysis.json
        cd_mun: Filter to single municipality (7-digit IBGE code)
        uf: Filter to state (e.g. 'RS')
        If both None → national KPIs

    Returns:
        Dict with extracted KPIs ready for LLM prompts.
    """
    if cd_mun:
        subset = [r for r in risk_data if str(r.get("cd_mun", "")) == str(cd_mun)]
        scope_label = subset[0]["name"] + " / " + subset[0]["uf"] if subset else cd_mun
        scope_type = "municipality"
    elif uf:
        subset = [r for r in risk_data if r.get("uf") == uf]
        scope_label = uf
        scope_type = "state"
    else:
        subset = risk_data
        scope_label = "Brasil"
        scope_type = "national"

    if not subset:
        return {"scope": scope_label, "scope_type": scope_type, "total": 0}

    total = len(subset)

    # Risk distribution
    risk_counts: dict[str, int] = {}
    for r in subset:
        cat = r.get("riskCategory", "Desconhecido")
        risk_counts[cat] = risk_counts.get(cat, 0) + 1

    high_risk = risk_counts.get("Alto", 0) + risk_counts.get("Muito Alto", 0)
    high_risk_pct = round(high_risk / total * 100, 1) if total else 0

    # Trend distribution
    trend_counts: dict[str, int] = {}
    for r in subset:
        t = r.get("trend", "Estável")
        trend_counts[t] = trend_counts.get(t, 0) + 1

    dominant_trend = max(trend_counts, key=lambda k: trend_counts[k]) if trend_counts else "Estável"
    crescente_pct = round(trend_counts.get("Crescente", 0) / total * 100, 1) if total else 0

    # Principal threats
    threat_counts: dict[str, int] = {}
    for r in subset:
        th = r.get("principalThreat", "")
        if th and th != "Nenhuma Ameaça Dominante":
            threat_counts[th] = threat_counts.get(th, 0) + 1

    top_threats = sorted(threat_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    # Historic event totals
    total_historic = sum(r.get("historicCount", 0) for r in subset)
    total_last10 = sum(r.get("last10yrCount", 0) for r in subset)
    total_last5 = sum(r.get("last5yrCount", 0) for r in subset)
    total_last2 = sum(r.get("last2yrCount", 0) for r in subset)

    # Population
    total_pop = sum(r.get("population", 0) for r in subset)

    # Top high-risk municipalities (for state/national scope)
    top_high_risk = []
    if scope_type != "municipality":
        sorted_by_risk = sorted(subset, key=lambda r: r.get("riskScore", 0), reverse=True)
        top_high_risk = [
            {"name": r["name"], "uf": r.get("uf", ""), "riskCategory": r.get("riskCategory", ""), "riskScore": round(r.get("riskScore", 0), 3)}
            for r in sorted_by_risk[:10]
        ]

    return {
        "scope": scope_label,
        "scope_type": scope_type,
        "total_municipalities": total,
        "total_population": total_pop,
        "risk_distribution": risk_counts,
        "high_risk_count": high_risk,
        "high_risk_pct": high_risk_pct,
        "trend_distribution": trend_counts,
        "dominant_trend": dominant_trend,
        "crescente_pct": crescente_pct,
        "top_threats": [{"name": n, "count": c} for n, c in top_threats],
        "principal_threat": top_threats[0][0] if top_threats else "N/A",
        "historic_events": total_historic,
        "last10yr_events": total_last10,
        "last5yr_events": total_last5,
        "last2yr_events": total_last2,
        "top_high_risk_municipalities": top_high_risk,
    }


# ── LLM Content Generator ─────────────────────────────────────────────────────

class LLMContentGenerator:
    """
    Generates analytical narratives using Gemini AI based on MCDA risk KPIs.
    Adapts the SKYVIDYA INSIGHTS framework from Notebook 04.
    """

    MODEL = "gemini-2.5-flash"

    def __init__(self, api_key: str | None = None):
        from google.genai import Client
        key = api_key or _load_api_key()
        self._client = Client(api_key=key)

    def _generate(self, prompt: str) -> str:
        response = self._client.models.generate_content(
            model=self.MODEL,
            contents=prompt,
        )
        return response.text.strip()

    # ── Individual narrative components ──────────────────────────────────────

    def generate_executive_summary(self, kpis: dict) -> str:
        scope = kpis["scope"]
        scope_type = kpis.get("scope_type", "national")
        total = kpis.get("total_municipalities", 1)
        high_pct = kpis.get("high_risk_pct", 0)
        trend = kpis.get("dominant_trend", "Estável")
        threat = kpis.get("principal_threat", "N/A")
        historic = kpis.get("historic_events", 0)
        last10 = kpis.get("last10yr_events", 0)

        scope_ctx = {
            "municipality": f"para o município de {scope}",
            "state": f"para o estado de {scope}",
            "national": "para o Brasil",
        }.get(scope_type, f"para {scope}")

        prompt = f"""Você é um analista sênior de gestão de riscos de desastres naturais do Brasil.
Escreva um sumário executivo conciso (2-3 parágrafos) em português {scope_ctx}, baseado nos seguintes dados:

- Total de municípios analisados: {total}
- Municípios em risco Alto ou Muito Alto: {high_pct}%
- Tendência dominante de eventos: {trend}
- Principal ameaça: {threat}
- Total histórico de registros de desastres: {historic:,}
- Registros nos últimos 10 anos: {last10:,}

Use linguagem técnica, objetiva e profissional. Não use bullet points. Inclua contexto de relevância para tomadores de decisão e gestores de defesa civil."""

        return self._generate(prompt)

    def generate_risk_narrative(self, kpis: dict) -> str:
        scope = kpis["scope"]
        risk_dist = kpis.get("risk_distribution", {})
        top_threats = kpis.get("top_threats", [])
        last5 = kpis.get("last5yr_events", 0)
        last2 = kpis.get("last2yr_events", 0)
        historic = kpis.get("historic_events", 0)

        threat_lines = "\n".join(
            f"  {i+1}. {t['name']}: {t['count']} municípios"
            for i, t in enumerate(top_threats)
        ) if top_threats else "  Dados insuficientes"

        risk_lines = "\n".join(
            f"  {cat}: {cnt} municípios"
            for cat, cnt in risk_dist.items()
        ) if risk_dist else "  Dados insuficientes"

        prompt = f"""Como especialista em análise de risco multicriterial (MCDA) de desastres no Brasil,
elabore uma narrativa analítica (3-4 parágrafos) sobre os fatores que impulsionam o risco em {scope}:

Distribuição de risco MCDA:
{risk_lines}

Principais ameaças (por número de municípios afetados):
{threat_lines}

Evolução temporal:
- Histórico total: {historic:,} eventos
- Últimos 5 anos: {last5:,} eventos
- Últimos 2 anos: {last2:,} eventos

Explique: (1) quais ameaças dominam e por quê, (2) como a tendência temporal indica evolução do risco,
(3) implicações para o planejamento de resposta. Use linguagem técnica e objetiva em português."""

        return self._generate(prompt)

    def generate_recommendations(self, kpis: dict) -> list[str]:
        scope = kpis["scope"]
        threat = kpis.get("principal_threat", "N/A")
        trend = kpis.get("dominant_trend", "Estável")
        high_pct = kpis.get("high_risk_pct", 0)
        top_threats = [t["name"] for t in kpis.get("top_threats", [])[:3]]

        prompt = f"""Como consultor de defesa civil e gestão de riscos de desastres para {scope}:

Contexto:
- Principal ameaça: {threat}
- Tendência de eventos: {trend}
- Municípios em alto risco: {high_pct}%
- Top 3 ameaças: {', '.join(top_threats) if top_threats else 'N/A'}

Forneça exatamente 5 recomendações operacionais e estratégicas numeradas, específicas e acionáveis
para redução de risco. Formato: apenas as 5 recomendações numeradas, sem introdução ou conclusão.
Em português, linguagem técnica e direta."""

        text = self._generate(prompt)
        # Parse numbered list
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        recs = [l for l in lines if l and (l[0].isdigit() or l.startswith("-"))]
        if not recs:
            recs = lines[:5]
        return recs[:5]

    def generate_impact_projection(self, kpis: dict) -> str:
        scope = kpis["scope"]
        trend = kpis.get("dominant_trend", "Estável")
        crescente_pct = kpis.get("crescente_pct", 0)
        historic = kpis.get("historic_events", 0)
        last10 = kpis.get("last10yr_events", 0)
        last5 = kpis.get("last5yr_events", 0)
        threat = kpis.get("principal_threat", "N/A")

        growth_rate = 0.0
        if historic > 0 and last10 > 0:
            growth_rate = round((last10 / (historic - last10 + 0.01)) * 100, 1) if historic > last10 else 0

        prompt = f"""Como analista de riscos climáticos para {scope}, projete cenários futuros baseado nos dados:

- Tendência atual: {trend} ({crescente_pct}% dos municípios com tendência crescente)
- Histórico total: {historic:,} eventos
- Últimos 10 anos: {last10:,} eventos ({growth_rate:.1f}% do total histórico)
- Últimos 5 anos: {last5:,} eventos
- Principal ameaça projetada: {threat}

Escreva 2 parágrafos: (1) projeção realista para os próximos 5 anos se a tendência continuar,
(2) projeção otimista com implementação das medidas recomendadas.
Linguagem técnica e objetiva em português."""

        return self._generate(prompt)

    # ── Full report ───────────────────────────────────────────────────────────

    def generate_full_report(
        self,
        risk_data: list[dict],
        cd_mun: str | None = None,
        uf: str | None = None,
    ) -> dict:
        """
        Generate a complete analytical report for a given scope.

        Returns:
            Dict with keys: summary, riskNarrative, recommendations,
                           impactProjection, kpis, generatedAt, scope, scopeType
        """
        kpis = extract_kpis(risk_data, cd_mun=cd_mun, uf=uf)
        if kpis.get("total_municipalities", 0) == 0:
            raise ValueError(f"No data found for scope: cd_mun={cd_mun}, uf={uf}")

        logger.info(f"Generating report for {kpis['scope']} ({kpis['scope_type']})...")

        summary = self.generate_executive_summary(kpis)
        risk_narrative = self.generate_risk_narrative(kpis)
        recommendations = self.generate_recommendations(kpis)
        impact_projection = self.generate_impact_projection(kpis)

        return {
            "scope": kpis["scope"],
            "scopeType": kpis["scope_type"],
            "generatedAt": datetime.now().isoformat(),
            "kpis": kpis,
            "summary": summary,
            "riskNarrative": risk_narrative,
            "recommendations": recommendations,
            "impactProjection": impact_projection,
        }

    def batch_generate_state_reports(
        self,
        risk_data: list[dict],
        ufs: list[str],
        output_dir: Path,
    ) -> dict[str, Path]:
        """Generate and save reports for each UF in the list."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        saved: dict[str, Path] = {}

        for uf in ufs:
            try:
                report = self.generate_full_report(risk_data, uf=uf)
                out = output_dir / f"{uf}_report.json"
                out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
                saved[uf] = out
                logger.info(f"  Saved report: {out.name}")
            except Exception as e:
                logger.warning(f"  Failed to generate report for {uf}: {e}")

        return saved


# ── Utility: load saved report ────────────────────────────────────────────────

def load_saved_report(output_dir: Path, scope: str) -> dict | None:
    """Load a previously generated report from disk."""
    path = Path(output_dir) / f"{scope}_report.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
