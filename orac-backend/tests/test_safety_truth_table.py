import pytest
from app.core.safety_rules import (
    SafetyVerdict,
    MarineSafetyThresholds,
    evaluate_weather_safety,
    evaluate_geospatial_safety,
    arbitrate_safety_hierarchy
)


# =========================================================================
# 1. TRUTH TABLE AUDIT (All 8 Primary Combinations)
# =========================================================================

def test_truth_table_combo_1_weather_unsafe_ocean_favorable():
    """Combo 1: Weather=UNSAFE, Geo=SAFE, Ocean=FAVORABLE -> UNSAFE."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.UNSAFE,
        weather_reasons=["Gale force winds"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=[]
    )
    assert v == SafetyVerdict.UNSAFE
    assert score >= 0.8


def test_truth_table_combo_2_weather_unsafe_ocean_suboptimal():
    """Combo 2: Weather=UNSAFE, Geo=SAFE, Ocean=SUBOPTIMAL -> UNSAFE."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.UNSAFE,
        weather_reasons=["Violent squall"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear"],
        ocean_verdict="SUBOPTIMAL",
        ocean_reasons=["SST too high"]
    )
    assert v == SafetyVerdict.UNSAFE


def test_truth_table_combo_3_geo_unsafe_ocean_favorable():
    """Combo 3: Weather=SAFE, Geo=UNSAFE, Ocean=FAVORABLE -> UNSAFE."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.SAFE,
        weather_reasons=["Calm seas"],
        geospatial_verdict=SafetyVerdict.UNSAFE,
        geospatial_reasons=["Inside Gahirmatha Marine Sanctuary"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=[]
    )
    assert v == SafetyVerdict.UNSAFE
    assert any("Sanctuary" in r for r in reasons)


def test_truth_table_combo_4_weather_caution_geo_safe_ocean_favorable():
    """Combo 4: Weather=CAUTION, Geo=SAFE, Ocean=FAVORABLE -> CAUTION."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.CAUTION,
        weather_reasons=["Moderate wind 40 km/h"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["Clear"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=[]
    )
    assert v == SafetyVerdict.CAUTION
    assert 0.4 <= score <= 0.7


def test_truth_table_combo_5_weather_safe_geo_caution_ocean_favorable():
    """Combo 5: Weather=SAFE, Geo=CAUTION, Ocean=FAVORABLE -> CAUTION."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.SAFE,
        weather_reasons=["Calm"],
        geospatial_verdict=SafetyVerdict.CAUTION,
        geospatial_reasons=["Within 1.5 km buffer of Naval perimeter"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=[]
    )
    assert v == SafetyVerdict.CAUTION


def test_truth_table_combo_6_both_caution_ocean_favorable():
    """Combo 6: Weather=CAUTION, Geo=CAUTION, Ocean=FAVORABLE -> CAUTION."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.CAUTION,
        weather_reasons=["Elevated swell"],
        geospatial_verdict=SafetyVerdict.CAUTION,
        geospatial_reasons=["Near boundary"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=[]
    )
    assert v == SafetyVerdict.CAUTION


def test_truth_table_combo_7_all_safe_ocean_favorable():
    """Combo 7: Weather=SAFE, Geo=SAFE, Ocean=FAVORABLE -> SAFE."""
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.SAFE,
        weather_reasons=["Gentle breeze"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["All waypoints clear"],
        ocean_verdict="FAVORABLE",
        ocean_reasons=[]
    )
    assert v == SafetyVerdict.SAFE
    assert score <= 0.3


def test_truth_table_combo_8_all_safe_ocean_suboptimal():
    """Combo 8: Weather=SAFE, Geo=SAFE, Ocean=SUBOPTIMAL -> SAFE (with suboptimal note)."""
    suboptimal_note = "PFZ thermal front suitability below optimum operational threshold."
    v, reasons, score = arbitrate_safety_hierarchy(
        weather_verdict=SafetyVerdict.SAFE,
        weather_reasons=["Gentle breeze"],
        geospatial_verdict=SafetyVerdict.SAFE,
        geospatial_reasons=["All waypoints clear"],
        ocean_verdict="SUBOPTIMAL",
        ocean_reasons=[suboptimal_note]
    )
    assert v == SafetyVerdict.SAFE
    assert suboptimal_note in reasons


# =========================================================================
# 2. EXACT THRESHOLD BOUNDARY TESTS (Authoritative ORCA Specification)
# =========================================================================

def test_wind_threshold_boundaries():
    """Wind: SAFE < 35.0 km/h, CAUTION >= 35.0 and < 50.0 km/h, UNSAFE >= 50.0 km/h."""
    # 34.9 is SAFE
    v, _, _ = evaluate_weather_safety(wind_speed=34.9, wave_height=1.0)
    assert v == SafetyVerdict.SAFE

    # 35.0 is CAUTION (exact lower caution boundary)
    v, _, _ = evaluate_weather_safety(wind_speed=35.0, wave_height=1.0)
    assert v == SafetyVerdict.CAUTION

    # 49.9 is CAUTION (just below unsafe threshold)
    v, _, _ = evaluate_weather_safety(wind_speed=49.9, wave_height=1.0)
    assert v == SafetyVerdict.CAUTION

    # 50.0 is UNSAFE (exact lower unsafe boundary)
    v, _, _ = evaluate_weather_safety(wind_speed=50.0, wave_height=1.0)
    assert v == SafetyVerdict.UNSAFE


def test_wave_threshold_boundaries():
    """Wave: SAFE < 2.0 m, CAUTION >= 2.0 and < 3.5 m, UNSAFE >= 3.5 m."""
    # 1.99 is SAFE
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=1.99)
    assert v == SafetyVerdict.SAFE

    # 2.0 is CAUTION (exact lower caution boundary)
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=2.0)
    assert v == SafetyVerdict.CAUTION

    # 3.49 is CAUTION (just below unsafe threshold)
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=3.49)
    assert v == SafetyVerdict.CAUTION

    # 3.5 is UNSAFE (exact lower unsafe boundary)
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=3.5)
    assert v == SafetyVerdict.UNSAFE


