"""Geospatial Reasoning Agent.

Computes navigational distances (haversine), evaluates proximity to PFZ grounds,
and enforces geofencing against Marine Protected Areas (MPAs) and Naval Exclusion Zones.

Boundary distance is computed via local metric projection + Shapely nearest-boundary
calculation + Haversine distance verification, providing operational accuracy for
coastal safety buffers without centroid distortion.
"""
from typing import Dict, Any, List, Optional, Tuple
import math
from datetime import datetime, timezone
from shapely.geometry import Point, Polygon
from shapely.ops import nearest_points
from app.models.schemas import AgentResult
from app.core.safety_rules import evaluate_geospatial_safety, SafetyVerdict, MarineSafetyThresholds


# Representative polygons of protected / security marine zones along the Indian coast
RESTRICTED_ZONES = [
    {
        "name": "Karwar Naval Exclusion Perimeter (INS Kadamba / Project Seabird)",
        "type": "Naval Security Exclusion Zone",
        "state": "Karnataka",
        "coordinates": [
            [74.08, 14.78],
            [74.18, 14.78],
            [74.18, 14.86],
            [74.08, 14.86],
            [74.08, 14.78]
        ]
    },
    {
        "name": "Gulf of Mannar Marine National Park",
        "type": "Marine Biosphere Reserve / National Park",
        "state": "Tamil Nadu",
        "coordinates": [
            [79.00, 9.10],
            [79.35, 9.10],
            [79.35, 9.30],
            [79.00, 9.30],
            [79.00, 9.10]
        ]
    },
    {
        "name": "Gahirmatha Marine Sanctuary (Olive Ridley Nesting Zone)",
        "type": "Marine Sanctuary",
        "state": "Odisha",
        "coordinates": [
            [86.75, 20.60],
            [87.15, 20.60],
            [87.15, 20.90],
            [86.75, 20.90],
            [86.75, 20.60]
        ]
    },
    {
        "name": "Mumbai Offshore High Security Zone (Bombay High)",
        "type": "Critical Infrastructure Exclusion Perimeter",
        "state": "Maharashtra",
        "coordinates": [
            [71.85, 19.30],
            [72.15, 19.30],
            [72.15, 19.65],
            [71.85, 19.65],
            [71.85, 19.30]
        ]
    }
]


def validate_coordinates(coords: Any) -> Tuple[bool, Optional[float], Optional[float], str]:
    """Validates incoming coordinate payload.

    Requirements:
    - Must be a non-empty dictionary containing 'lat' and 'lon'.
    - Values must not be None.
    - Values must be numeric and convertible to finite float.
    - Values must not be NaN or Infinite.
    - Latitude must be between -90.0 and +90.0 inclusive.
    - Longitude must be between -180.0 and +180.0 inclusive.

    Returns:
        (is_valid, lat, lon, failure_reason)
    """
    if coords is None:
        return False, None, None, "coordinate payload is None"
    if not isinstance(coords, dict):
        return False, None, None, f"expected coordinate dictionary, received {type(coords).__name__}"
    if "lat" not in coords or "lon" not in coords:
        return False, None, None, "missing 'lat' or 'lon' key in coordinates dictionary"

    raw_lat = coords.get("lat")
    raw_lon = coords.get("lon")
    if raw_lat is None or raw_lon is None:
        return False, None, None, "latitude or longitude value is None"

    try:
        lat = float(raw_lat)
        lon = float(raw_lon)
    except (ValueError, TypeError):
        return False, None, None, f"non-numeric coordinate values: lat={raw_lat!r}, lon={raw_lon!r}"

    if math.isnan(lat) or math.isnan(lon):
        return False, None, None, "coordinate values contain NaN"

    if math.isinf(lat) or math.isinf(lon):
        return False, None, None, "coordinate values contain Infinite values"

    if not (-90.0 <= lat <= 90.0):
        return False, None, None, f"latitude {lat} is out of valid range [-90.0, 90.0]"

    if not (-180.0 <= lon <= 180.0):
        return False, None, None, f"longitude {lon} is out of valid range [-180.0, 180.0]"

    return True, lat, lon, ""


