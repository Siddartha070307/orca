"""Anthropic Claude API client integration with resilient offline fallback."""
import logging
import json
import re
import difflib
import urllib.request
import urllib.parse
from typing import Dict, Any, Optional
import anthropic
from app.core.config import settings
from app.core.temporal import parse_temporal_expression

logger = logging.getLogger(__name__)


def _dynamic_geocode(location_name: str) -> Optional[Dict[str, float]]:
    """Dynamically geocodes a location name using Open-Meteo Geocoding API with fast timeout."""
    if not location_name or len(location_name.strip()) < 3:
        return None
    try:
        clean_name = re.sub(r'[^\w\s]', '', location_name).strip()
        encoded = urllib.parse.quote(clean_name)
        url = f"https://geocoding-api.open-meteo.com/v1/search?name={encoded}&count=1&language=en&format=json"
        req = urllib.request.Request(url, headers={"User-Agent": "ORCA-Marine/1.0"})
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results")
            if results and len(results) > 0:
                lat = float(results[0]["latitude"])
                lon = float(results[0]["longitude"])
                return {"lat": round(lat, 4), "lon": round(lon, 4)}
    except Exception as e:
        logger.debug(f"Dynamic geocoding for '{location_name}' failed: {e}")
    return None


def _get_coastal_sectors_registry() -> Dict[str, Dict[str, Any]]:
    """Builds comprehensive coastal registry dynamically from INCOISMockProvider.COASTAL_SECTORS."""
    registry = {}
    from app.integrations.incois_mock import INCOISMockProvider

    for s in INCOISMockProvider.COASTAL_SECTORS:
        sec_name = s["sector"]
        coords = {"lat": s["port_lat"], "lon": s["port_lon"]}
        registry[sec_name.lower()] = {
            "name": sec_name,
            "coords": coords
        }
        st_name = s["state"]
        if st_name.lower() not in registry:
            registry[st_name.lower()] = {
                "name": st_name,
                "coords": coords
            }

    aliases = {
        "vizag": "visakhapatnam",
        "vishakhapatnam": "visakhapatnam",
        "vishakapatnam": "visakhapatnam",
        "visakhapatanam": "visakhapatnam",
        "waltair": "visakhapatnam",
        "mangaluru": "mangalore",
        "mangalur": "mangalore",
        "cochin": "kochi",
        "kozhikode": "beypore",
        "calicut": "beypore",
        "neendakara": "kollam",
        "quilon": "kollam",
        "bombay": "mumbai",
        "madras": "chennai",
        "thoothukudi": "tuticorin",
        "tuticorin": "tuticorin",
        "trivandrum": "vizhinjam",
        "thiruvananthapuram": "vizhinjam",
        "panaji": "goa",
        "panjim": "goa",
        "mormugao": "goa",
        "vasco": "goa",
        "vasco da gama": "goa",
        "andhra": "andhra pradesh",
        "tamilnadu": "tamil nadu",
        "orissa": "odisha",
        "bengal": "west bengal",
        "andaman": "andaman & nicobar",
        "nicobar": "andaman & nicobar",
        "andaman and nicobar": "andaman & nicobar"
    }
    for alias, target in aliases.items():
        if target in registry and alias not in registry:
            registry[alias] = {
                "name": registry[target]["name"],
                "coords": registry[target]["coords"]
            }
    return registry


