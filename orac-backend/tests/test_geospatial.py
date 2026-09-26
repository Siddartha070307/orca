"""Comprehensive tests for Geospatial geofence boundary distance calculations."""
import math
import pytest
from shapely.geometry import Polygon
from app.agents.geospatial_reasoning import (
    geospatial_reasoning_agent,
    validate_coordinates,
    RESTRICTED_ZONES
)
from app.agents.risk_assessment import risk_assessment_agent
from app.models.schemas import AgentResult
from app.core.safety_rules import (
    evaluate_geospatial_safety,
    arbitrate_safety_hierarchy,
    SafetyVerdict,
    MarineSafetyThresholds
)


# ====================================================================
# TESTS A - E: Rigorous Coordinate Validation & Safe Handling (No Silent Fallback)
# ====================================================================

@pytest.mark.asyncio
async def test_a_missing_coordinates_empty_or_none():
    """Test A: Missing coordinates dict / empty dict / None -> safe handling, coordinates_valid: false, verdict not falsely SAFE."""
    for empty_input in [{}, None]:
        res = await geospatial_reasoning_agent.execute(empty_input, pfz_candidates=[])
        p = res.result

        assert res.status == "partial"
        assert p["coordinates_valid"] is False
        assert p["geospatial_evaluation_available"] is False
        assert p["distance_to_boundary_km"] is None
        assert p["distance_to_nearest_restricted_km"] is None
        assert p["is_inside_restricted"] is False
        assert p["inside_restricted_zone"] is False
        assert p["within_caution_perimeter"] is False
        assert p["nearest_restricted_zone"] is None
        # Must NEVER produce a false SAFE verdict!
        assert p["verdict"] != "SAFE"
        assert p["verdict"] == "CAUTION"
        assert any("ADVISORY" in r for r in p["reasons"])


@pytest.mark.asyncio
async def test_b_malformed_coordinates():
    """Test B: Malformed coordinates (e.g. strings, non-numeric) -> safe handling, coordinates_valid: false, verdict not falsely SAFE."""
    malformed_inputs = [
        {"lat": "abc", "lon": 74.84},
        {"lat": 12.87, "lon": "xyz"},
        {"lat": "invalid", "lon": "corrupt"},
        {"latitude": 12.87, "longitude": 74.84},  # wrong key names
        {"lat": None, "lon": 74.84},
        {"lat": 12.87, "lon": None},
    ]
    for bad_coords in malformed_inputs:
        res = await geospatial_reasoning_agent.execute(bad_coords, pfz_candidates=[])
        p = res.result

        assert res.status == "partial"
        assert p["coordinates_valid"] is False
        assert p["geospatial_evaluation_available"] is False
        assert p["distance_to_boundary_km"] is None
        assert p["verdict"] != "SAFE"
        assert p["verdict"] == "CAUTION"


@pytest.mark.asyncio
async def test_c_latitude_out_of_range():
    """Test C: Latitude out of range (< -90 or > 90) -> safe handling, coordinates_valid: false, verdict not falsely SAFE."""
    out_of_range_lats = [
        {"lat": 90.001, "lon": 74.84},
        {"lat": -90.001, "lon": 74.84},
        {"lat": 120.0, "lon": 74.84},
        {"lat": -95.0, "lon": 74.84},
    ]
    for bad_coords in out_of_range_lats:
        res = await geospatial_reasoning_agent.execute(bad_coords, pfz_candidates=[])
        p = res.result

        assert res.status == "partial"
        assert p["coordinates_valid"] is False
        assert p["geospatial_evaluation_available"] is False
        assert p["distance_to_boundary_km"] is None
        assert p["verdict"] != "SAFE"
        assert p["verdict"] == "CAUTION"
        assert "range [-90.0, 90.0]" in p["reasons"][0]


@pytest.mark.asyncio
async def test_d_longitude_out_of_range():
    """Test D: Longitude out of range (< -180 or > 180) -> safe handling, coordinates_valid: false, verdict not falsely SAFE."""
    out_of_range_lons = [
        {"lat": 14.82, "lon": 180.001},
        {"lat": 14.82, "lon": -180.001},
        {"lat": 14.82, "lon": 200.0},
        {"lat": 14.82, "lon": -195.0},
    ]
    for bad_coords in out_of_range_lons:
        res = await geospatial_reasoning_agent.execute(bad_coords, pfz_candidates=[])
        p = res.result

        assert res.status == "partial"
        assert p["coordinates_valid"] is False
        assert p["geospatial_evaluation_available"] is False
        assert p["distance_to_boundary_km"] is None
        assert p["verdict"] != "SAFE"
        assert p["verdict"] == "CAUTION"
        assert "range [-180.0, 180.0]" in p["reasons"][0]


