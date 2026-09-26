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

export const VEGETATION_CONFIG = {
    region1: {
        name: 'Coastal Shallow Lagoon Meadow',
        center: { x: -160, z: -200 },
        radius: 140,
        density: 220,
        type: 'shallow_grass_coral',
        plantHeight: 4.0,
        swayStrength: 0.35,
        targetDepth: -16.0,
    },
    region2: {
        name: 'Mid-Depth Coral Reef Atoll',
        center: { x: 480, z: 340 },
        radius: 170,
        density: 260,
        type: 'mid_coral_reef',
        plantHeight: 7.5,
        swayStrength: 0.45,
        targetDepth: -46.0,
    },
    region3: {
        name: 'Deep Giant Kelp Forest',
        center: { x: -580, z: 920 },
        radius: 220,
        density: 300,
        type: 'deep_giant_kelp',
        plantHeight: 16.0,
        swayStrength: 0.55,
        targetDepth: -82.0,
    },
};

export const FISH_CONFIG = {
    speciesCount: 3,
    totalFish: 280,
    schools: [
        // Region 1: Small striped reef fish (Reference 1 inspired)
        { id: 'school_reef_1', count: 80, species: 'striped_reef', center: { x: -160, y: -12, z: -200 }, radius: 70, speed: 4.5, depthRange: [-18, -4] },
        // Region 2: Mixed pelagic schools & reef fish
        { id: 'school_pelagic_1', count: 90, species: 'blue_pelagic', center: { x: 480, y: -26, z: 340 }, radius: 100, speed: 6.8, depthRange: [-38, -10] },
        { id: 'school_snapper_1', count: 45, species: 'crimson_snapper', center: { x: 440, y: -38, z: 380 }, radius: 60, speed: 4.0, depthRange: [-44, -25] },
        // Region 3: Deep kelp schools
        { id: 'school_deep_1', count: 65, species: 'blue_pelagic', center: { x: -580, y: -55, z: 920 }, radius: 120, speed: 5.5, depthRange: [-75, -28] },
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
