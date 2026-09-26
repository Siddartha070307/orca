// ═══════════════════════════════════════════════════════════════
// OCEAN SIMULATION — CENTRALIZED CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export const OCEAN_CONFIG = {
    surfaceSize: 4000,
    horizonRadius: 36000,
    waterSurfaceHeight: 0.0,
    coastZ: -620,
    shelfTransitionZ: 300,
    abyssZ: 1400,
    shallowDepth: -14.0,
    midDepth: -45.0,
    abyssDepth: -92.0,
};

export const UNDERWATER_CONFIG = {
    visibilityNear: 6.0,
    visibilityFar: 180.0,
    surfaceFogDensity: 0.00022,
    underwaterFogDensityNear: 0.0075,
    underwaterFogDensityDeep: 0.016,
    particleCount: 1800,
    particleBoxSize: 320,
    lightRayCount: 10,
    lightRaySpread: 350,
    causticIntensity: 0.75,
    depthZones: {
        surface: { maxDepth: 4.0, color: 0x076a8a, fogDensity: 0.0055 },
        shallow: { maxDepth: 18.0, color: 0x054868, fogDensity: 0.0085 },
        medium:  { maxDepth: 45.0, color: 0x032848, fogDensity: 0.0115 },
        deep:    { maxDepth: 80.0, color: 0x01142e, fogDensity: 0.0150 },
        abyss:   { maxDepth: 150.0, color: 0x000a1c, fogDensity: 0.0190 },
    }
};

// ═══════════════════════════════════════════════════════════════
// POTENTIAL FISHING ZONE (PFZ) CENTRALIZED CONFIGURATION
// Demonstrates SIH Problem Statement 26176 Marine Digital Twin
// Single Source of Truth for:
// - Surface PFZ GIS Visualization Layer
// - Boat Zone Detection & HUD Telemetry
// - Underwater Ecosystem & Biomass Productivity Distribution
// ═══════════════════════════════════════════════════════════════
export const PFZ_CONFIG = {
    zones: [
        {
            id: 'PFZ-1',
            name: 'HIGH',
            level: 'HIGH',
            colorHex: 0x00ff66,
            colorRgb: [0.0, 1.0, 0.4],
            colorCss: '#00ff66',
            center: { x: -580, z: 920 },
            radius: 210,
            chlorophyll: 4.85,      // mg/m³ (high nutrient upwelling)
            sst: 26.2,              // °C (favorable thermal front)
            fishProbability: 0.94,  // high probability index
            vegetationTarget: 400,  // dense seagrass & coral meadows
            fishTarget: 240,        // 3 large active fish schools
            schoolCount: 3,
            description: 'Offshore upwelling zone · Peak chlorophyll & dense pelagic biomass (FAR)',
        },
        {
            id: 'PFZ-2',
            name: 'MODERATE',
            level: 'MODERATE',
            colorHex: 0xffff00,
            colorRgb: [1.0, 1.0, 0.0],
            colorCss: '#ffff00',
            center: { x: 480, z: 340 },
            radius: 175,
            chlorophyll: 2.15,      // mg/m³
            sst: 27.8,              // °C
            fishProbability: 0.62,
            vegetationTarget: 180,  // moderate coral reef clusters
            fishTarget: 100,        // 2 medium schools
            schoolCount: 2,
            description: 'Mid-shelf coral atoll · Moderate biomass and reef fish concentration (MEDIUM)',
        },
        {
            id: 'PFZ-3',
            name: 'LOW',
            level: 'LOW',
            colorHex: 0xff3333,
            colorRgb: [1.0, 0.2, 0.2],
            colorCss: '#ff3333',
            center: { x: -160, z: -200 },
            radius: 155,
            chlorophyll: 0.42,      // mg/m³ (low nutrients)
            sst: 29.1,              // °C
            fishProbability: 0.21,
            vegetationTarget: 60,   // sparse vegetation, wide exposed seabed
            fishTarget: 30,         // 1 small school
            schoolCount: 1,
            description: 'Coastal depleted zone · Low nutrient concentration & sparse fish (CLOSE)',
        },
    ]
};

// ─── Marine Vegetation Habitat Configurations ──────────────────
// Spatial centers match PFZ-1, PFZ-2, and PFZ-3 identically.
// Plant density strictly reflects the PFZ productivity gradient:
// PFZ-1 (400) > PFZ-2 (180) > PFZ-3 (60)
export const VEGETATION_CONFIG = {
    region1: {
        id: 'PFZ-1',
        name: 'Deep Offshore Upwelling Meadow (PFZ-1: High / Far)',
        center: { x: -580, z: 920 },
        radius: 210,
        density: 400, // 320 seagrass + 80 coral tufts = 400
        grassCount: 320,
        coralCount: 80,
        type: 'deep_giant_kelp',
        plantHeight: 14.0,
        swayStrength: 0.45,
    },
    region2: {
        id: 'PFZ-2',
        name: 'Mid-Depth Coral Reef Atoll (PFZ-2: Moderate / Medium)',
        center: { x: 480, z: 340 },
        radius: 175,
        density: 180, // 90 purple coral + 90 blue coral = 180
        purpleCount: 90,
        blueCount: 90,
        type: 'mid_coral_reef',
        plantHeight: 7.5,
        swayStrength: 0.45,
    },
    region3: {
        id: 'PFZ-3',
        name: 'Coastal Inshore Meadow (PFZ-3: Low / Close)',
        center: { x: -160, z: -200 },
        radius: 155,
        density: 60, // 60 sparse kelp stalks with open seabed
        kelpCount: 60,
        type: 'shallow_grass_coral',
        plantHeight: 4.5,
        swayStrength: 0.35,
    },
};

