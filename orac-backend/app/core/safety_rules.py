"""Deterministic safety rule hierarchy for marine intelligence.

Hierarchy precedence:
1. Hard Constraints (Severe storm, extreme wind/wave, military/marine sanctuary breach) -> UNSAFE
2. Weather Advisories (Moderate wind/wave, squall, heavy precipitation) -> CAUTION
3. Observations & Short-term Forecasts (Forecast worsening trends) -> CAUTION / SAFE
4. Ocean & PFZ Analytics (SST/Chlorophyll viability) -> Favorable / Neutral / Suboptimal

Rules are strictly deterministic; LLM is used exclusively for explanation synthesis,
NEVER to override these rule outcomes.
"""

from typing import Dict, Any, List, Tuple, Optional
from enum import Enum


class SafetyVerdict(str, Enum):
    SAFE = "SAFE"
    CAUTION = "CAUTION"
    UNSAFE = "UNSAFE"


class MarineSafetyThresholds:
    # Sustained Wind Speed (km/h) for small/medium craft (mechanized & motorized fishing boats)
    # SAFE: < 35.0 km/h | CAUTION: >= 35.0 and < 50.0 km/h | UNSAFE: >= 50.0 km/h
    WIND_SAFE_MAX = 35.0
    WIND_CAUTION_MAX = 50.0
    WIND_UNSAFE_MIN = 50.0

    # Significant Wave Height (meters)
    # SAFE: < 2.0 m | CAUTION: >= 2.0 and < 3.5 m | UNSAFE: >= 3.5 m
    WAVE_SAFE_MAX = 2.0
    WAVE_CAUTION_MAX = 3.5
    WAVE_UNSAFE_MIN = 3.5

    # Wind Gusts (km/h)
    # SAFE: < 55.0 km/h | CAUTION: >= 55.0 and < 70.0 km/h | UNSAFE: >= 70.0 km/h
    GUST_SAFE_MAX = 55.0
    GUST_CAUTION_MIN = 55.0
    GUST_UNSAFE_MIN = 70.0

    # WMO Severe Thunderstorm / Squall / Hail Codes
    STORM_WMO_CODES = [95, 96, 99]

    # Visibility (km)
    VISIBILITY_POOR_KM = 3.0

    # Geofence buffer to restricted zones (meters / km)
    RESTRICTED_ZONE_BUFFER_KM = 2.0

    # PFZ SST Optimal Range (Celsius)
    PFZ_SST_MIN = 26.5
    PFZ_SST_MAX = 30.5

    # PFZ Chlorophyll-a Optimal Range (mg/m^3)
    PFZ_CHL_MIN = 0.2
    PFZ_CHL_MAX = 3.0


def evaluate_weather_safety(
    wind_speed: Optional[float],
    wave_height: Optional[float],
    wind_gust: Optional[float] = None,
    has_storm_alert: bool = False,
    storm_description: str = "",
    weather_code: Optional[int] = None
) -> Tuple[SafetyVerdict, List[str], Dict[str, Any]]:
    """Evaluates raw weather parameters against deterministic safety thresholds.
    
    Returns:
        verdict: SAFE, CAUTION, or UNSAFE
        reasons: list of specific drivers
        metrics: extracted numeric metrics
    """
    reasons = []
    verdict = SafetyVerdict.SAFE

    is_storm = has_storm_alert or (weather_code is not None and weather_code in MarineSafetyThresholds.STORM_WMO_CODES)
    if is_storm and not storm_description:
        if weather_code in [95, 96, 99]:
            storm_description = f"WMO code {weather_code} (Thunderstorm/Squall)"
        else:
            storm_description = "Severe storm/cyclone advisory"

    metrics = {
        "wind_speed_kmh": round(wind_speed, 1) if wind_speed is not None else None,
        "wave_height_m": round(wave_height, 2) if wave_height is not None else None,
        "wind_gust_kmh": round(wind_gust, 1) if wind_gust is not None else None,
        "has_storm_alert": is_storm,
        "weather_code": weather_code
    }

    # 1. Hard Constraints (UNSAFE)
    if is_storm:
        verdict = SafetyVerdict.UNSAFE
        reasons.append(f"HARD CONSTRAINT: Active storm/cyclone advisory in sector ({storm_description}).")

    if wind_speed is not None and wind_speed >= MarineSafetyThresholds.WIND_UNSAFE_MIN:
        verdict = SafetyVerdict.UNSAFE
        reasons.append(
            f"HARD CONSTRAINT: Extreme wind speed ({wind_speed:.1f} km/h) meets or exceeds unsafe operating limit ({MarineSafetyThresholds.WIND_UNSAFE_MIN} km/h)."
        )

    if wave_height is not None and wave_height >= MarineSafetyThresholds.WAVE_UNSAFE_MIN:
        verdict = SafetyVerdict.UNSAFE
        reasons.append(
            f"HARD CONSTRAINT: Dangerous significant wave height ({wave_height:.2f} m) meets or exceeds threshold ({MarineSafetyThresholds.WAVE_UNSAFE_MIN} m)."
        )

    if wind_gust is not None and wind_gust >= MarineSafetyThresholds.GUST_UNSAFE_MIN:
        verdict = SafetyVerdict.UNSAFE
        reasons.append(
            f"HARD CONSTRAINT: Severe wind gusts ({wind_gust:.1f} km/h) meet or exceed safety limit ({MarineSafetyThresholds.GUST_UNSAFE_MIN} km/h)."
        )

    if verdict == SafetyVerdict.UNSAFE:
        return verdict, reasons, metrics

    # 2. Advisories / Caution checks
    if wind_speed is not None and wind_speed >= MarineSafetyThresholds.WIND_SAFE_MAX:
        verdict = SafetyVerdict.CAUTION
        reasons.append(
            f"ADVISORY: Elevated wind speed ({wind_speed:.1f} km/h) in caution band ({MarineSafetyThresholds.WIND_SAFE_MAX}-{MarineSafetyThresholds.WIND_CAUTION_MAX} km/h)."
        )

    if wave_height is not None and wave_height >= MarineSafetyThresholds.WAVE_SAFE_MAX:
        verdict = SafetyVerdict.CAUTION
        reasons.append(
            f"ADVISORY: Rough sea conditions with wave height of {wave_height:.2f} m (caution threshold: {MarineSafetyThresholds.WAVE_SAFE_MAX} m)."
        )

    if wind_gust is not None and wind_gust >= MarineSafetyThresholds.GUST_CAUTION_MIN:
        verdict = SafetyVerdict.CAUTION
        reasons.append(
            f"ADVISORY: Strong gusts up to {wind_gust:.1f} km/h reported (caution threshold: {MarineSafetyThresholds.GUST_CAUTION_MIN} km/h)."
        )

    if wind_speed is None or wave_height is None:
        missing_params = []
        if wind_speed is None:
            missing_params.append("wind speed")
        if wave_height is None:
            missing_params.append("wave height")
        verdict = SafetyVerdict.CAUTION
        reasons.append(
            f"ADVISORY: Missing meteorological telemetry for {', '.join(missing_params)}. "
            "Proceed with heightened caution as complete safety parameters cannot be verified."
        )

    if verdict == SafetyVerdict.SAFE:
        wind_str = f"wind speed at {wind_speed:.1f} km/h" if wind_speed is not None else "normal wind"
        wave_str = f"wave height at {wave_height:.2f} m" if wave_height is not None else "normal wave height"
        reasons.append(
            f"NORMAL: Favorable weather conditions with {wind_str} and {wave_str}."
        )

    return verdict, reasons, metrics