@pytest.mark.asyncio
async def test_e_nan_and_inf_coordinates():
    """Test E: NaN / infinite coordinates -> safe handling, coordinates_valid: false, verdict not falsely SAFE."""
    special_floats = [
        {"lat": float("nan"), "lon": 74.84},
        {"lat": 14.82, "lon": float("nan")},
        {"lat": float("inf"), "lon": 74.84},
        {"lat": float("-inf"), "lon": 74.84},
        {"lat": 14.82, "lon": float("inf")},
        {"lat": 14.82, "lon": float("-inf")},
    ]
    for bad_coords in special_floats:
        res = await geospatial_reasoning_agent.execute(bad_coords, pfz_candidates=[])
        p = res.result

        assert res.status == "partial"
        assert p["coordinates_valid"] is False
        assert p["geospatial_evaluation_available"] is False
        assert p["distance_to_boundary_km"] is None
        assert p["verdict"] != "SAFE"
        assert p["verdict"] == "CAUTION"


# ====================================================================
# TESTS F - I: Operational Geofence Semantics & Hierarchy Arbitration
# ====================================================================

@pytest.mark.asyncio
async def test_f_vessel_inside_restricted_polygon_unsafe():
    """Test F: Inside restricted zone -> UNSAFE."""
    # Deep inside Karwar Naval Exclusion zone
    coords = {"lat": 14.82, "lon": 74.12}
    res = await geospatial_reasoning_agent.execute(coords, pfz_candidates=[])
    p = res.result

    assert res.status == "success"
    assert p["coordinates_valid"] is True
    assert p["geospatial_evaluation_available"] is True
    assert p["inside_restricted_zone"] is True
    assert p["is_inside_restricted"] is True
    assert p["distance_to_boundary_km"] == 0.0
    assert p["distance_to_nearest_restricted_km"] == 0.0
    assert p["verdict"] == "UNSAFE"
    assert "Karwar Naval" in p["restricted_zone_breached"]

    # Verify RiskAssessmentAgent evaluates to UNSAFE
    weather_safe = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={"verdict": "SAFE", "reasons": ["Normal wind and waves"], "metrics": {}}
    )
    ocean_favorable = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        result={"verdict": "FAVORABLE", "candidates": []}
    )
    risk_res = await risk_assessment_agent.execute(
        weather_result=weather_safe,
        ocean_result=ocean_favorable,
        geospatial_result=res
    )
    assert risk_res.result["verdict"] == "UNSAFE"
    assert "STAY ASHORE" in risk_res.result["actionable_directive"]


@pytest.mark.asyncio
async def test_g_vessel_1km_outside_restricted_boundary_caution():
    """Test G: 1 km outside restricted zone -> CAUTION."""
    # Karwar eastern boundary is at lon 74.18, lat 14.82
    # At lat 14.82, 0.01 deg lon ≈ 1.075 km
    coords = {"lat": 14.82, "lon": 74.19}
    res = await geospatial_reasoning_agent.execute(coords, pfz_candidates=[])
    p = res.result

    assert res.status == "success"
    assert p["coordinates_valid"] is True
    assert p["inside_restricted_zone"] is False
    assert p["within_caution_perimeter"] is True
    assert 0.9 <= p["distance_to_boundary_km"] <= 1.3
    assert p["distance_to_nearest_restricted_km"] == p["distance_to_boundary_km"]
    assert p["verdict"] == "CAUTION"
    assert "Karwar Naval" in p["nearest_restricted_zone"]


@pytest.mark.asyncio
async def test_h_vessel_clearly_outside_greater_than_2km_safe():
    """Test H: Clearly outside (> 2 km) -> SAFE."""
    # Open sea well off Mangalore [lat 12.87, lon 74.84] - over 200 km from Karwar
    coords = {"lat": 12.87, "lon": 74.84}
    res = await geospatial_reasoning_agent.execute(coords, pfz_candidates=[])
    p = res.result

    assert res.status == "success"
    assert p["coordinates_valid"] is True
    assert p["inside_restricted_zone"] is False
    assert p["is_inside_restricted"] is False
    assert p["within_caution_perimeter"] is False
    assert p["distance_to_boundary_km"] > 2.0
    assert p["verdict"] == "SAFE"


