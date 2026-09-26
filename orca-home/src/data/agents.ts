import { OrcaAgent } from '../types';

export const ORCA_COLLABORATIVE_AGENTS: OrcaAgent[] = [
  {
    id: 'env_agent',
    number: 1,
    name: 'Environmental Agent',
    shortRole: 'Bio-Thermal Front Analysis',
    fullRole: 'Analyzes spatial SST gradients, chlorophyll-a optical concentrations, and upwelling velocity indices to locate ocean front interfaces.',
    domain: 'Physical & Biochemical Oceanography',
    inputs: [
      'INCOIS ChloroGIN SST Satellite Composites (PFZ-TUNA-SST-CHL:sst)',
      'Oceansat-3 Ocean Colour Monitor (OCM-3) Chlorophyll Radiances',
      'Copernicus Surface Temperature Fields'
    ],
    algorithms: [
      'Cayula-Cornillon Thermal Front Detection Algorithm',
      'Spatial Edge Gradient Convolution (Sobel 2D filter)',
      'Ocean Upwelling Index (Ekman Transport integration)'
    ],
    outputs: [
      'Thermal Front Boundaries (°C/km gradient)',
      'Chlorophyll Plume Dispersion Polygons',
      'Marine Bio-productivity Index (0.0 – 1.0)'
    ],
    collaboratesWith: ['dynamics_agent', 'pfz_agent', 'fusion_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: 'Thermal Fronts Located',
      value: '14 Active'
    }
  },
  {
    id: 'weather_agent',
    number: 2,
    name: 'Atmospheric / Weather Agent',
    shortRole: 'Marine Weather & Wind Dynamics',
    fullRole: 'Monitors marine boundary-layer winds, barometric pressure tendencies, squall probabilities, and precipitation cells.',
    domain: 'Marine Meteorology',
    inputs: [
      'Copernicus / ECMWF 10m Marine Wind Vectors (u10, v10)',
      'IMD Coastal Automatic Weather Station (AWS) Telemetry',
      'INSAT-3DR Rapid-Scan Atmospheric Sounder Profiles'
    ],
    algorithms: [
      'Beaufort Wind Force Classification',
      'Gust & Squall Probability Estimator',
      'Barometric Pressure Tendency Tracker (ΔP / 3h)'
    ],
    outputs: [
      '10m Marine Wind Velocity & Direction Field',
      'Squall Risk Vector Alerts',
      'Coastal Atmospheric Stability Index'
    ],
    collaboratesWith: ['dynamics_agent', 'hazard_agent', 'vessel_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: 'Peak Offshore Wind',
      value: '18.4 kts (Beaufort 5)'
    }
  },
  {
    id: 'dynamics_agent',
    number: 3,
    name: 'Ocean Dynamics Agent',
    shortRole: 'Hydrodynamic Currents & Wave Energy',
    fullRole: 'Computes U/V surface current vector fields, tidal currents, significant wave heights, swell periods, and shoaling near coastlines.',
    domain: 'Physical Ocean Hydrodynamics',
    inputs: [
      'Copernicus Marine Physics U (eastward) & V (northward) Velocities',
      'Copernicus Global Spectral Wave Model (VHM0, VMDR, VTPK)',
      'INCOIS Wave Rider Buoy Real-Time Telemetry'
    ],
    algorithms: [
      'Geostrophic Balance & Ekman Current Inversion',
      'Spectral Wave-Current Interaction Model',
      'Coastal Shoaling & Refraction Calculator'
    ],
    outputs: [
      'Dynamic Current Particle Flow Vectors (m/s)',
      'Significant Wave Height & Peak Swell Direction',
      'Eddy Kinetic Energy (EKE) Heatmap'
    ],
    collaboratesWith: ['env_agent', 'weather_agent', 'vessel_agent', 'pfz_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: 'Max Wave Height',
      value: '1.68 m (Moderate)'
    }
  },
  {
    id: 'pfz_agent',
    number: 4,
    name: 'PFZ Intelligence Agent',
    shortRole: 'Fishery Habitat & Aggregation Index',
    fullRole: 'Synthesizes environmental thermal fronts and chlorophyll alignments into operational Potential Fishing Zone (PFZ) advisories and species probability.',
    domain: 'Fisheries Oceanography',
    inputs: [
      'Thermal Front Boundaries from Environmental Agent',
      'Chlorophyll Plumes from Environmental Agent',
      'Historical Catch per Unit Effort (CPUE) Correlation Matrices',
      'INCOIS Operational PFZ WebGIS Vectors'
    ],
    algorithms: [
      'Habitat Suitability Index (HSI) Multi-Factor Formulation',
      'Pelagic Fish Thermal Envelope Cross-Correlation',
      'Front Persistence & Aggregation Lifespan Decay'
    ],
    outputs: [
      'PFZ Advisory Vectors & Geodesic Bearings from Landing Centres',
      'Species Aggregation Probability (Tuna, Sardine, Mackerel)',
      'Fuel-Efficient Navigation Bearing to Prime Aggregation'
    ],
    collaboratesWith: ['env_agent', 'dynamics_agent', 'vessel_agent', 'synthesis_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: 'Active PFZ Sectors',
      value: '87 Vectors'
    }
  },
  {
    id: 'hazard_agent',
    number: 5,
    name: 'Marine Hazard & Disaster Agent',
    shortRole: 'Cyclone & Extreme Sea Early Warning',
    fullRole: 'Monitors tropical cyclogenesis in the Bay of Bengal & Arabian Sea, swell surges, high wave alerts, and triggers maritime evacuation thresholds.',
    domain: 'Coastal Disaster Warning',
    inputs: [
      'IMD RSMC Cyclone Track Bulletins & Cone of Uncertainty',
      'INCOIS Ocean State Forecast (OSF) High Wave Alert System',
      'Coastal Tide Gauge & Inundation Sensors'
    ],
    algorithms: [
      'Cyclone Cone of Uncertainty Spatial Intersect',
      'Swell Surge Coastal Inundation Risk Classifier',
      'Multi-Tier Hazard Warning Matrix (Green/Yellow/Orange/Red)'
    ],
    outputs: [
      'Spatial Hazard Exclusion Polygons',
      'Distance-to-Eye & Gale Wind Arrival ETA',
      'Port Signal & Fishermen "Do Not Venture" Advisories'
    ],
    collaboratesWith: ['weather_agent', 'vessel_agent', 'geofence_agent', 'synthesis_agent'],
    status: 'STANDBY',
    telemetryMetric: {
      label: 'North Indian Ocean Alert',
      value: 'No Active Cyclone'
    }
  },
  {
    id: 'vessel_agent',
    number: 6,
    name: 'Vessel Safety & Risk Agent',
    shortRole: 'Craft-Specific Sea-Venture Clearance',
    fullRole: 'Evaluates seaworthiness by matching real-time wind, wave steepness, and current drift against specific vessel classes (traditional motorized vs. mechanized trawlers).',
    domain: 'Naval Architecture & Maritime Safety',
    inputs: [
      'Vessel Class Specifications (Length, Draft, Engine BHP, Freeboard)',
      'Distance & Offshore Heading from Home Port',
      'Wave Height, Period & Wind Speed from Dynamics & Weather Agents'
    ],
    algorithms: [
      'Sea-Venture Safety Index (SVSI) Dynamic Formulation',
      'Dynamic Roll Resonance & Parametric Capsizing Risk Model',
      'Offshore Fuel Endurance & Safe Return Window Calculator'
    ],
    outputs: [
      'Binary Safe/Caution/Danger Sea-Venture Clearance',
      'Maximum Safe Offshore Range Limit (nmi / km)',
      'Recommended Departure Window & Return Deadline'
    ],
    collaboratesWith: ['dynamics_agent', 'weather_agent', 'hazard_agent', 'synthesis_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: '5m Craft Clearance',
      value: 'Safe within 25 km'
    }
  },
  {
    id: 'geofence_agent',
    number: 7,
    name: 'Geofencing & Boundary Agent',
    shortRole: 'Maritime Borders & MPA Enclosure',
    fullRole: 'Guards against accidental crossing of the International Maritime Boundary Line (IMBL), tracks EEZ boundaries, and enforces Marine Protected Areas.',
    domain: 'Maritime Law & Spatial Governance',
    inputs: [
      'International Maritime Boundary Lines (India-Sri Lanka, India-Pakistan, India-Bangladesh)',
      'Indian Exclusive Economic Zone (EEZ) 200 nmi Outer Limit',
      'Marine National Parks & Biosphere Reserves (Gulf of Mannar, Sundarbans)'
    ],
    algorithms: [
      'Geodesic Point-in-Polygon & Proximity Buffer Calculator',
      'Dynamic Drift Projection towards Prohibited Boundaries',
      'Progressive Alert Escalation (5 nmi Warning, 2 nmi Critical)'
    ],
    outputs: [
      'Proximity Distance & Bearing to Nearest IMBL Marker',
      'Border Violation Early Warning Audio/Text Alerts',
      'Authorized Fishing Zone Corridor Polygons'
    ],
    collaboratesWith: ['vessel_agent', 'fusion_agent', 'synthesis_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: 'IMBL Buffer Status',
      value: 'Clear of Borders'
    }
  },
  {
    id: 'fusion_agent',
    number: 8,
    name: 'Multi-Source Fusion Agent',
    shortRole: 'Cross-Sensor Calibration & Ingestion',
    fullRole: 'Ingests, aligns timestamps, handles spatial coordinate transformation (EPSG:4326 to Web Mercator), and cross-validates satellite vs. in-situ buoy telemetry.',
    domain: 'Geospatial Data Engineering & Data Quality',
    inputs: [
      'Oceansat-3 / INSAT-3DR Raw Observation Feeds',
      'INCOIS GeoServer WMS & WFS Endpoints',
      'Copernicus Marine Data Store API & Open-Meteo Grid Queries'
    ],
    algorithms: [
      'Spatio-Temporal Nearest-Neighbor & Bilinear Interpolation',
      'Cross-Sensor Residual Variance & Sensor Drift Filter',
      'Provenance Metadata Tracking & Timestamp Latency Watchdog'
    ],
    outputs: [
      'Unified Geographic Ocean Observation Grid',
      'Data Quality & Sensor Confidence Scores (0 – 100%)',
      'Latency & Availability Flags for UI Layer Manager'
    ],
    collaboratesWith: ['env_agent', 'dynamics_agent', 'weather_agent', 'synthesis_agent'],
    status: 'ACTIVE',
    telemetryMetric: {
      label: 'Sensor Ingestion Latency',
      value: '< 180 ms'
    }
  },
  {
    id: 'synthesis_agent',
    number: 9,
    name: 'Synthesis & Orchestration Agent',
    shortRole: 'Collaborative Reasoning & Multi-Lingual Advisory',
    fullRole: 'Orchestrates the multi-agent Directed Acyclic Graph (DAG), resolves conflicting risk parameters, and synthesizes explainable, natural-language decisions for end-users.',
    domain: 'Agentic AI & Decision Support',
    inputs: [
      'Findings & Confidence Scores from all 8 Domain Agents',
      'User Queries ("Can I fish tomorrow off Machilipatnam?")',
      'Fisherman Demographic Profile & Language Preference (Telugu, Tamil, Hindi, English)'
    ],
    algorithms: [
      'Multi-Criteria Decision Analysis (AHP - Analytic Hierarchy Process)',
      'Conflict Resolution & Safety-First Priority Arbitration',
      'Explainable Evidence Chain Extraction & Localized NLG Synthesis'
    ],
    outputs: [
      'Synthesized Operational Decision ("SAFE WITH ADVISORY")',
      'Transparent Step-by-Step Multi-Agent Evidence Chain',
      'Audio & Multi-Lingual Text Advisory in Vernacular Languages'
    ],
    collaboratesWith: ['env_agent', 'weather_agent', 'dynamics_agent', 'pfz_agent', 'hazard_agent', 'vessel_agent', 'geofence_agent', 'fusion_agent'],
    status: 'SYNTHESIZING',
    telemetryMetric: {
      label: 'Consensus Confidence',
      value: '98.4%'
    }
  }
];
