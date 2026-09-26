// ═══════════════════════════════════════════════════════════════
// SEABED & CONTINENTAL SHELF SYSTEM
// Procedural Terrain + Animated Caustics Shader + Rocks + Sunken Chest
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { OCEAN_CONFIG } from './config.js';

// ─── Procedural Seabed Elevation Function ──────────────────────
// Returns smooth terrain height at any world (x, z) coordinate.
// Slopes from shallow coastal waters to the abyssal plain.
export function getSeabedHeight(x, z) {
    // 1. Continental shelf base slope along Z axis (Coast at Z ≈ -620)
    let baseDepth;
    if (z < -620) {
        // Coastal shallows
        const t = Math.min(1.0, (-620 - z) / 400);
        baseDepth = -6.0 - t * 4.0;
    } else if (z < 350) {
        // Continental slope: drops from -12 to -48
        const t = (z - (-620)) / (350 - (-620));
        // Smooth S-curve transition
        const smoothT = t * t * (3 - 2 * t);
        baseDepth = -10.0 - smoothT * 38.0;
    } else {
        // Deep ocean to abyssal plain
        const t = Math.min(1.0, (z - 350) / 1200);
        const smoothT = t * t * (3 - 2 * t);
        baseDepth = -48.0 - smoothT * 42.0;
    }

    // 2. Rolling underwater dunes and geological ridges
    const wave1 = Math.sin(x * 0.007 + z * 0.005) * 4.5;
    const wave2 = Math.cos(x * 0.015 - z * 0.012) * 2.5;
    const wave3 = Math.sin(x * 0.035 + z * 0.028) * 1.0;
    const ripples = wave1 + wave2 + wave3;

    // 3. Elevated underwater habitat plateaus/mounds for the 3 vegetation zones
    // Habitat 1 Mound: around (-160, -200)
    const dist1 = Math.hypot(x - (-160), z - (-200));
    const mound1 = Math.max(0, 1.0 - dist1 / 180) * 4.0;

    // Habitat 2 Atoll Shelf: around (480, 340)
    const dist2 = Math.hypot(x - 480, z - 340);
    const mound2 = Math.max(0, 1.0 - dist2 / 210) * 6.5;

    // Habitat 3 Ridge: around (-580, 920)
    const dist3 = Math.hypot(x - (-580), z - 920);
    const mound3 = Math.max(0, 1.0 - dist3 / 240) * 8.0;

    return baseDepth + ripples + mound1 + mound2 + mound3;
}

// ─── Procedural Caustics Seabed Shaders ─────────────────────────
const seabedVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const seabedFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uCausticIntensity;
uniform float uNightFactor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;