@pytest.mark.asyncio
async def test_i_favorable_pfz_cannot_override_geofence_unsafe_or_caution():
    """Test I: Favorable PFZ cannot override geofence UNSAFE or CAUTION."""
    # Sub-case 1: Geofence UNSAFE + Favorable PFZ -> MUST arbitrate to UNSAFE
    coords_inside = {"lat": 14.82, "lon": 74.12}
    geo_unsafe = await geospatial_reasoning_agent.execute(coords_inside, pfz_candidates=[])

    weather_safe = AgentResult(
        agent="WeatherIntelligenceAgent",
        status="success",
        result={"verdict": "SAFE", "reasons": ["Calm sea"], "metrics": {}}
    )
    ocean_favorable = AgentResult(
        agent="OceanAnalyticsAgent",
        status="success",
        result={
            "verdict": "FAVORABLE",
            "recommended_pfz": {"id": "PFZ-EXCELLENT-01", "distance_km": 12.0, "sst_c": 28.5}
        }
    )

    risk_res_unsafe = await risk_assessment_agent.execute(
        weather_result=weather_safe,
        ocean_result=ocean_favorable,
        geospatial_result=geo_unsafe
    )
    assert risk_res_unsafe.result["verdict"] == "UNSAFE"
    assert any("HARD CONSTRAINT" in r for r in risk_res_unsafe.result["primary_drivers"])

    # Sub-case 2: Geofence CAUTION + Favorable PFZ -> MUST arbitrate to CAUTION
    coords_near = {"lat": 14.82, "lon": 74.19}
    geo_caution = await geospatial_reasoning_agent.execute(coords_near, pfz_candidates=[])

    risk_res_caution = await risk_assessment_agent.execute(
        weather_result=weather_safe,
        ocean_result=ocean_favorable,
        geospatial_result=geo_caution
    )
    assert risk_res_caution.result["verdict"] == "CAUTION"
    assert any("ADVISORY" in r for r in risk_res_caution.result["primary_drivers"])


# ====================================================================
# CORRECTION 6: Threshold Edge Behavior Around 2.0 km
# ====================================================================

@pytest.mark.asyncio
async def test_threshold_edge_behavior_around_2km():
    """Verify strict threshold edge behavior around 2.0 km:
    - distance = 1.999 km -> CAUTION (within caution perimeter)
    - distance = 2.000 km -> CAUTION (within caution perimeter)
    - distance = 2.001 km -> SAFE (not in caution perimeter)
    """
    # Direct safety rule evaluation check
    v_1999, r_1999 = evaluate_geospatial_safety(False, "Test Zone", 1.999)
    assert v_1999 == SafetyVerdict.CAUTION

    v_2000, r_2000 = evaluate_geospatial_safety(False, "Test Zone", 2.000)
    assert v_2000 == SafetyVerdict.CAUTION

    v_2001, r_2001 = evaluate_geospatial_safety(False, "Test Zone", 2.001)
    assert v_2001 == SafetyVerdict.SAFE

    # Agent execution check with precise distance offsets from Karwar eastern boundary (lon 74.18)
    lat = 14.82
    cos_lat = math.cos(math.radians(lat))
    r = 6371.0
    km_per_deg_lon = math.radians(1) * r * cos_lat

    # Case 1: 1.999 km
    lon_1999 = 74.18 + (1.999 / km_per_deg_lon)
    res_1999 = await geospatial_reasoning_agent.execute({"lat": lat, "lon": lon_1999}, pfz_candidates=[])
    p_1999 = res_1999.result
    assert p_1999["within_caution_perimeter"] is True
    assert p_1999["verdict"] == "CAUTION"
    assert p_1999["distance_to_boundary_km"] == 1.999

    # Case 2: 2.000 km
    lon_2000 = 74.18 + (2.000 / km_per_deg_lon)
    res_2000 = await geospatial_reasoning_agent.execute({"lat": lat, "lon": lon_2000}, pfz_candidates=[])
    p_2000 = res_2000.result
    assert p_2000["within_caution_perimeter"] is True
    assert p_2000["verdict"] == "CAUTION"
    assert p_2000["distance_to_boundary_km"] == 2.0

    # Case 3: 2.001 km
    lon_2001 = 74.18 + (2.001 / km_per_deg_lon)
    res_2001 = await geospatial_reasoning_agent.execute({"lat": lat, "lon": lon_2001}, pfz_candidates=[])
    p_2001 = res_2001.result
    assert p_2001["within_caution_perimeter"] is False
    assert p_2001["verdict"] == "SAFE"
    assert p_2001["distance_to_boundary_km"] == 2.001