// ─── Fish Population & Schooling Configuration ─────────────────
// Population strictly reflects the PFZ productivity gradient:
// PFZ-1 (~240 fish in 3 schools) > PFZ-2 (~100 fish in 2 schools) > PFZ-3 (~30 fish in 1 school)
export const FISH_CONFIG = {
    speciesCount: 3,
    totalFish: 370,
    schools: [
        // ── PFZ-1 (HIGH PRODUCTIVITY: 240 fish, 3 schools at -580, 920) ──
        {
            id: 'pfz1_reef_chromis',
            pfzId: 'PFZ-1',
            count: 100,
            species: 'striped_reef',
            center: { x: -580, y: -50, z: 920 },
            radius: 95,
            speed: 4.8,
            depthRange: [-68, -25],
        },
        {
            id: 'pfz1_blue_pelagic',
            pfzId: 'PFZ-1',
            count: 80,
            species: 'blue_pelagic',
            center: { x: -560, y: -55, z: 940 },
            radius: 105,
            speed: 6.6,
            depthRange: [-72, -30],
        },
        {
            id: 'pfz1_crimson_snapper',
            pfzId: 'PFZ-1',
            count: 60,
            species: 'crimson_snapper',
            center: { x: -605, y: -58, z: 895 },
            radius: 85,
            speed: 4.2,
            depthRange: [-75, -35],
        },

        // ── PFZ-2 (MODERATE PRODUCTIVITY: 100 fish, 2 schools at 480, 340) ──
        {
            id: 'pfz2_blue_pelagic',
            pfzId: 'PFZ-2',
            count: 60,
            species: 'blue_pelagic',
            center: { x: 480, y: -26, z: 340 },
            radius: 95,
            speed: 6.0,
            depthRange: [-38, -12],
        },
        {
            id: 'pfz2_crimson_snapper',
            pfzId: 'PFZ-2',
            count: 40,
            species: 'crimson_snapper',
            center: { x: 450, y: -36, z: 365 },
            radius: 70,
            speed: 4.0,
            depthRange: [-44, -20],
        },

        // ── PFZ-3 (LOW PRODUCTIVITY: 30 fish, 1 school at -160, -200) ──
        {
            id: 'pfz3_deep_pelagic',
            pfzId: 'PFZ-3',
            count: 30,
            species: 'striped_reef',
            center: { x: -160, y: -12, z: -200 },
            radius: 80,
            speed: 4.5,
            depthRange: [-18, -4],
        },
    ],
    wanderRadius: 220,
    repulsionDistCamera: 14.0,
    repulsionDistShark: 42.0,
};

export const SHARK_CONFIG = {
    length: 13.5,
    speed: 8.5,
    sprintSpeed: 16.0,
    turnRate: 0.7,
    cruisingDepth: -36.0,
    surfaceDepth: -0.7,
    breachProbability: 0.0009,
    patrolPoints: [
        { x: -380, y: -45, z: 750 },
        { x: -120, y: -18, z: 180 },
        { x: 260, y: -0.8, z: 120 }, // surfaces near main vessel area
        { x: 580, y: -50, z: 550 },
        { x: 180, y: -72, z: 1150 },
        { x: -520, y: -82, z: 1050 },
    ],
};

// ═══════════════════════════════════════════════════════════════
// WEATHER-AWARE AUTONOMOUS NAVIGATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════
export const NAV_CONFIG = {
    coastalStart: { x: 0.0, y: 0.0, z: -500.0, heading: 0.0 },
    cruisingSpeed: 38.0,      // ~22 knots cruise speed
    maxSpeed: 50.0,
    acceleration: 15.0,
    deceleration: 14.0,
    turnRate: 1.15,
    arrivalRadius: 105.0,
    slowDownRadius: 260.0,
    corridors: {
        'PFZ-1': [
            { x: 0.0, z: -360.0 },
            { x: -260.0, z: 180.0 },
            { x: -580.0, z: 920.0 }
        ],
        'PFZ-2': [
            { x: 0.0, z: -360.0 },
            { x: 220.0, z: -40.0 },
            { x: 480.0, z: 340.0 }
        ]
    }
};

// ═══════════════════════════════════════════════════════════════
// EMERGENCY MARITIME COMMUNICATION & STORM SAFE-RETURN CONFIG
// ═══════════════════════════════════════════════════════════════
export const EMERGENCY_COMM_CONFIG = {
    towerPosition: { x: 75.0, y: 4.8, z: -620.0 },
    towerAntennaTip: { x: 75.0, y: 68.0, z: -620.0 },
    coastalSafePort: { x: 0.0, y: 0.0, z: -500.0 },
    returnCruisingSpeed: 32.0,  // ~19 knots safe return speed
    returnAcceleration: 16.0,
    returnDeceleration: 15.0,
    coastalArrivalRadius: 55.0,
    coastalSlowDownRadius: 180.0,
    beamColorHex: 0xff2222,
    beamGlowColorHex: 0xff5555,
};