class ClaudeClient:
    """Client for Anthropic Claude models with graceful deterministic fallback."""

    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.client = anthropic.AsyncAnthropic(api_key=self.api_key) if self.api_key else None
        self.model = settings.CLAUDE_MODEL

    async def parse_intent_and_entities(self, query: str, default_location: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """Uses Claude to parse intent, target location, and timeframe from user query.
        Falls back to rule-based entity extraction if key is absent or call fails.
        """
        if self.client:
            prompt = f"""You are the Planning Agent for ORCA, an Indian marine intelligence system.
Analyze the user query: "{query}"

Extract the following in strictly valid JSON format:
{{
    "intent": "safety_check" | "pfz_discovery" | "weather_forecast" | "general_marine",
    "location_name": "<city or port name or null>",
    "coordinates": {{"lat": <float or null>, "lon": <float or null>}},
    "target_time": "now" | "today" | "tomorrow" | "tomorrow morning" | "tomorrow afternoon" | "tomorrow evening" | "next 24 hours" | "next 48 hours" | "<iso_date>",
    "vessel_type": "mechanized" | "motorized" | "traditional" | "unknown",
    "requested_agents": ["weather_intelligence", "ocean_analytics", "geospatial_reasoning", "risk_assessment"]
}}

Indian Coastal reference coordinates:
Mangalore: 12.87, 74.84
Malpe: 13.35, 74.70
Karwar: 14.82, 74.13
Kochi: 9.93, 76.26
Beypore: 11.16, 75.81
Kollam: 8.89, 76.55
Goa: 15.49, 73.82
Mumbai: 18.92, 72.83
Ratnagiri: 16.99, 73.30
Porbandar: 21.64, 69.62
Veraval: 20.90, 70.37
Chennai: 13.08, 80.27
Tuticorin: 8.76, 78.13
Kanyakumari: 8.08, 77.53
Visakhapatnam: 17.68, 83.21
Kakinada: 16.99, 82.24
Machilipatnam: 16.18, 81.14
Paradip: 20.31, 86.61
Puri: 19.81, 85.83
Gahirmatha: 20.59, 87.00
Digha: 21.62, 87.51
Port Blair: 11.62, 92.73
Kavaratti: 10.57, 72.64

Respond ONLY with valid JSON.
"""
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=600,
                    temperature=0.1,
                    messages=[{"role": "user", "content": prompt}]
                )
                raw_text = response.content[0].text.strip()
                # Clean up any potential markdown fences
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                parsed = json.loads(raw_text.strip())
                loc_name = parsed.get("location_name")
                coords = parsed.get("coordinates")
                has_loc = bool(loc_name and str(loc_name).strip().lower() not in ["null", "none", "unspecified", ""])
                has_coords = bool(coords and isinstance(coords, dict) and coords.get("lat") is not None)

                # If Claude identified a location name but didn't supply coordinates, resolve from registry
                if has_loc and not has_coords:
                    registry = _get_coastal_sectors_registry()
                    loc_clean = str(loc_name).strip().lower()
                    if loc_clean in registry:
                        match = registry[loc_clean]
                        parsed["location_name"] = match["name"]
                        parsed["coordinates"] = match["coords"]
                        has_coords = True
                    else:
                        close = difflib.get_close_matches(loc_clean, list(registry.keys()), n=1, cutoff=0.65)
                        if close:
                            match = registry[close[0]]
                            parsed["location_name"] = match["name"]
                            parsed["coordinates"] = match["coords"]
                            has_coords = True
                        else:
                            geo_coords = _dynamic_geocode(str(loc_name).strip())
                            if geo_coords:
                                parsed["coordinates"] = geo_coords
                                has_coords = True

                parsed["has_explicit_location"] = has_loc or has_coords

                # If coordinates null but default provided
                if not parsed.get("coordinates") or not parsed["coordinates"].get("lat"):
                    if default_location:
                        parsed["coordinates"] = default_location
                        parsed["has_explicit_location"] = True
                det_time = parse_temporal_expression(query)
                if det_time:
                    parsed["target_time"] = det_time
                return parsed
            except Exception as e:
                logger.warning(f"Claude intent parsing failed, falling back to rule-based parser: {e}")

        # Graceful rule-based extraction fallback
        return self._fallback_intent_parser(query, default_location)

    def _fallback_intent_parser(self, query: str, default_location: Optional[Dict[str, float]]) -> Dict[str, Any]:
        """Deterministic heuristic intent & entity parser leveraging COASTAL_SECTORS."""
        q = query.lower()
        registry = _get_coastal_sectors_registry()

        found_loc = None
        matched_coords = None
        has_explicit = False

        # 1. Sort keys by length descending so longer multi-word names match first
        sorted_keys = sorted(registry.keys(), key=len, reverse=True)
        for key in sorted_keys:
            if re.search(r'\b' + re.escape(key) + r'\b', q):
                info = registry[key]
                found_loc = info["name"]
                matched_coords = info["coords"]
                has_explicit = True
                break

        # 2. Preposition-based candidate extraction if not matched in registry directly
        if not has_explicit:
            candidate = None
            # Check for "from <candidate>" (strongest departure indicator)
            from_match = re.search(
                r'\bfrom\s+([A-Za-z\s]{2,35}?)(?:[?,.!;]|\s+(?:tomorrow|today|now|morning|evening|afternoon|tonight|next)|$)',
                query,
                re.IGNORECASE
            )
            if from_match:
                candidate = from_match.group(1).strip()
            else:
                # Spatial prepositions: off, near, around, at, in, to
                prep_match = re.search(
                    r'\b(?:near|around|off|at|in|to)\s+([A-Za-z\s]{2,35}?)(?:[?,.!;]|\s+(?:tomorrow|today|now|morning|evening|afternoon|tonight|next)|$)',
                    query,
                    re.IGNORECASE
                )
                if prep_match:
                    candidate = prep_match.group(1).strip()

            if candidate:
                candidate_clean = re.sub(r'^(?:the|port of)\s+', '', candidate, flags=re.IGNORECASE).strip()
                candidate_clean = re.sub(r'[?,.!;]+$', '', candidate_clean).strip()
                cand_lower = candidate_clean.lower()
                noise_words = {
                    "sea", "ocean", "water", "deep sea", "shore", "coast", "harbor", "port",
                    "fishing", "boat", "here", "there", "my location", "good fishing spots",
                    "safe", "caution", "the sea", "the ocean", "the shore", "go to fishing",
                    "go fishing"
                }
                if cand_lower not in noise_words and len(candidate_clean) > 2:
                    if cand_lower in registry:
                        info = registry[cand_lower]
                        found_loc = info["name"]
                        matched_coords = info["coords"]
                        has_explicit = True
                    else:
                        close_matches = difflib.get_close_matches(cand_lower, list(registry.keys()), n=1, cutoff=0.65)
                        if close_matches:
                            matched_key = close_matches[0]
                            info = registry[matched_key]
                            found_loc = info["name"]
                            matched_coords = info["coords"]
                            has_explicit = True
                        else:
                            coords = _dynamic_geocode(candidate_clean)
                            if coords:
                                found_loc = candidate_clean.title()
                                matched_coords = coords
                                has_explicit = True
                            else:
                                found_loc = candidate_clean.title()
                                matched_coords = None
                                has_explicit = True

        if not matched_coords and not found_loc:
            if default_location:
                matched_coords = default_location
                found_loc = "Specified Coordinates"
                has_explicit = True
            else:
                found_loc = None
                matched_coords = None
                has_explicit = False

        # Determine timeframe
        extracted_time = parse_temporal_expression(query)
        target_time = extracted_time if extracted_time else "today"

        # Determine intent
        intent = "safety_check"
        if any(w in q for w in ["fish", "pfz", "catch", "zone", "tuna", "sardine", "potential"]):
            intent = "pfz_discovery"
        elif any(w in q for w in ["wave", "wind", "weather", "rain", "storm", "forecast"]):
            intent = "weather_forecast"

        return {
            "intent": intent,
            "has_explicit_location": has_explicit,
            "location_name": found_loc,
            "coordinates": matched_coords,
            "has_explicit_time": bool(extracted_time),
            "target_time": target_time,
            "vessel_type": "mechanized",
            "requested_agents": [
                "marine_data_discovery",
                "weather_intelligence",
                "ocean_analytics",
                "geospatial_reasoning",
                "risk_assessment",
                "visualization",
                "reporting"
            ]
        }

    async def generate_marine_report(
        self,
        query: str,
        verdict: str,
        safety_reasons: list,
        weather_metrics: dict,
        pfz_recommendations: list,
        geospatial_info: dict,
        target_location: str,
        time_label: Optional[str] = None,
        time_range: Optional[dict] = None
    ) -> str:
        """Uses Claude to write an evidence-based natural language advisory."""
        if self.client:
            time_info = f"- Forecast period: {time_label}\n" if time_label else ""
            best_pfz = pfz_recommendations[0] if pfz_recommendations else {}
            best_id = best_pfz.get('id', 'None')
            best_dist = best_pfz.get('distance_user_km') or best_pfz.get('calculated_distance_km') or best_pfz.get('distance_km', 0)
            best_bearing = best_pfz.get('bearing_user_deg') or best_pfz.get('calculated_bearing_deg') or best_pfz.get('bearing_deg', 0)
            best_sst = best_pfz.get('sst_c', 0)
            prompt = f"""You are the Reporting Agent for ORCA, an Indian marine intelligence platform.
Write a clear, evidence-based, safety-checked marine advisory answering the user's query: "{query}"

MANDATORY RULES:
1. State the final safety verdict clearly at the very beginning: [{verdict}].
2. Cite the exact numerical data provided below (do NOT invent numbers):
   - Location: {target_location}
   {time_info}- Wind speed: {weather_metrics.get('wind_speed_kmh')} km/h
   - Wave height: {weather_metrics.get('wave_height_m')} m
   - Wind gusts: {weather_metrics.get('wind_gust_kmh') if weather_metrics.get('wind_gust_kmh') is not None else 'Unavailable'} km/h
   - Recommended PFZ: {best_id} ({best_dist} km away, bearing {best_bearing}°, SST: {best_sst}°C)
   - Safety drivers: {', '.join(safety_reasons)}
   - Restricted zone proximity: {geospatial_info.get('status_description', 'Clear')}
3. Provide actionable guidance for small and mechanized fishing craft.
4. Keep the tone authoritative, clear, and direct. Under 150 words.
"""
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=400,
                    temperature=0.2,
                    messages=[{"role": "user", "content": prompt}]
                )
                return response.content[0].text.strip()
            except Exception as e:
                logger.warning(f"Claude report generation failed, using fallback synthesizer: {e}")

        # Deterministic fallback synthesis
        return self._fallback_report_synthesizer(
            query=query,
            verdict=verdict,
            safety_reasons=safety_reasons,
            weather_metrics=weather_metrics,
            pfz_recommendations=pfz_recommendations,
            geospatial_info=geospatial_info,
            target_location=target_location,
            time_label=time_label,
            time_range=time_range
        )

    def _fallback_report_synthesizer(
        self,
        query: str,
        verdict: str,
        safety_reasons: list,
        weather_metrics: dict,
        pfz_recommendations: list,
        geospatial_info: dict,
        target_location: str,
        time_label: Optional[str] = None,
        time_range: Optional[dict] = None
    ) -> str:
        """Deterministic report synthesizer quoting exact evidence numbers."""
        wind = weather_metrics.get("wind_speed_kmh")
        wave = weather_metrics.get("wave_height_m")
        gust = weather_metrics.get("wind_gust_kmh")
        precip = weather_metrics.get("precipitation_mm", 0)
        reasons_text = " ".join(safety_reasons) if safety_reasons else "Normal baseline observations."

        time_line = f"**Forecast Period:** {time_label}\n\n" if time_label else ""

        # PFZ details
        pfz_status = "FAVORABLE" if pfz_recommendations else "SUBOPTIMAL"
        if pfz_recommendations:
            best = pfz_recommendations[0]
            pfz_dist = best.get("distance_user_km") or best.get("calculated_distance_km") or best.get("distance_km", "N/A")
            pfz_bearing = best.get("bearing_user_deg") or best.get("calculated_bearing_deg") or best.get("bearing_deg", 0)
            pfz_text = (
                f"Potential Fishing Zone (PFZ: {pfz_status}): {best.get('id', 'PFZ')} located {pfz_dist} km offshore "
                f"(bearing {pfz_bearing}°), Sea Surface Temp {best.get('sst_c')}°C with high chlorophyll-a. "
                f"Target catch: {', '.join(best.get('target_species', ['Pelagic species'])[:2])}."
            )
        else:
            pfz_text = "Potential Fishing Zone (PFZ: SUBOPTIMAL): No recommended PFZ within safe operational radius."

        # Geospatial details
        geo_dist = geospatial_info.get("nearest_boundary_distance_km")
        inside_geo = geospatial_info.get("inside_geofence", False)
        if inside_geo:
            geo_text = f"ALERT: Craft is INSIDE a restricted marine boundary ({geospatial_info.get('restricted_zone_name', 'Protected Zone')})."
        elif geo_dist is not None:
            geo_text = f"Geofence distance: {geo_dist:.1f} km to nearest restricted boundary. Status: {geospatial_info.get('status_description', 'Clear')}."
        else:
            geo_text = geospatial_info.get("status_description", "All navigation waypoints clear of restricted marine areas.")

        wind_str = f"{wind} km/h" if wind is not None else "unavailable"
        gust_str = f"gusts: {gust} km/h" if gust is not None else "gusts: unavailable"
        wave_str = f"{wave} m" if wave is not None else "unavailable"
        precip_str = f"{precip} mm" if precip is not None else "unavailable"
        metrics_text = f"Recorded wind: {wind_str} ({gust_str}), significant wave height: {wave_str}, precipitation: {precip_str}."

        if verdict == "UNSAFE":
            return (
                f"**SAFETY ADVISORY: UNSAFE TO SAIL - DO NOT VENTURE INTO SEA NEAR {target_location.upper()} [UNSAFE]**\n\n"
                f"{time_line}"
                f"Conditions are hazardous for marine operations. {reasons_text} "
                f"{metrics_text} "
                f"{geo_text} Coastal authorities advise all mechanized and traditional craft to remain moored."
            )
        elif verdict == "CAUTION":
            return (
                f"**SAFETY ADVISORY: PROCEED WITH CAUTION - EXERCISE VIGILANCE NEAR {target_location.upper()} [CAUTION]**\n\n"
                f"{time_line}"
                f"Marginal marine conditions detected. {reasons_text} "
                f"{metrics_text} "
                f"{pfz_text} "
                f"{geo_text} Only seaworthy mechanized vessels with full safety equipment (life jackets, VHF, NAVIC receivers) should operate."
            )
        else:
            return (
                f"**SAFETY ADVISORY: SAFE FOR OPERATIONS - FAVORABLE CONDITIONS NEAR {target_location.upper()} [SAFE]**\n\n"
                f"{time_line}"
                f"Sea conditions are safe for coastal and deep-sea fishing. "
                f"{metrics_text} "
                f"{pfz_text} "
                f"{geo_text} Weather forecast indicates stable conditions."
            )

    async def translate_text(self, text: str, source_lang: str, target_lang: str) -> Optional[str]:
        """Translates text between English and Indian regional languages using Claude.
        Preserves technical marine terms, abbreviations (PFZ, INCOIS, SST, NAVIC),
        numbers, and units. Returns None if client is unavailable or call fails.
        """
        if not text or not text.strip():
            return text
        if source_lang == target_lang:
            return text
        if not self.client:
            return None

        language_names = {
            "en": "English",
            "te": "Telugu",
            "hi": "Hindi",
            "kn": "Kannada",
            "ta": "Tamil",
            "ml": "Malayalam",
            "mr": "Marathi",
            "bn": "Bengali",
            "gu": "Gujarati",
            "or": "Odia",
            "pa": "Punjabi",
            "as": "Assamese"
        }

        src_name = language_names.get(source_lang, source_lang)
        tgt_name = language_names.get(target_lang, target_lang)

        prompt = f"""You are a professional maritime translator for Indian coastal fishing communities and marine authorities.
Translate the following text from {src_name} to {tgt_name}.

CRITICAL REQUIREMENTS:
1. Preserve all numerical values, units (km/h, m, °C, km, knots, mg/m³), and domain acronyms (PFZ, INCOIS, SST, EEZ, NAVIC, GPS, VHF) exactly or transliterate consistently.
2. Preserve verdict brackets like [SAFE], [CAUTION], [UNSAFE] clearly or translate accurately alongside standard English code words so safety meaning is uncompromised.
3. Return ONLY the translated text. Do NOT include greetings, intro, markdown fences, notes, or explanations.

Text to translate:
{text}"""

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=1000,
                temperature=0.0,
                messages=[{"role": "user", "content": prompt}]
            )
            translated = response.content[0].text.strip()
            # Strip any potential markdown code fences
            if translated.startswith("```") and translated.endswith("```"):
                translated = re.sub(r"^```[a-zA-Z]*\n?", "", translated)
                translated = re.sub(r"\n?```$", "", translated).strip()
            return translated if translated else None
        except Exception as e:
            logger.warning(f"Claude translation from {source_lang} to {target_lang} failed: {e}")
            return None


claude_client = ClaudeClient()