// Procedural Voronoi-style wave caustics
float getCausticPattern(vec2 uv, float time) {
    vec2 p1 = uv * 0.45 + vec2(time * 0.06, time * 0.04);
    vec2 p2 = uv * 0.75 - vec2(time * 0.045, time * 0.07);

    float c1 = sin(p1.x * 12.0 + sin(p1.y * 10.0 + time * 1.5)) * 0.5 + 0.5;
    float c2 = cos(p2.x * 15.0 + cos(p2.y * 13.0 - time * 1.2)) * 0.5 + 0.5;
    float c3 = sin((p1.x + p2.y) * 8.0 + time * 0.8) * 0.5 + 0.5;

    float caustic = pow(c1 * c2 * 1.4 + c3 * 0.4, 2.5);
    return caustic;
}

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);

    // Depth in meters (Y = 0 is surface)
    float depth = -vWorldPosition.y;

    // ── Seabed base coloration by depth zone ──
    // Shallow sand: warm golden-sand / turquoise sheen
    vec3 shallowSand = vec3(0.72, 0.68, 0.52);
    // Mid depth: greenish-blue marine sediment
    vec3 midSediment = vec3(0.18, 0.38, 0.42);
    // Deep abyss: dark slate navy basalt
    vec3 abyssSediment = vec3(0.04, 0.12, 0.22);

    float midFactor = smoothstep(10.0, 50.0, depth);
    float abyssFactor = smoothstep(45.0, 95.0, depth);

    vec3 baseColor = mix(shallowSand, midSediment, midFactor);
    baseColor = mix(baseColor, abyssSediment, abyssFactor);

    // Subtle sand ripple texture variation
    float sandNoise = sin(vWorldPosition.x * 0.25 + sin(vWorldPosition.z * 0.2)) * 0.04;
    baseColor += vec3(sandNoise);

    // ── Diffuse lighting ──
    float NdotL = max(dot(N, L), 0.0);
    // Ambient light underwater
    vec3 ambient = mix(vec3(0.12, 0.30, 0.38), vec3(0.02, 0.06, 0.12), abyssFactor);
    // Night mood reduction
    ambient *= mix(1.0, 0.25, uNightFactor);

    vec3 diffuse = uSunColor * NdotL * (1.0 - uNightFactor * 0.85);

    // ── Dynamic caustics on seabed ──
    // Caustics are strongest in shallow water and attenuate with depth
    float causticDepthAtten = clamp(1.0 - depth / 55.0, 0.0, 1.0);
    causticDepthAtten = pow(causticDepthAtten, 1.3);

    float causticVal = getCausticPattern(vWorldPosition.xz, uTime);
    float causticLight = causticVal * causticDepthAtten * uCausticIntensity * (1.0 - uNightFactor * 0.95);

    vec3 finalColor = baseColor * (ambient + diffuse * 0.8) + vec3(0.85, 0.95, 1.0) * causticLight;

    // ── Distance / Depth fog ──
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * uFogDensity);
    finalColor = mix(finalColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ─── Create Underwater Boulders & Rocks ─────────────────────────
function createSeabedRocks() {
    const rockGroup = new THREE.Group();

    // Shared rock geometries with irregular facets
    const rockGeos = [
        new THREE.DodecahedronGeometry(1.0, 1),
        new THREE.IcosahedronGeometry(1.0, 1),
        new THREE.DodecahedronGeometry(1.0, 0),
    ];

    // Slightly deform geometries for natural boulder look
    rockGeos.forEach(geo => {
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const disp = 1.0 + (Math.sin(vx * 3.0 + vy * 4.0) + Math.cos(vz * 3.5)) * 0.14;
            pos.setXYZ(i, vx * disp, vy * disp * 0.85, vz * disp);
        }
        geo.computeVertexNormals();
    });

    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x324d4e,      // dark mossy marine rock / algae tint
        roughness: 0.85,
        metalness: 0.08,
        flatShading: true,
    });

    // Rock cluster centers (around habitats and along underwater ridges)
    const clusterCenters = [
        // Habitat 1 shallow boulders
        { cx: -160, cz: -200, count: 18, radius: 90, minScale: 3.5, maxScale: 8.5 },
        // Habitat 2 reef rock arches & pillars
        { cx: 480, cz: 340, count: 24, radius: 120, minScale: 5.0, maxScale: 14.0 },
        // Habitat 3 giant kelp granite mounts
        { cx: -580, cz: 920, count: 28, radius: 150, minScale: 8.0, maxScale: 22.0 },
        // Deep ocean scattered formations
        { cx: 80, cz: 600, count: 14, radius: 250, minScale: 6.0, maxScale: 16.0 },
        { cx: -320, cz: 420, count: 16, radius: 200, minScale: 5.0, maxScale: 12.0 },
    ];

    clusterCenters.forEach(cluster => {
        for (let i = 0; i < cluster.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * cluster.radius;
            const rx = cluster.cx + Math.cos(angle) * dist;
            const rz = cluster.cz + Math.sin(angle) * dist;
            const ry = getSeabedHeight(rx, rz);

            const geo = rockGeos[Math.floor(Math.random() * rockGeos.length)];
            const mesh = new THREE.Mesh(geo, rockMat);

            const scale = cluster.minScale + Math.random() * (cluster.maxScale - cluster.minScale);
            mesh.scale.set(
                scale * (0.8 + Math.random() * 0.4),
                scale * (0.6 + Math.random() * 0.5),
                scale * (0.8 + Math.random() * 0.4)
            );

            mesh.position.set(rx, ry + mesh.scale.y * 0.35, rz);
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI
            );
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            rockGroup.add(mesh);
        }
    });

    return rockGroup;
}