def test_gust_threshold_boundaries():
    """Gust: SAFE < 55.0 km/h, CAUTION >= 55.0 and < 70.0 km/h, UNSAFE >= 70.0 km/h."""
    # 54.9 is SAFE
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=1.0, wind_gust=54.9)
    assert v == SafetyVerdict.SAFE

    # 55.0 is CAUTION (exact lower caution boundary)
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=1.0, wind_gust=55.0)
    assert v == SafetyVerdict.CAUTION

    # 69.9 is CAUTION (just below unsafe threshold)
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=1.0, wind_gust=69.9)
    assert v == SafetyVerdict.CAUTION

    # 70.0 is UNSAFE (exact lower unsafe boundary)
    v, _, _ = evaluate_weather_safety(wind_speed=15.0, wave_height=1.0, wind_gust=70.0)
    assert v == SafetyVerdict.UNSAFE


def test_geofence_boundary_distance_edge_cases():
    """Geofence: Inside polygon -> UNSAFE, <= 2.0 km -> CAUTION, > 2.0 km -> SAFE."""
    # Inside polygon
    v, _ = evaluate_geospatial_safety(is_inside_restricted=True, restricted_zone_name="Test Zone")
    assert v == SafetyVerdict.UNSAFE

    # Exactly 2.0 km -> CAUTION (buffer boundary)
    v, _ = evaluate_geospatial_safety(is_inside_restricted=False, distance_to_restricted_km=2.0)
    assert v == SafetyVerdict.CAUTION

    # 2.001 km -> SAFE (outside buffer)
    v, _ = evaluate_geospatial_safety(is_inside_restricted=False, distance_to_restricted_km=2.001)
    assert v == SafetyVerdict.SAFE


def test_storm_alert_always_unsafe():
    """Convective storm or cyclone alert is strictly UNSAFE regardless of wind/wave values."""
    v, reasons, _ = evaluate_weather_safety(
        wind_speed=5.0,
        wave_height=0.4,
        has_storm_alert=True,
        storm_description="Severe Thunderstorm Squall"
    )
    assert v == SafetyVerdict.UNSAFE
    assert any("storm/cyclone" in r for r in reasons)


def test_storm_wmo_codes_unsafe():
    """WMO codes 95, 96, and 99 are deterministically UNSAFE."""
    for code in [95, 96, 99]:
        v, reasons, metrics = evaluate_weather_safety(
            wind_speed=10.0,
            wave_height=0.5,
            weather_code=code
        )
        assert v == SafetyVerdict.UNSAFE
        assert metrics["has_storm_alert"] is True
        assert any("storm/cyclone" in r.lower() or "wmo" in r.lower() for r in reasons)