# ====================================================================
# CORRECTION 2: Gahirmatha Reproduction Verification
# ====================================================================

@pytest.mark.asyncio
async def test_gahirmatha_reproduction_verification():
    """Verify Gahirmatha Marine Sanctuary coordinates and calculation at (20.59, 87.00)."""
    gahirmatha_zone = next(z for z in RESTRICTED_ZONES if "Gahirmatha" in z["name"])
    # 1. Exact polygon coordinates: lon [86.75, 87.15], lat [20.60, 20.90]
    expected_poly = [
        [86.75, 20.60],
        [87.15, 20.60],
        [87.15, 20.90],
        [86.75, 20.90],
        [86.75, 20.60]
    ]
    assert gahirmatha_zone["coordinates"] == expected_poly

    # 2. Vessel at (lat=20.59, lon=87.00) is genuinely outside polygon
    # Southern boundary of Gahirmatha is at latitude 20.60
    coords = {"lat": 20.59, "lon": 87.00}
    res = await geospatial_reasoning_agent.execute(coords, pfz_candidates=[])
    p = res.result

    assert p["inside_restricted_zone"] is False
    assert p["is_inside_restricted"] is False
    assert p["nearest_restricted_zone"] == "Gahirmatha Marine Sanctuary (Olive Ridley Nesting Zone)"
    # Expected distance: (20.60 - 20.59) * 111.195 km = 1.11 km
    assert p["distance_to_boundary_km"] == 1.11
    assert p["within_caution_perimeter"] is True
    assert p["verdict"] == "CAUTION"
    assert p["nearest_boundary_point"]["lat"] == 20.60
    assert p["nearest_boundary_point"]["lon"] == 87.00


# ====================================================================
# Centroid vs Boundary & Unit Validations
# ====================================================================

@pytest.mark.asyncio
async def test_boundary_distance_vs_centroid_distance():
    """Verify that agent uses boundary distance (CAUTION), NOT centroid distance (falsely SAFE)."""
    coords = {"lat": 14.82, "lon": 74.19}
    res = await geospatial_reasoning_agent.execute(coords, pfz_candidates=[])
    p = res.result

    karwar_poly = next(z["polygon"] for z in geospatial_reasoning_agent.zone_polygons if "Karwar" in z["name"])
    centroid_dist = geospatial_reasoning_agent.haversine(coords["lat"], coords["lon"], karwar_poly.centroid.y, karwar_poly.centroid.x)
    assert centroid_dist > 5.0, f"Expected centroid distance > 5km, got {centroid_dist}"

    assert p["distance_to_boundary_km"] < 2.0
    assert p["within_caution_perimeter"] is True
    assert p["verdict"] == "CAUTION"


def test_distance_is_in_km_not_degrees():
    """Verify that distance returned is in actual kilometers and not raw degrees."""
    u_lat = 14.82
    u_lon = 74.19
    karwar_coords = next(z["coords"] for z in geospatial_reasoning_agent.zone_polygons if "Karwar" in z["name"])
    is_inside, dist_km, (n_lat, n_lon) = geospatial_reasoning_agent.distance_to_polygon_boundary_km(
        u_lat=u_lat,
        u_lon=u_lon,
        coords=karwar_coords
    )

    assert dist_km > 0.5, "Distance is dangerously small, might be raw degrees!"
    assert 0.9 <= dist_km <= 1.3, f"Expected ~1.08 km, got {dist_km}"
    assert abs(u_lon - n_lon) < 0.05


@pytest.mark.asyncio
async def test_point_exactly_on_boundary():
    """Point sitting directly on the boundary segment -> distance 0.0 km, breach."""
    on_boundary = {"lat": 14.78, "lon": 74.18}
    res = await geospatial_reasoning_agent.execute(on_boundary, pfz_candidates=[])
    p = res.result
    assert p["inside_restricted_zone"] is True
    assert p["distance_to_boundary_km"] == 0.0
    assert p["verdict"] == "UNSAFE"


@pytest.mark.asyncio
async def test_point_just_outside_boundary():
    """Point 100 meters (0.1 km) outside boundary -> CAUTION, within perimeter."""
    just_outside = {"lat": 14.82, "lon": 74.181}
    res = await geospatial_reasoning_agent.execute(just_outside, pfz_candidates=[])
    p = res.result
    assert p["inside_restricted_zone"] is False
    assert p["within_caution_perimeter"] is True
    assert p["distance_to_boundary_km"] < 0.3
    assert p["verdict"] == "CAUTION"