// ─── Sunken Pirate Treasure Chest (Easter Egg from Reference 1) ─
function createTreasureChest() {
    const chestGroup = new THREE.Group();

    // Dark aged timber material
    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x3d2516,
        roughness: 0.8,
        metalness: 0.05,
    });
    // Weathered brass brackets & lock
    const brassMat = new THREE.MeshStandardMaterial({
        color: 0x967832,
        roughness: 0.45,
        metalness: 0.65,
    });
    // Golden coins inside
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xf5b823,
        roughness: 0.25,
        metalness: 0.85,
    });

    // Lower chest basin
    const baseGeo = new THREE.BoxGeometry(4.5, 2.6, 3.2);
    const baseMesh = new THREE.Mesh(baseGeo, woodMat);
    baseMesh.position.y = 1.3;
    chestGroup.add(baseMesh);

    // Brass corner trim & rivets
    const trimGeo = new THREE.BoxGeometry(4.65, 0.25, 3.35);
    const trimBottom = new THREE.Mesh(trimGeo, brassMat);
    trimBottom.position.y = 0.2;
    chestGroup.add(trimBottom);
    const trimTop = new THREE.Mesh(trimGeo, brassMat);
    trimTop.position.y = 2.4;
    chestGroup.add(trimTop);

    // Lock hasp
    const lockGeo = new THREE.BoxGeometry(0.5, 0.7, 0.25);
    const lockMesh = new THREE.Mesh(lockGeo, brassMat);
    lockMesh.position.set(0, 2.1, 1.7);
    chestGroup.add(lockMesh);

    // Arched open lid hinged at back
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 2.6, -1.6); // hinge point at rear
    lidGroup.rotation.x = -Math.PI * 0.38; // open lid angle

    const lidGeo = new THREE.CylinderGeometry(1.6, 1.6, 4.5, 16, 1, false, 0, Math.PI);
    lidGeo.rotateZ(Math.PI / 2);
    const lidMesh = new THREE.Mesh(lidGeo, woodMat);
    lidMesh.position.set(0, 0, 1.6);
    lidGroup.add(lidMesh);

    const lidTrimGeo = new THREE.CylinderGeometry(1.66, 1.66, 4.65, 16, 1, false, 0, Math.PI);
    lidTrimGeo.rotateZ(Math.PI / 2);
    const lidTrimMesh = new THREE.Mesh(lidTrimGeo, brassMat);
    lidTrimMesh.position.set(0, 0, 1.6);
    lidGroup.add(lidTrimMesh);

    chestGroup.add(lidGroup);

    // Gold treasure inside
    const goldPileGeo = new THREE.SphereGeometry(1.8, 8, 6);
    goldPileGeo.scale(1.1, 0.45, 0.8);
    const goldPile = new THREE.Mesh(goldPileGeo, goldMat);
    goldPile.position.set(0, 2.2, 0);
    chestGroup.add(goldPile);

    // Position chest in Habitat 1 shallow lagoon
    const cx = -140;
    const cz = -185;
    const cy = getSeabedHeight(cx, cz);
    chestGroup.position.set(cx, cy, cz);
    chestGroup.rotation.y = Math.PI * 0.25;
    chestGroup.scale.setScalar(1.2);

    return chestGroup;
}

// ─── Main Seabed System Factory ────────────────────────────────
export function createSeabedSystem() {
    const group = new THREE.Group();

    // 1. Continental Shelf Plane Geometry (6400 x 6400)
    const seabedGeo = new THREE.PlaneGeometry(6800, 6800, 180, 180);
    seabedGeo.rotateX(-Math.PI / 2);

    // Displace vertices with continental slope & procedural noise
    const pos = seabedGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = getSeabedHeight(x, z);
        pos.setY(i, y);
    }
    seabedGeo.computeVertexNormals();

    const seabedMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uCausticIntensity: { value: 0.75 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: seabedVertexShader,
        fragmentShader: seabedFragmentShader,
    });

    const seabedMesh = new THREE.Mesh(seabedGeo, seabedMaterial);
    group.add(seabedMesh);

    // 2. Add Underwater Boulders & Formations
    const rocks = createSeabedRocks();
    group.add(rocks);

    // 3. Add Sunken Pirate Treasure Chest
    const chest = createTreasureChest();
    group.add(chest);

    return {
        group,
        material: seabedMaterial,
        update(elapsed, fogColor, fogDensity, sunDir, sunColor, nightFactor) {
            seabedMaterial.uniforms.uTime.value = elapsed;
            if (fogColor) seabedMaterial.uniforms.uFogColor.value.copy(fogColor);
            if (fogDensity !== undefined) seabedMaterial.uniforms.uFogDensity.value = fogDensity;
            if (sunDir) seabedMaterial.uniforms.uSunDirection.value.copy(sunDir);
            if (sunColor) seabedMaterial.uniforms.uSunColor.value.copy(sunColor);
            if (nightFactor !== undefined) seabedMaterial.uniforms.uNightFactor.value = nightFactor;
        }
    };
}