def evaluate_geospatial_safety(
    is_inside_restricted: bool,
    restricted_zone_name: str = "",
    distance_to_restricted_km: float = 999.0
) -> Tuple[SafetyVerdict, List[str]]:
    """Evaluates geospatial safety and geofence breaches."""
    reasons = []
    if is_inside_restricted:
        return (
            SafetyVerdict.UNSAFE,
            [f"HARD CONSTRAINT: Target/current coordinates are inside restricted marine sanctuary/naval security zone '{restricted_zone_name}'. Fishing strictly prohibited."]
        )
    
    if distance_to_restricted_km <= MarineSafetyThresholds.RESTRICTED_ZONE_BUFFER_KM:
        return (
            SafetyVerdict.CAUTION,
            [f"ADVISORY: Within {distance_to_restricted_km:.1f} km buffer zone of restricted boundary '{restricted_zone_name}'. Exercise navigation caution."]
        )

    return SafetyVerdict.SAFE, ["Geospatial check clear: No restricted marine or naval zone conflicts detected."]


def arbitrate_safety_hierarchy(
    weather_verdict: SafetyVerdict,
    weather_reasons: List[str],
    geospatial_verdict: SafetyVerdict,
    geospatial_reasons: List[str],
    ocean_verdict: str = "FAVORABLE",
    ocean_reasons: List[str] = None
) -> Tuple[SafetyVerdict, List[str], float]:
    """Applies the strict safety hierarchy across all agent outputs.
    
    Hierarchy:
    1. Hard constraints (Weather or Geospatial UNSAFE) -> UNSAFE (Risk score: 0.8 - 1.0)
    2. Advisories (Weather or Geospatial CAUTION) -> CAUTION (Risk score: 0.4 - 0.7)
    3. All clear -> SAFE (Risk score: 0.0 - 0.3)
    """
    if ocean_reasons is None:
        ocean_reasons = []

    combined_reasons = []
    
    # Priority 1: Check for UNSAFE
    if weather_verdict == SafetyVerdict.UNSAFE or geospatial_verdict == SafetyVerdict.UNSAFE:
        final_verdict = SafetyVerdict.UNSAFE
        risk_score = 0.9
        if geospatial_verdict == SafetyVerdict.UNSAFE:
            combined_reasons.extend(geospatial_reasons)
        if weather_verdict == SafetyVerdict.UNSAFE:
            combined_reasons.extend(weather_reasons)
        return final_verdict, combined_reasons, risk_score

    # Priority 2: Check for CAUTION
    if weather_verdict == SafetyVerdict.CAUTION or geospatial_verdict == SafetyVerdict.CAUTION:
        final_verdict = SafetyVerdict.CAUTION
        risk_score = 0.55
        if geospatial_verdict == SafetyVerdict.CAUTION:
            combined_reasons.extend(geospatial_reasons)
        if weather_verdict == SafetyVerdict.CAUTION:
            combined_reasons.extend(weather_reasons)
        return final_verdict, combined_reasons, risk_score

    # Priority 3: SAFE
    final_verdict = SafetyVerdict.SAFE
    risk_score = 0.15
    combined_reasons.extend(weather_reasons)
    combined_reasons.extend(geospatial_reasons)
    if ocean_reasons:
        combined_reasons.extend(ocean_reasons)

    return final_verdict, combined_reasons, risk_score
