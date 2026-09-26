"""Mock INCOIS PFZ (Potential Fishing Zone) data module.

Structured behind an abstract interface (OceanDataProvider) so it can be seamlessly
swapped for a production INCOIS API or Satellite OCM-3/Modis pipeline later.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import math


class OceanDataProvider(ABC):
    """Abstract interface for Ocean & PFZ data feeds."""

    @abstractmethod
    def get_pfz_advisories(
        self,
        lat: float,
        lon: float,
        sector_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Returns PFZ candidate zones near given coordinates or sector."""
        pass


def calculate_fish_density_index(suitability: float, chlorophyll: float, has_thermal_front: bool = False) -> float:
    """Calculates a deterministic simulated PFZ fish-density index on a 0.0 - 10.0 scale.
    
    Documented Formula:
      base = suitability * 7.0 (yields 0.0 to 7.0 contribution)
      chl_factor = min(2.0, max(0.0, ((chlorophyll - 0.20) / 2.30) * 2.0)) (yields 0.0 to 2.0 contribution)
      front_bonus = 1.0 if has_thermal_front else 0.0 (yields 0.0 or 1.0 bonus)
      result = clamp(round(base + chl_factor + front_bonus, 1), 0.0, 10.0)
      
    This is the SINGLE SOURCE OF TRUTH for fish_density_index in ORCA.
    """
    s = max(0.0, min(1.0, float(suitability)))
    c = max(0.0, float(chlorophyll))
    base = s * 7.0
    chl_factor = min(2.0, max(0.0, ((c - 0.20) / 2.30) * 2.0))
    front_bonus = 1.0 if has_thermal_front else 0.0
    val = round(base + chl_factor + front_bonus, 1)
    return float(max(0.0, min(10.0, val)))


