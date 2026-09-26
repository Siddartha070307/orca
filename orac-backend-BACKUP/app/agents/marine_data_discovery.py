"""Marine Data Discovery Agent.

Identifies, queries, and aggregates disparate oceanographic and meteorological feeds
including Open-Meteo live endpoints and INCOIS PFZ bulletins, attaching provenance metadata.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from app.integrations.weather_client import weather_client
from app.integrations.incois_mock import incois_provider


class MarineDataDiscoveryAgent:
    """Agent discovering, fetching, and harmonizing real-time marine datasets."""

    name = "MarineDataDiscoveryAgent"

    async def execute(
        self,
        location: Optional[Dict[str, float]] = None,
        sector_name: Optional[str] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        if not location or not isinstance(location, dict) or "lat" not in location or "lon" not in location:
            return AgentResult(
                agent=self.name,
                status="partial",
                location=None,
                time_range={"start": now_iso, "end": now_iso},
                result={
                    "weather_data": {},
                    "pfz_bulletins": [],
                    "discovered_sources": [],
                    "error": "Missing or invalid location coordinates for marine discovery"
                },
                confidence=0.0,
                sources=[{"name": "Marine Discovery Registry", "timestamp": now_iso}],
                warnings=["Location coordinates not specified for marine discovery."]
            )

        try:
            lat = float(location["lat"])
            lon = float(location["lon"])
        except (ValueError, TypeError):
            return AgentResult(
                agent=self.name,
                status="error",
                location=None,
                time_range={"start": now_iso, "end": now_iso},
                result={"weather_data": {}, "pfz_bulletins": [], "error": "Non-numeric coordinates"},
                confidence=0.0,
                sources=[{"name": "Marine Discovery Registry", "timestamp": now_iso}],
                warnings=["Non-numeric coordinates provided to marine discovery."]
            )

        try:
            # 1. Fetch live Open-Meteo atmospheric & wave data
            weather_raw = await weather_client.get_marine_weather(lat, lon)

            # 2. Fetch INCOIS PFZ bulletins
            pfz_raw = incois_provider.get_pfz_advisories(lat, lon, sector_name=sector_name)

            sources = [
                {
                    "name": "Open-Meteo Live Marine API" if not weather_raw.get("is_fallback") else "Open-Meteo (Fallback Cache)",
                    "timestamp": weather_raw.get("timestamp", now_iso),
                    "is_simulated": weather_raw.get("is_fallback", False)
                },
                {
                    "name": "INCOIS Potential Fishing Zone Mission (Simulated)",
                    "timestamp": now_iso,
                    "is_simulated": True
                }
            ]

            payload = {
                "weather_data": weather_raw,
                "pfz_bulletins": pfz_raw,
                "discovered_sources": ["Open-Meteo", "INCOIS-PFZ"],
                "query_location": {"lat": lat, "lon": lon}
            }

            return AgentResult(
                agent=self.name,
                status="success",
                location={"lat": lat, "lon": lon},
                time_range={"start": now_iso, "end": now_iso},
                result=payload,
                confidence=0.96,
                sources=sources,
                warnings=[]
            )
        except Exception as e:
            return AgentResult(
                agent=self.name,
                status="error",
                location={"lat": lat, "lon": lon},
                time_range={"start": now_iso, "end": now_iso},
                result={"weather_data": {}, "pfz_bulletins": [], "error": str(e)},
                confidence=0.0,
                sources=[{"name": "Marine Discovery Registry", "timestamp": now_iso}],
                warnings=[f"Data discovery failed: {str(e)}"]
            )


marine_data_discovery_agent = MarineDataDiscoveryAgent()
