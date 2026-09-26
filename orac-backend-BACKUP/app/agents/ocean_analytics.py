"""Ocean Analytics Agent.

Evaluates Sea Surface Temperature (SST) suitability, Chlorophyll-a concentrations,
horizontal thermal gradients (when spatial data permits), and INCOIS Potential Fishing Zone (PFZ) advisories.

SAFETY PRINCIPLE:
PFZ suitability is strictly subordinate to weather and geospatial safety constraints.
A favorable PFZ must NEVER override UNSAFE or CAUTION conditions.
"""
from typing import Dict, Any, List, Optional, Tuple
import math
from datetime import datetime, timezone
from app.models.schemas import AgentResult
from app.core.safety_rules import MarineSafetyThresholds


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance in km between two lat/lon points."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2.0) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def _calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Computes navigational forward azimuth bearing in degrees (0-360)."""
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    y = math.sin(dlon) * math.cos(lat2_r)
    x = math.cos(lat1_r) * math.sin(lat2_r) - math.sin(lat1_r) * math.cos(lat2_r) * math.cos(dlon)
    bearing = math.degrees(math.atan2(y, x))
    return int((bearing + 360) % 360)


class OceanAnalyticsAgent:
    """Agent performing deterministic bio-thermal PFZ analytics and candidate ranking."""

    name = "OceanAnalyticsAgent"

    async def execute(
        self,
        pfz_bulletins: Optional[List[Dict[str, Any]]] = None,
        location: Optional[Dict[str, float]] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        bulletins = pfz_bulletins if isinstance(pfz_bulletins, list) else []
        coords = location or ({"lat": bulletins[0]["lat"], "lon": bulletins[0]["lon"]} if bulletins and "lat" in bulletins[0] else None)

        if not bulletins:
            return AgentResult(
                agent=self.name,
                status="partial",
                location=coords,
                time_range={"start": now_iso, "end": now_iso},
                result={
                    "verdict": "SUBOPTIMAL",
                    "status": "NO_PFZ_AVAILABLE",
                    "candidates": [],
                    "total_candidates": 0,
                    "safety_subordinate": True,
                    "advisory_note": "No active PFZ advisory mapped within the operational quadrant."
                },
                confidence=0.6,
                sources=[{"name": "INCOIS PFZ Advisory (Simulated)", "timestamp": now_iso, "is_simulated": True}],
                warnings=["No active PFZ advisory mapped within the operational quadrant."]
            )

        analyzed_candidates = []
        for i, c in enumerate(bulletins):
            candidate_copy = dict(c)

            # Preserve static bulletin port reference and calculate user-relative distance/bearing
            if coords and "lat" in coords and "lon" in coords and c.get("lat") is not None and c.get("lon") is not None:
                user_dist = round(_haversine_km(coords["lat"], coords["lon"], float(c["lat"]), float(c["lon"])), 1)
                user_bearing = _calculate_bearing(coords["lat"], coords["lon"], float(c["lat"]), float(c["lon"]))
                if "source_distance_km" not in candidate_copy and "distance_km" in c:
                    candidate_copy["source_distance_km"] = c.get("distance_km")
                if "source_bearing_deg" not in candidate_copy and "bearing_deg" in c:
                    candidate_copy["source_bearing_deg"] = c.get("bearing_deg")
                candidate_copy["distance_user_km"] = user_dist
                candidate_copy["bearing_user_deg"] = user_bearing
                candidate_copy["calculated_distance_km"] = user_dist
                candidate_copy["calculated_bearing_deg"] = user_bearing
                candidate_copy["distance_km"] = user_dist
                candidate_copy["bearing_deg"] = user_bearing

            sst = c.get("sst_c")
            chl = c.get("chlorophyll_mg_m3")

            # 1. Deterministic SST suitability evaluation
            if sst is not None:
                sst_val = float(sst)
                if sst_val < MarineSafetyThresholds.PFZ_SST_MIN:
                    sst_status = "SUBOPTIMAL_LOW"
                    sst_optimal = False
                elif sst_val > MarineSafetyThresholds.PFZ_SST_MAX:
                    sst_status = "SUBOPTIMAL_HIGH"
                    sst_optimal = False
                else:
                    sst_status = "OPTIMAL"
                    sst_optimal = True
            else:
                sst_val = None
                sst_status = "UNAVAILABLE"
                sst_optimal = False

            # 2. Deterministic Chlorophyll-a suitability evaluation
            if chl is not None:
                chl_val = float(chl)
                if chl_val < MarineSafetyThresholds.PFZ_CHL_MIN:
                    chl_status = "SUBOPTIMAL_LOW"
                    chl_optimal = False
                elif chl_val > MarineSafetyThresholds.PFZ_CHL_MAX:
                    chl_status = "SUBOPTIMAL_HIGH"
                    chl_optimal = False
                else:
                    chl_status = "OPTIMAL"
                    chl_optimal = True
            else:
                chl_val = None
                chl_status = "UNAVAILABLE"
                chl_optimal = False

            # 3. Horizontal SST Spatial Gradient & Thermal Front Calculation
            # Only compute horizontal gradients when explicit spatial neighbor/grid observations exist.
            # Sibling candidate differences across unrelated bulletin points are excluded.
            # NOTE: 0.05 °C/km is an ORCA demo/heuristic threshold, NOT an authoritative INCOIS standard.
            spatial_neighbors = c.get("spatial_neighbors", [])
            grad_c_per_km = None
            front_detected = False
            front_avail = False
            front_note = ""

            c_lat = c.get("lat")
            c_lon = c.get("lon")

            if spatial_neighbors and sst_val is not None and c_lat is not None and c_lon is not None:
                # Compute gradient against verified spatial neighbor grid points
                gradients = []
                for n in spatial_neighbors:
                    n_lat = n.get("lat")
                    n_lon = n.get("lon")
                    n_sst = n.get("sst_c")
                    if n_lat is not None and n_lon is not None and n_sst is not None:
                        d_km = _haversine_km(c_lat, c_lon, float(n_lat), float(n_lon))
                        if d_km > 0.1:
                            g = abs(sst_val - float(n_sst)) / d_km
                            gradients.append(g)
                if gradients:
                    grad_c_per_km = round(max(gradients), 4)
                    front_avail = True
                    # Heuristic threshold: >= 0.05 °C/km indicates a prospective oceanic thermal front
                    front_detected = grad_c_per_km >= 0.05
                    front_note = f"Thermal gradient calculated at {grad_c_per_km:.4f} °C/km from spatial grid points (heuristic threshold: 0.05 °C/km)."
                else:
                    front_avail = False
                    front_note = "Spatial neighbor observations were invalid or collinear; gradient calculation unavailable."
            else:
                front_avail = False
                front_note = "Insufficient spatial grid data; horizontal SST gradient calculation unavailable without local grid observations."

            # 4. Deterministic Composite Suitability Score
            score = 0.50
            if sst_optimal:
                score += 0.25
            elif sst_status != "UNAVAILABLE":
                score -= 0.20

            if chl_optimal:
                score += 0.25
            elif chl_status != "UNAVAILABLE":
                score -= 0.15

            if front_avail and front_detected:
                score += 0.10

            final_suitability = round(max(0.10, min(1.0, score)), 2)

            candidate_copy["evaluated_suitability"] = final_suitability
            candidate_copy["sst_analysis"] = {
                "value_c": sst_val,
                "status": sst_status,
                "optimal_range": [MarineSafetyThresholds.PFZ_SST_MIN, MarineSafetyThresholds.PFZ_SST_MAX],
                "is_optimal": sst_optimal
            }
            candidate_copy["chlorophyll_analysis"] = {
                "value_mg_m3": chl_val,
                "status": chl_status,
                "optimal_range": [MarineSafetyThresholds.PFZ_CHL_MIN, MarineSafetyThresholds.PFZ_CHL_MAX],
                "is_optimal": chl_optimal
            }
            candidate_copy["thermal_front"] = {
                "calculation_available": front_avail,
                "gradient_c_per_km": grad_c_per_km,
                "front_detected": front_detected,
                "analysis_note": front_note
            }
            analyzed_candidates.append(candidate_copy)

        # 5. Deterministic Ranking
        analyzed_candidates.sort(key=lambda x: x["evaluated_suitability"], reverse=True)
        recommended = analyzed_candidates[0]

        verdict = "FAVORABLE" if recommended["evaluated_suitability"] >= 0.70 else "SUBOPTIMAL"

        payload = {
            "verdict": verdict,
            "recommended_pfz": recommended,
            "candidates": analyzed_candidates,
            "total_candidates": len(analyzed_candidates),
            "safety_subordinate": True,
            "advisory_note": (
                "PFZ suitability indicates fish aggregation potential only. "
                "Navigation safety is strictly subordinate to Weather and Geospatial hard constraints."
            ),
            "is_simulated": True,
            "data_source": "INCOIS PFZ Mission Bulletin (Simulated/Mock)",
            "ocean_features": recommended.get("feature", "Oceanic Water Mass"),
            "target_species": recommended.get("target_species", [])
        }

        return AgentResult(
            agent=self.name,
            status="success",
            location=coords,
            time_range={"start": now_iso, "end": recommended.get("valid_until", now_iso)},
            result=payload,
            confidence=0.92,
            sources=[{"name": "INCOIS PFZ Mission Bulletin (Simulated)", "timestamp": recommended.get("generated_at", now_iso), "is_simulated": True}],
            warnings=[]
        )


ocean_analytics_agent = OceanAnalyticsAgent()