class INCOISMockProvider(OceanDataProvider):
    """Realistic mock implementation of INCOIS PFZ advisories.
    
    Provides authentic SST (Sea Surface Temperature), Chlorophyll-a concentration,
    depth, bearing, and target pelagic/demersal fish species across Indian coastline.
    """

    COASTAL_SECTORS = [
        # Karnataka
        {
            "sector": "Mangalore",
            "state": "Karnataka",
            "port_lat": 12.87,
            "port_lon": 74.84,
            "candidates": [
                {
                    "id": "PFZ-MNG-01",
                    "lat": 12.85,
                    "lon": 74.55,
                    "bearing_deg": 265,
                    "distance_km": 31.5,
                    "depth_m": 45,
                    "sst_c": 28.2,
                    "chlorophyll_mg_m3": 1.45,
                    "suitability_score": 0.91,
                    "target_species": ["Indian Mackerel", "Oil Sardine", "Seer Fish"],
                    "feature": "Strong SST front with high chlorophyll boundary"
                },
                {
                    "id": "PFZ-MNG-02",
                    "lat": 13.05,
                    "lon": 74.62,
                    "bearing_deg": 310,
                    "distance_km": 28.0,
                    "depth_m": 38,
                    "sst_c": 28.6,
                    "chlorophyll_mg_m3": 0.95,
                    "suitability_score": 0.79,
                    "target_species": ["Sardines", "Squid"],
                    "feature": "Moderate thermal gradient"
                },
                {
                    "id": "PFZ-MNG-03",
                    "lat": 12.68,
                    "lon": 74.45,
                    "bearing_deg": 240,
                    "distance_km": 46.5,
                    "depth_m": 65,
                    "sst_c": 27.9,
                    "chlorophyll_mg_m3": 1.65,
                    "suitability_score": 0.88,
                    "target_species": ["Yellowfin Tuna", "Ribbonfish", "Pomfret"],
                    "feature": "Outer shelf upwelling zone with cyclonic eddy boundary"
                },
                {
                    "id": "PFZ-MNG-04",
                    "lat": 12.92,
                    "lon": 74.68,
                    "bearing_deg": 280,
                    "distance_km": 18.5,
                    "depth_m": 28,
                    "sst_c": 28.9,
                    "chlorophyll_mg_m3": 0.82,
                    "suitability_score": 0.74,
                    "target_species": ["Anchovy", "Croaker", "Sole Fish"],
                    "feature": "Nearshore thermal convergence plume"
                }
            ]
        },
        {
            "sector": "Malpe",
            "state": "Karnataka",
            "port_lat": 13.35,
            "port_lon": 74.70,
            "candidates": [
                {
                    "id": "PFZ-MLP-01",
                    "lat": 13.30,
                    "lon": 74.40,
                    "bearing_deg": 260,
                    "distance_km": 32.5,
                    "depth_m": 42,
                    "sst_c": 28.4,
                    "chlorophyll_mg_m3": 1.50,
                    "suitability_score": 0.89,
                    "target_species": ["Indian Mackerel", "Squid", "Pomfret"],
                    "feature": "Shelf thermal boundary with high nutrient upwelling"
                }
            ]
        },
        {
            "sector": "Bhatkal",
            "state": "Karnataka",
            "port_lat": 13.97,
            "port_lon": 74.55,
            "candidates": [
                {
                    "id": "PFZ-BHT-01",
                    "lat": 13.92,
                    "lon": 74.25,
                    "bearing_deg": 255,
                    "distance_km": 33.0,
                    "depth_m": 44,
                    "sst_c": 28.3,
                    "chlorophyll_mg_m3": 1.35,
                    "suitability_score": 0.86,
                    "target_species": ["Sardines", "Mackerel", "Ribbonfish"],
                    "feature": "Coastal upwelling plume with chlorophyll filament"
                }
            ]
        },
        {
            "sector": "Karwar",
            "state": "Karnataka",
            "port_lat": 14.82,
            "port_lon": 74.13,
            "candidates": [
                {
                    "id": "PFZ-GOA-01",
                    "lat": 15.42,
                    "lon": 73.52,
                    "bearing_deg": 255,
                    "distance_km": 33.0,
                    "depth_m": 48,
                    "sst_c": 28.4,
                    "chlorophyll_mg_m3": 1.25,
                    "suitability_score": 0.87,
                    "target_species": ["Kingfish", "Mackerel", "Tuna"],
                    "feature": "Thermal break coinciding with chlorophyll filament"
                }
            ]
        },

        # Kerala
        {
            "sector": "Kochi",
            "state": "Kerala",
            "port_lat": 9.93,
            "port_lon": 76.26,
            "candidates": [
                {
                    "id": "PFZ-KOC-01",
                    "lat": 9.88,
                    "lon": 75.98,
                    "bearing_deg": 255,
                    "distance_km": 32.0,
                    "depth_m": 52,
                    "sst_c": 28.8,
                    "chlorophyll_mg_m3": 1.80,
                    "suitability_score": 0.93,
                    "target_species": ["Yellowfin Tuna", "Indian Mackerel", "Anchovy"],
                    "feature": "Coastal upwelling plume with high productivity"
                },
                {
                    "id": "PFZ-KOC-02",
                    "lat": 10.12,
                    "lon": 76.05,
                    "bearing_deg": 315,
                    "distance_km": 27.5,
                    "depth_m": 42,
                    "sst_c": 29.1,
                    "chlorophyll_mg_m3": 1.10,
                    "suitability_score": 0.82,
                    "target_species": ["Threadfin Bream", "Carangids"],
                    "feature": "Chlorophyll edge convergence"
                }
            ]
        },
        {
            "sector": "Beypore",
            "state": "Kerala",
            "port_lat": 11.16,
            "port_lon": 75.81,
            "candidates": [
                {
                    "id": "PFZ-BEY-01",
                    "lat": 11.10,
                    "lon": 75.50,
                    "bearing_deg": 250,
                    "distance_km": 34.5,
                    "depth_m": 48,
                    "sst_c": 28.5,
                    "chlorophyll_mg_m3": 1.60,
                    "suitability_score": 0.90,
                    "target_species": ["Oil Sardine", "Mackerel", "Shrimp"],
                    "feature": "Malabar upwelling plume front"
                }
            ]
        },
        {
            "sector": "Kollam",
            "state": "Kerala",
            "port_lat": 8.89,
            "port_lon": 76.55,
            "candidates": [
                {
                    "id": "PFZ-KLM-01",
                    "lat": 8.82,
                    "lon": 76.28,
                    "bearing_deg": 250,
                    "distance_km": 31.0,
                    "depth_m": 50,
                    "sst_c": 28.4,
                    "chlorophyll_mg_m3": 1.70,
                    "suitability_score": 0.92,
                    "target_species": ["Threadfin Bream", "Squid", "Deep Sea Shrimp"],
                    "feature": "Ashtamudi outfall nutrient enrichment zone"
                }
            ]
        },
        {
            "sector": "Vizhinjam",
            "state": "Kerala",
            "port_lat": 8.38,
            "port_lon": 76.99,
            "candidates": [
                {
                    "id": "PFZ-VZH-01",
                    "lat": 8.25,
                    "lon": 76.75,
                    "bearing_deg": 240,
                    "distance_km": 30.0,
                    "depth_m": 55,
                    "sst_c": 28.2,
                    "chlorophyll_mg_m3": 1.55,
                    "suitability_score": 0.91,
                    "target_species": ["Skipjack Tuna", "Mahi Mahi", "Barracuda"],
                    "feature": "Deep oceanic drop-off current edge"
                }
            ]
        },

        # Goa
        {
            "sector": "Goa",
            "state": "Goa",
            "port_lat": 15.49,
            "port_lon": 73.82,
            "candidates": [
                {
                    "id": "PFZ-GOA-01",
                    "lat": 15.42,
                    "lon": 73.52,
                    "bearing_deg": 255,
                    "distance_km": 33.0,
                    "depth_m": 48,
                    "sst_c": 28.4,
                    "chlorophyll_mg_m3": 1.25,
                    "suitability_score": 0.87,
                    "target_species": ["Kingfish", "Mackerel", "Tuna"],
                    "feature": "Thermal break coinciding with chlorophyll filament"
                }
            ]
        },

        # Maharashtra
        {
            "sector": "Mumbai",
            "state": "Maharashtra",
            "port_lat": 18.92,
            "port_lon": 72.83,
            "candidates": [
                {
                    "id": "PFZ-BOM-01",
                    "lat": 18.88,
                    "lon": 72.48,
                    "bearing_deg": 260,
                    "distance_km": 38.0,
                    "depth_m": 55,
                    "sst_c": 27.8,
                    "chlorophyll_mg_m3": 1.50,
                    "suitability_score": 0.89,
                    "target_species": ["Bombay Duck", "Pomfret", "Ribbonfish"],
                    "feature": "Shelf-break oceanic front"
                }
            ]
        },
        {
            "sector": "Alibaug",
            "state": "Maharashtra",
            "port_lat": 18.64,
            "port_lon": 72.87,
            "candidates": [
                {
                    "id": "PFZ-ALB-01",
                    "lat": 18.58,
                    "lon": 72.55,
                    "bearing_deg": 255,
                    "distance_km": 34.0,
                    "depth_m": 50,
                    "sst_c": 27.9,
                    "chlorophyll_mg_m3": 1.45,
                    "suitability_score": 0.87,
                    "target_species": ["Pomfret", "Prawns", "Croakers"],
                    "feature": "Continental shelf eddy boundary"
                }
            ]
        },
        {
            "sector": "Ratnagiri",
            "state": "Maharashtra",
            "port_lat": 16.99,
            "port_lon": 73.30,
            "candidates": [
                {
                    "id": "PFZ-RTN-01",
                    "lat": 16.95,
                    "lon": 72.98,
                    "bearing_deg": 260,
                    "distance_km": 34.5,
                    "depth_m": 52,
                    "sst_c": 28.0,
                    "chlorophyll_mg_m3": 1.35,
                    "suitability_score": 0.88,
                    "target_species": ["Mackerel", "Kingfish", "Pomfret"],
                    "feature": "Konkan thermal gradient front"
                }
            ]
        },
        {
            "sector": "Malvan",
            "state": "Maharashtra",
            "port_lat": 16.06,
            "port_lon": 73.46,
            "candidates": [
                {
                    "id": "PFZ-MLV-01",
                    "lat": 16.01,
                    "lon": 73.18,
                    "bearing_deg": 250,
                    "distance_km": 31.0,
                    "depth_m": 45,
                    "sst_c": 28.2,
                    "chlorophyll_mg_m3": 1.40,
                    "suitability_score": 0.89,
                    "target_species": ["Kingfish", "Seer Fish", "Sardines"],
                    "feature": "Rocky bank coastal upwelling convergence"
                }
            ]
        },

        # Gujarat
        {
            "sector": "Porbandar",
            "state": "Gujarat",
            "port_lat": 21.64,
            "port_lon": 69.62,
            "candidates": [
                {
                    "id": "PFZ-PBD-01",
                    "lat": 21.48,
                    "lon": 69.32,
                    "bearing_deg": 235,
                    "distance_km": 36.0,
                    "depth_m": 60,
                    "sst_c": 26.8,
                    "chlorophyll_mg_m3": 1.65,
                    "suitability_score": 0.91,
                    "target_species": ["Silver Pomfret", "Ribbonfish", "Hilsa"],
                    "feature": "Saurashtra coastal front with high chlorophyll boundary"
                }
            ]
        },
        {
            "sector": "Veraval",
            "state": "Gujarat",
            "port_lat": 20.90,
            "port_lon": 70.37,
            "candidates": [
                {
                    "id": "PFZ-VRV-01",
                    "lat": 20.65,
                    "lon": 70.18,
                    "bearing_deg": 215,
                    "distance_km": 34.0,
                    "depth_m": 58,
                    "sst_c": 27.2,
                    "chlorophyll_mg_m3": 1.70,
                    "suitability_score": 0.92,
                    "target_species": ["Cephalopods", "Ribbonfish", "Croaker"],
                    "feature": "Major upwelling zone off Somnath-Veraval coast"
                }
            ]
        },
        {
            "sector": "Okha",
            "state": "Gujarat",
            "port_lat": 22.47,
            "port_lon": 69.07,
            "candidates": [
                {
                    "id": "PFZ-OKH-01",
                    "lat": 22.58,
                    "lon": 68.75,
                    "bearing_deg": 290,
                    "distance_km": 35.0,
                    "depth_m": 45,
                    "sst_c": 26.5,
                    "chlorophyll_mg_m3": 1.55,
                    "suitability_score": 0.88,
                    "target_species": ["Pomfret", "Threadfin", "Shrimp"],
                    "feature": "Gulf of Kutch mouth tidal frontal eddy"
                }
            ]
        },

        # Tamil Nadu
        {
            "sector": "Chennai",
            "state": "Tamil Nadu",
            "port_lat": 13.08,
            "port_lon": 80.27,
            "candidates": [
                {
                    "id": "PFZ-CHN-01",
                    "lat": 13.15,
                    "lon": 80.58,
                    "bearing_deg": 75,
                    "distance_km": 35.0,
                    "depth_m": 60,
                    "sst_c": 29.2,
                    "chlorophyll_mg_m3": 1.15,
                    "suitability_score": 0.85,
                    "target_species": ["Skipjack Tuna", "Barracuda", "Seer Fish"],
                    "feature": "Bay of Bengal cyclonic eddy periphery"
                }
            ]
        },
        {
            "sector": "Cuddalore",
            "state": "Tamil Nadu",
            "port_lat": 11.75,
            "port_lon": 79.77,
            "candidates": [
                {
                    "id": "PFZ-CDL-01",
                    "lat": 11.72,
                    "lon": 80.05,
                    "bearing_deg": 95,
                    "distance_km": 31.0,
                    "depth_m": 55,
                    "sst_c": 29.0,
                    "chlorophyll_mg_m3": 1.25,
                    "suitability_score": 0.86,
                    "target_species": ["Snapper", "Seer Fish", "Mackerel"],
                    "feature": "Coromandel coastal current shear zone"
                }
            ]
        },
        {
            "sector": "Nagapattinam",
            "state": "Tamil Nadu",
            "port_lat": 10.77,
            "port_lon": 79.84,
            "candidates": [
                {
                    "id": "PFZ-NGP-01",
                    "lat": 10.74,
                    "lon": 80.12,
                    "bearing_deg": 95,
                    "distance_km": 31.5,
                    "depth_m": 48,
                    "sst_c": 28.9,
                    "chlorophyll_mg_m3": 1.30,
                    "suitability_score": 0.87,
                    "target_species": ["Tuna", "Sardines", "Carangids"],
                    "feature": "Palk Strait outflow thermal convergence"
                }
            ]
        },
        {
            "sector": "Rameswaram",
            "state": "Tamil Nadu",
            "port_lat": 9.28,
            "port_lon": 79.31,
            "candidates": [
                {
                    "id": "PFZ-RMW-01",
                    "lat": 9.15,
                    "lon": 79.55,
                    "bearing_deg": 120,
                    "distance_km": 30.0,
                    "depth_m": 35,
                    "sst_c": 28.7,
                    "chlorophyll_mg_m3": 1.45,
                    "suitability_score": 0.89,
                    "target_species": ["Crab", "Shrimp", "Seer Fish", "Mullet"],
                    "feature": "Gulf of Mannar productive biogenic zone"
                }
            ]
        },
        {
            "sector": "Tuticorin",
            "state": "Tamil Nadu",
            "port_lat": 8.76,
            "port_lon": 78.13,
            "candidates": [
                {
                    "id": "PFZ-TUT-01",
                    "lat": 8.72,
                    "lon": 78.42,
                    "bearing_deg": 98,
                    "distance_km": 32.0,
                    "depth_m": 50,
                    "sst_c": 28.5,
                    "chlorophyll_mg_m3": 1.50,
                    "suitability_score": 0.90,
                    "target_species": ["Skipjack Tuna", "Carangids", "Sardines"],
                    "feature": "Gulf of Mannar thermal divergence"
                }
            ]
        },
        {
            "sector": "Kanyakumari",
            "state": "Tamil Nadu",
            "port_lat": 8.08,
            "port_lon": 77.53,
            "candidates": [
                {
                    "id": "PFZ-KYK-01",
                    "lat": 7.92,
                    "lon": 77.38,
                    "bearing_deg": 220,
                    "distance_km": 24.0,
                    "depth_m": 40,
                    "sst_c": 28.1,
                    "chlorophyll_mg_m3": 1.65,
                    "suitability_score": 0.94,
                    "target_species": ["Tuna", "Sardines", "Carangids"],
                    "feature": "Tri-sea confluence upwelling zone"
                }
            ]
        },

        # Andhra Pradesh
        {
            "sector": "Kakinada",
            "state": "Andhra Pradesh",
            "port_lat": 16.99,
            "port_lon": 82.24,
            "candidates": [
                {
                    "id": "PFZ-KAK-01",
                    "lat": 16.92,
                    "lon": 82.52,
                    "bearing_deg": 110,
                    "distance_km": 31.0,
                    "depth_m": 42,
                    "sst_c": 28.6,
                    "chlorophyll_mg_m3": 1.40,
                    "suitability_score": 0.90,
                    "target_species": ["Yellowfin Tuna", "Indian Mackerel", "Seer Fish", "Tiger Prawn"],
                    "feature": "Godavari river discharge thermal boundary with high chlorophyll edge"
                },
                {
                    "id": "PFZ-KAK-02",
                    "lat": 17.15,
                    "lon": 82.48,
                    "bearing_deg": 55,
                    "distance_km": 28.5,
                    "depth_m": 38,
                    "sst_c": 28.9,
                    "chlorophyll_mg_m3": 1.15,
                    "suitability_score": 0.83,
                    "target_species": ["Pomfret", "Ribbonfish", "Shrimp"],
                    "feature": "Shelf-break oceanic upwelling zone"
                }
            ]
        },
        {
            "sector": "Visakhapatnam",
            "state": "Andhra Pradesh",
            "port_lat": 17.68,
            "port_lon": 83.21,
            "candidates": [
                {
                    "id": "PFZ-VSK-01",
                    "lat": 17.62,
                    "lon": 83.55,
                    "bearing_deg": 105,
                    "distance_km": 37.0,
                    "depth_m": 70,
                    "sst_c": 28.7,
                    "chlorophyll_mg_m3": 1.30,
                    "suitability_score": 0.88,
                    "target_species": ["Yellowfin Tuna", "Mackerel", "Shrimp"],
                    "feature": "Strong shelf chlorophyll plume"
                }
            ]
        },
        {
            "sector": "Machilipatnam",
            "state": "Andhra Pradesh",
            "port_lat": 16.18,
            "port_lon": 81.14,
            "candidates": [
                {
                    "id": "PFZ-MCH-01",
                    "lat": 16.08,
                    "lon": 81.42,
                    "bearing_deg": 110,
                    "distance_km": 32.0,
                    "depth_m": 40,
                    "sst_c": 28.8,
                    "chlorophyll_mg_m3": 1.50,
                    "suitability_score": 0.89,
                    "target_species": ["Hilsa", "Catfish", "Seer Fish", "Prawns"],
                    "feature": "Krishna river delta nutrient front"
                }
            ]
        },
        {
            "sector": "Krishnapatnam",
            "state": "Andhra Pradesh",
            "port_lat": 14.25,
            "port_lon": 80.12,
            "candidates": [
                {
                    "id": "PFZ-KPT-01",
                    "lat": 14.22,
                    "lon": 80.40,
                    "bearing_deg": 95,
                    "distance_km": 30.5,
                    "depth_m": 50,
                    "sst_c": 29.0,
                    "chlorophyll_mg_m3": 1.20,
                    "suitability_score": 0.85,
                    "target_species": ["Ribbonfish", "Tuna", "Mackerel"],
                    "feature": "Coastal thermal eddy front"
                }
            ]
        },

        # Odisha
        {
            "sector": "Paradip",
            "state": "Odisha",
            "port_lat": 20.31,
            "port_lon": 86.61,
            "candidates": [
                {
                    "id": "PFZ-PDP-01",
                    "lat": 20.25,
                    "lon": 86.92,
                    "bearing_deg": 105,
                    "distance_km": 33.0,
                    "depth_m": 45,
                    "sst_c": 28.5,
                    "chlorophyll_mg_m3": 1.55,
                    "suitability_score": 0.90,
                    "target_species": ["Hilsa", "Pomfret", "Mahanadi Prawn"],
                    "feature": "Mahanadi plume thermal boundary"
                }
            ]
        },
        {
            "sector": "Puri",
            "state": "Odisha",
            "port_lat": 19.81,
            "port_lon": 85.83,
            "candidates": [
                {
                    "id": "PFZ-PRI-01",
                    "lat": 19.68,
                    "lon": 86.08,
                    "bearing_deg": 120,
                    "distance_km": 30.0,
                    "depth_m": 42,
                    "sst_c": 28.6,
                    "chlorophyll_mg_m3": 1.45,
                    "suitability_score": 0.88,
                    "target_species": ["Mackerel", "Hilsa", "Croaker"],
                    "feature": "Chilika lake outflow coastal boundary"
                }
            ]
        },
        {
            "sector": "Gahirmatha",
            "state": "Odisha",
            "port_lat": 20.59,
            "port_lon": 87.00,
            "candidates": [
                {
                    "id": "PFZ-GHM-01",
                    "lat": 20.68,
                    "lon": 87.32,
                    "bearing_deg": 70,
                    "distance_km": 35.0,
                    "depth_m": 38,
                    "sst_c": 28.4,
                    "chlorophyll_mg_m3": 1.60,
                    "suitability_score": 0.89,
                    "target_species": ["Pelagic Mackerel", "Pomfret", "Anchovy"],
                    "feature": "High chlorophyll coastal shelf filament (Offshore Sanctuary Buffer)"
                }
            ]
        },
        {
            "sector": "Gopalpur",
            "state": "Odisha",
            "port_lat": 19.26,
            "port_lon": 84.91,
            "candidates": [
                {
                    "id": "PFZ-GPL-01",
                    "lat": 19.18,
                    "lon": 85.18,
                    "bearing_deg": 110,
                    "distance_km": 30.0,
                    "depth_m": 48,
                    "sst_c": 28.7,
                    "chlorophyll_mg_m3": 1.35,
                    "suitability_score": 0.87,
                    "target_species": ["Seer Fish", "Sardines", "Tuna"],
                    "feature": "Southern Odisha upwelling front"
                }
            ]
        },

        # West Bengal
        {
            "sector": "Digha",
            "state": "West Bengal",
            "port_lat": 21.62,
            "port_lon": 87.51,
            "candidates": [
                {
                    "id": "PFZ-DGH-01",
                    "lat": 21.45,
                    "lon": 87.75,
                    "bearing_deg": 130,
                    "distance_km": 32.0,
                    "depth_m": 30,
                    "sst_c": 28.2,
                    "chlorophyll_mg_m3": 1.85,
                    "suitability_score": 0.93,
                    "target_species": ["Hilsa", "Pomfret", "Bombay Duck", "Tiger Prawn"],
                    "feature": "Northern Bay of Bengal estuarine nutrient front"
                }
            ]
        },
        {
            "sector": "Kakdwip",
            "state": "West Bengal",
            "port_lat": 21.87,
            "port_lon": 88.19,
            "candidates": [
                {
                    "id": "PFZ-KKD-01",
                    "lat": 21.65,
                    "lon": 88.38,
                    "bearing_deg": 140,
                    "distance_km": 32.5,
                    "depth_m": 28,
                    "sst_c": 28.3,
                    "chlorophyll_mg_m3": 1.90,
                    "suitability_score": 0.94,
                    "target_species": ["Hilsa", "Bhetki", "Gold Prawn"],
                    "feature": "Hooghly estuarine plume high-productivity front"
                }
            ]
        },

        # Islands
        {
            "sector": "Kavaratti",
            "state": "Lakshadweep",
            "port_lat": 10.57,
            "port_lon": 72.64,
            "candidates": [
                {
                    "id": "PFZ-KVT-01",
                    "lat": 10.45,
                    "lon": 72.42,
                    "bearing_deg": 240,
                    "distance_km": 28.0,
                    "depth_m": 120,
                    "sst_c": 29.0,
                    "chlorophyll_mg_m3": 0.95,
                    "suitability_score": 0.88,
                    "target_species": ["Skipjack Tuna", "Yellowfin Tuna", "Wahoo"],
                    "feature": "Atoll reef drop-off upwelling filament"
                }
            ]
        },
        {
            "sector": "Port Blair",
            "state": "Andaman & Nicobar",
            "port_lat": 11.62,
            "port_lon": 92.73,
            "candidates": [
                {
                    "id": "PFZ-PBL-01",
                    "lat": 11.52,
                    "lon": 93.02,
                    "bearing_deg": 110,
                    "distance_km": 33.5,
                    "depth_m": 140,
                    "sst_c": 29.3,
                    "chlorophyll_mg_m3": 1.05,
                    "suitability_score": 0.90,
                    "target_species": ["Yellowfin Tuna", "Bigeye Tuna", "Billfish"],
                    "feature": "Andaman Sea deep-water current convergence"
                }
            ]
        }
    ]

    def _haversine_dist(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine distance in kilometers."""
        r = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
        return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    def _calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> int:
        """Computes navigational forward azimuth bearing in degrees (0-360)."""
        lat1, lat2 = math.radians(lat1), math.radians(lat2)
        dlon = math.radians(lon2 - lon1)
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        bearing = math.degrees(math.atan2(y, x))
        return int((bearing + 360) % 360)

    def _get_sector_candidates(self, matched_sector: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Returns exactly four realistic, varied PFZ candidates for the sector."""
        candidates = [dict(c) for c in matched_sector.get("candidates", [])]
        for c in candidates:
            if "fish_density_index" not in c or c["fish_density_index"] is None:
                has_front = "front" in c.get("feature", "").lower()
                c["fish_density_index"] = calculate_fish_density_index(
                    suitability=c.get("suitability_score", 0.8),
                    chlorophyll=c.get("chlorophyll_mg_m3", 1.0),
                    has_thermal_front=has_front
                )

        if len(candidates) >= 4:
            return candidates[:4]

        p_lat = float(matched_sector["port_lat"])
        p_lon = float(matched_sector["port_lon"])
        c1 = candidates[0]
        base_id = c1["id"].rsplit("-", 1)[0] if "-" in c1["id"] else f"PFZ-{matched_sector['sector'][:3].upper()}"

        d_lat = float(c1["lat"]) - p_lat
        d_lon = float(c1["lon"]) - p_lon

        # Deterministic multi-tier oceanographic specifications for candidates 02, 03, 04
        tier_specs = [
            {
                "suffix": "02",
                "lat_mult": 0.90, "lon_mult": 0.85, "lat_off": 0.12,
                "depth": max(25, int(c1.get("depth_m", 45) * 0.85)),
                "sst": round(float(c1.get("sst_c", 28.2)) + 0.4, 1),
                "chl": round(max(0.40, float(c1.get("chlorophyll_mg_m3", 1.40)) - 0.35), 2),
                "score": round(max(0.65, float(c1.get("suitability_score", 0.90)) - 0.08), 2),
                "species": ["Sardines", "Mackerel", "Squid"],
                "feature": "Mid-shelf thermal convergence boundary"
            },
            {
                "suffix": "03",
                "lat_mult": 1.35, "lon_mult": 1.45, "lat_off": -0.10,
                "depth": int(c1.get("depth_m", 45) * 1.5),
                "sst": round(float(c1.get("sst_c", 28.2)) - 0.4, 1),
                "chl": round(float(c1.get("chlorophyll_mg_m3", 1.40)) + 0.25, 2),
                "score": round(max(0.70, float(c1.get("suitability_score", 0.90)) - 0.04), 2),
                "species": ["Yellowfin Tuna", "Ribbonfish", "Pomfret", "Skipjack"],
                "feature": "Outer-shelf localized upwelling plume"
            },
            {
                "suffix": "04",
                "lat_mult": 0.70, "lon_mult": 0.65, "lat_off": -0.05,
                "depth": max(20, int(c1.get("depth_m", 45) * 0.65)),
                "sst": round(float(c1.get("sst_c", 28.2)) + 0.7, 1),
                "chl": round(max(0.50, float(c1.get("chlorophyll_mg_m3", 1.40)) - 0.55), 2),
                "score": round(max(0.60, float(c1.get("suitability_score", 0.90)) - 0.14), 2),
                "species": ["Anchovy", "Croaker", "Sole Fish"],
                "feature": "Nearshore coastal eddy boundary"
            }
        ]

        existing_count = len(candidates)
        specs_to_add = tier_specs[existing_count - 1:]

        for sp in specs_to_add:
            c_lat = round(p_lat + d_lat * sp["lat_mult"] + sp["lat_off"], 3)
            c_lon = round(p_lon + d_lon * sp["lon_mult"], 3)
            dist = round(self._haversine_dist(p_lat, p_lon, c_lat, c_lon), 1)
            brg = self._calculate_bearing(p_lat, p_lon, c_lat, c_lon)
            has_front = "front" in sp["feature"].lower()
            fdi = calculate_fish_density_index(
                suitability=sp["score"],
                chlorophyll=sp["chl"],
                has_thermal_front=has_front
            )
            cand = {
                "id": f"{base_id}-{sp['suffix']}",
                "lat": c_lat,
                "lon": c_lon,
                "bearing_deg": brg,
                "distance_km": dist,
                "depth_m": sp["depth"],
                "sst_c": sp["sst"],
                "chlorophyll_mg_m3": sp["chl"],
                "suitability_score": sp["score"],
                "fish_density_index": fdi,
                "target_species": sp["species"],
                "feature": sp["feature"]
            }
            candidates.append(cand)

        for c in candidates:
            if "fish_density_index" not in c or c["fish_density_index"] is None:
                has_front = "front" in c.get("feature", "").lower()
                c["fish_density_index"] = calculate_fish_density_index(
                    suitability=c.get("suitability_score", 0.8),
                    chlorophyll=c.get("chlorophyll_mg_m3", 1.0),
                    has_thermal_front=has_front
                )

        return candidates[:4]

    def get_pfz_advisories(
        self,
        lat: float,
        lon: float,
        sector_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Returns PFZ candidate zones near given coordinates or sector."""
        now = datetime.now(timezone.utc)
        valid_until = (now + timedelta(hours=48)).isoformat()

        matched_sector = None
        # If a sector name is explicitly specified, try to match it first
        if sector_name:
            for s in self.COASTAL_SECTORS:
                if sector_name.lower() in s["sector"].lower() or sector_name.lower() in s["state"].lower():
                    matched_sector = s
                    break

        # Otherwise, locate nearest coastal sector based on distance
        if not matched_sector:
            matched_sector = min(
                self.COASTAL_SECTORS,
                key=lambda s: self._haversine_dist(lat, lon, s["port_lat"], s["port_lon"])
            )

        match_dist_km = round(self._haversine_dist(lat, lon, matched_sector["port_lat"], matched_sector["port_lon"]), 1)

        # Distance disclosure threshold: if > 40km away from harbor, disclose approximation
        if match_dist_km > 40.0:
            display_sector = f"{matched_sector['sector']} (approximate, {match_dist_km} km away)"
        else:
            display_sector = matched_sector["sector"]

        # If user is farther than 300km from any predefined port and no sector explicitly specified, dynamically generate four offshore candidates
        if not sector_name and match_dist_km > 300.0:
            dyn_specs = [
                {"suffix": "01", "dlat": 0.15, "dlon": -0.20, "depth": 65, "sst": 28.5, "chl": 1.20, "score": 0.84, "species": ["Pelagic Mackerel", "Tuna"], "feature": "Estimated oceanic thermal frontal zone"},
                {"suffix": "02", "dlat": 0.28, "dlon": -0.10, "depth": 55, "sst": 28.8, "chl": 0.95, "score": 0.78, "species": ["Skipjack Tuna", "Squid"], "feature": "Secondary offshore temperature gradient"},
                {"suffix": "03", "dlat": 0.05, "dlon": -0.38, "depth": 85, "sst": 28.1, "chl": 1.45, "score": 0.88, "species": ["Yellowfin Tuna", "Billfish"], "feature": "Deep-water thermal divergence edge"},
                {"suffix": "04", "dlat": -0.18, "dlon": -0.22, "depth": 75, "sst": 28.6, "chl": 1.10, "score": 0.80, "species": ["Mahi Mahi", "Barracuda"], "feature": "Subsurface current convergence boundary"}
            ]
            dyn_candidates = []
            for d in dyn_specs:
                dyn_lat = round(lat + d["dlat"], 3)
                dyn_lon = round(lon + d["dlon"], 3)
                dyn_user_dist = round(self._haversine_dist(lat, lon, dyn_lat, dyn_lon), 1)
                dyn_user_bearing = self._calculate_bearing(lat, lon, dyn_lat, dyn_lon)
                has_front = "front" in d["feature"].lower()
                dyn_fdi = calculate_fish_density_index(
                    suitability=d["score"],
                    chlorophyll=d["chl"],
                    has_thermal_front=has_front
                )
                dyn_candidates.append({
                    "id": f"PFZ-DYN-{d['suffix']}",
                    "lat": dyn_lat,
                    "lon": dyn_lon,
                    "source_bearing_deg": dyn_user_bearing,
                    "source_distance_km": dyn_user_dist,
                    "distance_user_km": dyn_user_dist,
                    "bearing_user_deg": dyn_user_bearing,
                    "calculated_distance_km": dyn_user_dist,
                    "calculated_bearing_deg": dyn_user_bearing,
                    "distance_km": dyn_user_dist,
                    "bearing_deg": dyn_user_bearing,
                    "depth_m": d["depth"],
                    "sst_c": d["sst"],
                    "chlorophyll_mg_m3": d["chl"],
                    "suitability_score": d["score"],
                    "fish_density_index": dyn_fdi,
                    "target_species": d["species"],
                    "feature": d["feature"],
                    "bulletin_id": "INCOIS-PFZ-OFFSHORE-2026",
                    "sector": "Offshore Indian Ocean",
                    "state": "EEZ",
                    "sector_match_distance_km": match_dist_km,
                    "generated_at": now.isoformat(),
                    "valid_until": valid_until,
                    "is_simulated": True
                })
            return sorted(dyn_candidates, key=lambda x: x["suitability_score"], reverse=True)

        sector_candidates = self._get_sector_candidates(matched_sector)
        results = []
        for c in sector_candidates:
            item = dict(c)
            bulletin_sec = matched_sector["sector"].upper().replace(" ", "-")
            item["bulletin_id"] = f"INCOIS-PFZ-{bulletin_sec}-2026"
            item["sector"] = display_sector
            item["state"] = matched_sector["state"]
            item["sector_match_distance_km"] = match_dist_km
            item["generated_at"] = now.isoformat()
            item["valid_until"] = valid_until
            # Explicitly preserve static source bulletin metadata from port
            item["source_distance_km"] = c.get("distance_km")
            item["source_bearing_deg"] = c.get("bearing_deg")
            # Dynamically calculate user-relative navigation values from current coordinates
            user_dist = round(self._haversine_dist(lat, lon, c["lat"], c["lon"]), 1)
            user_bearing = self._calculate_bearing(lat, lon, c["lat"], c["lon"])
            item["distance_user_km"] = user_dist
            item["bearing_user_deg"] = user_bearing
            item["calculated_distance_km"] = user_dist
            item["calculated_bearing_deg"] = user_bearing
            item["distance_km"] = user_dist
            item["bearing_deg"] = user_bearing
            item["fish_density_index"] = c.get("fish_density_index")
            item["is_simulated"] = True
            results.append(item)

        return sorted(results, key=lambda x: x["suitability_score"], reverse=True)


incois_provider = INCOISMockProvider()