class GeospatialReasoningAgent:
    """Agent executing spatial queries, local metric boundary distance calculations, and geofence compliance."""

    name = "GeospatialReasoningAgent"

    def __init__(self):
        self.zone_polygons = [
            {
                "name": z["name"],
                "type": z["type"],
                "polygon": Polygon(z["coordinates"]),
                "coords": z["coordinates"]
            }
            for z in RESTRICTED_ZONES
        ]

    def haversine(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes great-circle haversine distance in km between two points."""
        r = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
        return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    def calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> int:
        """Computes navigational forward azimuth bearing in degrees (0-360)."""
        lat1, lat2 = math.radians(lat1), math.radians(lat2)
        dlon = math.radians(lon2 - lon1)
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        bearing = math.degrees(math.atan2(y, x))
        return int((bearing + 360) % 360)

    def distance_to_polygon_boundary_km(
        self,
        u_lat: float,
        u_lon: float,
        coords: List[List[float]]
    ) -> Tuple[bool, float, Tuple[float, float]]:
        """Calculates distance in km from vessel coordinates to polygon boundary.

        Algorithm:
            local metric projection + Shapely nearest-boundary calculation + Haversine distance verification.

        Characteristics:
            - Accurate for operational marine buffer evaluation (e.g. 2 km safety buffer).
            - Avoids centroid distortion by measuring distance directly to the nearest boundary edge.
            - Projects boundary vertices into a local equidistant metric coordinate frame centered at (u_lat, u_lon),
              computes the nearest point on the polygon's exterior boundary using Shapely, inverts back to (lat, lon),
              and computes the great-circle Haversine distance to that boundary point.
            - Computationally lightweight for real-time backend use without requiring full ellipsoidal geodetic
              polygon engines (e.g., GeographicLib polygon boundary solvers).

        Safety Semantics:
            - Vessel inside or on boundary: UNSAFE (distance = 0.0 km)
            - Distance <= 2.0 km: CAUTION (within caution perimeter)
            - Distance > 2.0 km: SAFE (outside caution perimeter)

        Returns:
            is_inside: bool (True if inside or on boundary)
            dist_km: float (distance in kilometers to nearest boundary point; 0.0 if inside)
            nearest_boundary_pt: (lat, lon) coordinates of nearest boundary point
        """
        r = 6371.0088  # WGS-84 mean radius in km
        lat_rad = math.radians(u_lat)
        cos_lat = math.cos(lat_rad)
        if abs(cos_lat) < 1e-6:
            cos_lat = 1e-6

        # Project boundary vertices into local metric coordinate frame (km) centered at vessel location (0, 0)
        proj_coords = []
        for lon_i, lat_i in coords:
            dx = math.radians(lon_i - u_lon) * r * cos_lat
            dy = math.radians(lat_i - u_lat) * r
            proj_coords.append((dx, dy))

        proj_poly = Polygon(proj_coords)
        origin_pt = Point(0.0, 0.0)

        # Check if inside or on boundary
        if proj_poly.covers(origin_pt):
            return True, 0.0, (u_lat, u_lon)

        # Compute nearest point on exterior boundary
        nearest_boundary_geom, _ = nearest_points(proj_poly.exterior, origin_pt)

        # Invert projected nearest point back to (lat, lon)
        near_dx = nearest_boundary_geom.x
        near_dy = nearest_boundary_geom.y
        near_lat = u_lat + math.degrees(near_dy / r)
        near_lon = u_lon + math.degrees(near_dx / (r * cos_lat))

        # Calculate great-circle distance to the boundary point
        dist_km = self.haversine(u_lat, u_lon, near_lat, near_lon)

        return False, dist_km, (round(near_lat, 5), round(near_lon, 5))

    async def execute(
        self,
        user_coords: Optional[Dict[str, Any]] = None,
        pfz_candidates: Optional[List[Dict[str, Any]]] = None
    ) -> AgentResult:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Rigorous coordinate validation - reject missing, non-numeric, NaN, inf, or out-of-range
        valid, u_lat, u_lon, failure_reason = validate_coordinates(user_coords)
        if not valid:
            reason_msg = (
                f"ADVISORY: Vessel coordinates missing, malformed, or out of range ({failure_reason}). "
                f"Geofence evaluation could not be verified."
            )
            payload = {
                "verdict": SafetyVerdict.CAUTION.value,
                "status_description": reason_msg,
                "coordinates_valid": False,
                "geospatial_evaluation_available": False,
                "is_inside_restricted": False,
                "inside_restricted_zone": False,
                "within_caution_perimeter": False,
                "distance_to_boundary_km": None,
                "distance_to_nearest_restricted_km": None,
                "nearest_restricted_zone": None,
                "restricted_zone_breached": None,
                "nearest_boundary_point": None,
                "reasons": [reason_msg],
                "candidates_with_distances": [],
                "user_coordinates": user_coords
            }
            return AgentResult(
                agent=self.name,
                status="partial",
                location=None,
                time_range={"start": now_iso, "end": now_iso},
                result=payload,
                confidence=0.0,
                sources=[{"name": "Marine Sanctuary & Naval Exclusion Registry", "timestamp": now_iso}],
                warnings=[reason_msg]
            )

        # 1. Geofence checks against restricted marine parks / naval zones
        inside_zone = None
        min_dist_to_boundary = 999.0
        nearest_zone_name = ""
        nearest_point = None

        for zp in self.zone_polygons:
            coords = zp["coords"]
            is_inside, dist_km, n_pt = self.distance_to_polygon_boundary_km(
                u_lat=u_lat,
                u_lon=u_lon,
                coords=coords
            )
            if is_inside:
                inside_zone = zp["name"]
                min_dist_to_boundary = 0.0
                nearest_zone_name = zp["name"]
                nearest_point = n_pt
                break

            if dist_km < min_dist_to_boundary:
                min_dist_to_boundary = dist_km
                nearest_zone_name = zp["name"]
                nearest_point = n_pt

        is_inside_zone = inside_zone is not None
        within_caution = (not is_inside_zone) and (min_dist_to_boundary <= MarineSafetyThresholds.RESTRICTED_ZONE_BUFFER_KM)

        verdict, reasons = evaluate_geospatial_safety(
            is_inside_restricted=is_inside_zone,
            restricted_zone_name=inside_zone or nearest_zone_name,
            distance_to_restricted_km=min_dist_to_boundary
        )

        # 2. Distance and bearing to PFZ candidates
        computed_candidates = []
        for c in (pfz_candidates or []):
            c_copy = dict(c)
            c_lat = c.get("lat")
            c_lon = c.get("lon")
            if c_lat is not None and c_lon is not None:
                dist_km = self.haversine(u_lat, u_lon, c_lat, c_lon)
                bearing = self.calculate_bearing(u_lat, u_lon, c_lat, c_lon)
                dist_1dec = round(dist_km, 1)
                c_copy["calculated_distance_km"] = round(dist_km, 2)
                c_copy["calculated_bearing_deg"] = bearing
                c_copy["distance_user_km"] = dist_1dec
                c_copy["bearing_user_deg"] = bearing
                c_copy["distance_km"] = dist_1dec
                c_copy["bearing_deg"] = bearing
                # Preserve source bulletin port reference if present
                if "source_distance_km" not in c_copy and "distance_km" in c:
                    c_copy["source_distance_km"] = c.get("distance_km")
                if "source_bearing_deg" not in c_copy and "bearing_deg" in c:
                    c_copy["source_bearing_deg"] = c.get("bearing_deg")

                # Check if candidate point itself is within restricted zone
                c_pt = Point(c_lon, c_lat)
                c_in_zone = any(zp["polygon"].covers(c_pt) for zp in self.zone_polygons)
                c_copy["is_in_restricted_zone"] = c_in_zone
            else:
                c_copy["calculated_distance_km"] = 999.0
                c_copy["calculated_bearing_deg"] = 0
                c_copy["distance_user_km"] = 999.0
                c_copy["bearing_user_deg"] = 0
                c_copy["distance_km"] = 999.0
                c_copy["bearing_deg"] = 0
                c_copy["is_in_restricted_zone"] = False
            computed_candidates.append(c_copy)

        status_desc = reasons[0] if reasons else "Waypoints clear."

        # Precision handling for distance:
        # Round to 3 decimals if in the threshold boundary region (1.99 - 2.01 km)
        # to unambiguously distinguish 1.999 km (CAUTION) vs 2.000 km (CAUTION) vs 2.001 km (SAFE);
        # otherwise round to 2 decimal places for clean operational display.
        if min_dist_to_boundary == 0.0:
            display_dist = 0.0
        elif 1.99 <= min_dist_to_boundary <= 2.01:
            display_dist = round(min_dist_to_boundary, 3)
        else:
            display_dist = round(min_dist_to_boundary, 2)

        payload = {
            "verdict": verdict.value,
            "status_description": status_desc,
            "coordinates_valid": True,
            "geospatial_evaluation_available": True,
            "is_inside_restricted": is_inside_zone,
            "inside_restricted_zone": is_inside_zone,
            "within_caution_perimeter": within_caution,
            "distance_to_boundary_km": display_dist,
            "distance_to_nearest_restricted_km": display_dist,
            "nearest_restricted_zone": nearest_zone_name,
            "restricted_zone_breached": inside_zone,
            "nearest_boundary_point": {"lat": nearest_point[0], "lon": nearest_point[1]} if nearest_point else None,
            "reasons": reasons,
            "candidates_with_distances": computed_candidates,
            "candidates": computed_candidates,
            "user_coordinates": {"lat": u_lat, "lon": u_lon}
        }

        warnings = [r for r in reasons if "HARD CONSTRAINT" in r or "ADVISORY" in r]

        return AgentResult(
            agent=self.name,
            status="success",
            location={"lat": u_lat, "lon": u_lon},
            time_range={"start": now_iso, "end": now_iso},
            result=payload,
            confidence=0.98,
            sources=[{"name": "Marine Sanctuary & Naval Exclusion Registry", "timestamp": now_iso}],
            warnings=warnings
        )


geospatial_reasoning_agent = GeospatialReasoningAgent()
