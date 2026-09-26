// ═══════════════════════════════════════════════════════════════
// SCHOOLING FISH & MARINE LIFE SYSTEM
// Multi-Species 3D Fish + Boids Flocking + Traveling Wave Undulation +
// Anatomical Realism + Soft PFZ Boundary Steering + Predator Avoidance
// SIH Problem Statement 26176 — ORCA Marine Ecosystem Digital Twin
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { FISH_CONFIG } from './config.js';
import { getSeabedHeight } from './seabed.js';

// ─── Realistic Fish Swimming Vertex & PBR-Inspired Shaders ────
const fishVertexShader = /* glsl */ `
attribute float aSwimSpeed;
attribute float aPhase;
attribute vec3 aSpeciesColor;
attribute float aSpeciesId; // 0: striped_reef, 1: blue_pelagic, 2: crimson_snapper

uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vSpeciesId;

void main() {
    vUv = uv;
    vColor = aSpeciesColor;
    vSpeciesId = aSpeciesId;
    vNormal = normalize(mat3(instanceMatrix) * normalMatrix * normal);

    // Dynamic natural swimming undulation:
    // Snout and head (+Z) remain stable;
    // Midbody and tail (-Z) flex with an organic traveling sinusoidal wave
    float tailFlex = smoothstep(0.3, -1.1, position.z);
    float travelingPhase = uTime * aSwimSpeed * 5.4 + aPhase - position.z * 1.85;
    float tailWave = sin(travelingPhase) * tailFlex * 0.28;

    vec3 displaced = position;
    displaced.x += tailWave;

    vec4 worldPos = instanceMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fishFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNightFactor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
varying float vSpeciesId;

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 H = normalize(L + V);

    // ── 1. Anatomical Eye Shading ──
    // Marked in geometry with UV > 0.90
    if (vUv.x > 0.90 && vUv.y > 0.90) {
        vec3 cornea = vec3(0.02, 0.02, 0.03); // jet black glossy eye
        float eyeGlint = pow(max(dot(N, H), 0.0), 64.0) * 1.6;
        vec3 finalEye = cornea + vec3(eyeGlint);
        float dist = length(vWorldPosition - cameraPosition);
        float fogFactor = 1.0 - exp(-dist * uFogDensity);
        gl_FragColor = vec4(mix(finalEye, uFogColor, fogFactor), 1.0);
        return;
    }

    // ── 2. Counter-Shading (Dorsal dark vs Ventral pale belly) ──
    float counterShade = clamp(N.y * 0.38 + 0.62, 0.35, 1.0);
    vec3 baseColor = vColor * counterShade;

    // ── 3. Species-Specific Skin Patterns ──
    if (vSpeciesId < 0.5) {
        // Striped Reef Chromis: vertical clownfish/damselfish accent bands
        float stripe = sin(vUv.x * 36.0);
        stripe = smoothstep(0.25, 0.75, stripe);
        baseColor = mix(baseColor, baseColor * 0.32, stripe * 0.45);
    } else if (vSpeciesId < 1.5) {
        // Blue Pelagic Trevally: metallic iridescent sheen with lateral line
        float latLine = smoothstep(0.04, 0.0, abs(vUv.y - 0.5));
        baseColor = mix(baseColor, vec3(0.85, 0.95, 1.0), latLine * 0.35);
    } else {
        // Crimson Snapper: subtle golden-rose scale flecks
        float scaleNoise = sin(vUv.x * 52.0) * sin(vUv.y * 42.0);
        baseColor += vec3(0.08, 0.03, 0.02) * scaleNoise;
    }

    // ── 4. Marine Specular Scale Reflection ──
    float specPower = (vSpeciesId > 0.5 && vSpeciesId < 1.5) ? 48.0 : 28.0; // Pelagics shinier
    float specIntensity = (vSpeciesId > 0.5 && vSpeciesId < 1.5) ? 0.65 : 0.35;
    float spec = pow(max(dot(N, H), 0.0), specPower) * specIntensity;

    // ── 5. Ambient + Diffuse Lighting ──
    float NdotL = max(dot(N, L), 0.0);
    vec3 ambient = vec3(0.14, 0.30, 0.42) * mix(1.0, 0.22, uNightFactor);
    vec3 diffuse = uSunColor * NdotL * 0.85 * (1.0 - uNightFactor * 0.85);

    vec3 finalColor = baseColor * (ambient + diffuse) + vec3(spec);

    // ── 6. Underwater Depth Fog Attenuation ──
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * uFogDensity);
    finalColor = mix(finalColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ─── 3D Anatomical Fish Geometry Builder ────────────────────────
// Builds a realistic fish model featuring:
// - Hydrodynamic fuselage body rings (snout -> head -> gills -> trunk -> peduncle)
// - 3D Eye nodes with glossy specular cornea
// - Dorsal fin (profile tailored per species)
// - Deeply forked caudal tail fin (scissor lobes)
// - Paired pectoral fins (left & right)
// - Paired pelvic/ventral fins (stabilizers on belly)
// - Anal fin (ventral peduncle)
function create3DAnatomicalFishGeometry(speciesType = 'striped_reef') {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Species dimensional proportions
    let bodyLen = 1.45;
    let bodyH = 0.72;
    let bodyW = 0.30;
    let dorsalH = 0.95;
    let tailSpread = 0.90;

    if (speciesType === 'striped_reef') {
        bodyLen = 1.35;
        bodyH = 0.82;
        bodyW = 0.32;
        dorsalH = 1.15;
        tailSpread = 0.85;
    } else if (speciesType === 'blue_pelagic') {
        bodyLen = 1.95;
        bodyH = 0.54;
        bodyW = 0.28;
        dorsalH = 0.82;
        tailSpread = 1.15;
    } else if (speciesType === 'crimson_snapper') {
        bodyLen = 1.65;
        bodyH = 0.85;
        bodyW = 0.36;
        dorsalH = 1.05;
        tailSpread = 0.95;
    }

    // ── Fuselage Body Rings ──
    const ringZ = [0.85, 0.65, 0.35, 0.0, -0.4, -0.75, -1.0];
    const ringScaleX = [0.06, 0.68, 1.0, 0.95, 0.75, 0.40, 0.12];
    const ringScaleY = [0.06, 0.72, 1.0, 0.90, 0.65, 0.35, 0.15];

    const radialSegments = 10;
    const ringOffsets = [];
    let vertIndex = 0;

    for (let r = 0; r < ringZ.length; r++) {
        ringOffsets.push(vertIndex);
        const z = ringZ[r] * (bodyLen * 0.5);
        const rx = ringScaleX[r] * (bodyW * 0.5);
        const ry = ringScaleY[r] * (bodyH * 0.5);

        for (let i = 0; i < radialSegments; i++) {
            const theta = (i / radialSegments) * Math.PI * 2;
            const x = Math.sin(theta) * rx;
            const y = Math.cos(theta) * ry;

            positions.push(x, y, z);
            normals.push(x, y, 0);
            uvs.push(i / radialSegments, r / (ringZ.length - 1));
            vertIndex++;
        }
    }

    // Connect rings with quad triangles
    for (let r = 0; r < ringZ.length - 1; r++) {
        const o1 = ringOffsets[r];
        const o2 = ringOffsets[r + 1];
        for (let i = 0; i < radialSegments; i++) {
            const nextI = (i + 1) % radialSegments;
            const a = o1 + i;
            const b = o1 + nextI;
            const c = o2 + i;
            const d = o2 + nextI;

            indices.push(a, b, c);
            indices.push(b, d, c);
        }
    }

    // ── 3D Eye Nodes (Left & Right Head) ──
    const eyeZ = 0.55 * (bodyLen * 0.5);
    const eyeY = 0.18 * bodyH;
    const eyeX = 0.72 * (bodyW * 0.5);
    const eyeRad = 0.075 * bodyH;

    // Left Eye
    const eL = vertIndex;
    positions.push(eyeX + 0.02, eyeY + eyeRad, eyeZ);
    normals.push(1, 0.5, 0.2);
    uvs.push(0.95, 0.95);
    vertIndex++;
    positions.push(eyeX + 0.04, eyeY, eyeZ - eyeRad);
    normals.push(1, 0, -0.2);
    uvs.push(0.95, 0.95);
    vertIndex++;
    positions.push(eyeX + 0.02, eyeY - eyeRad, eyeZ);
    normals.push(1, -0.5, 0.2);
    uvs.push(0.95, 0.95);
    vertIndex++;
    positions.push(eyeX + 0.04, eyeY, eyeZ + eyeRad);
    normals.push(1, 0, 0.5);
    uvs.push(0.95, 0.95);
    vertIndex++;
    indices.push(eL, eL + 1, eL + 2, eL, eL + 2, eL + 3);

    // Right Eye
    const eR = vertIndex;
    positions.push(-eyeX - 0.02, eyeY + eyeRad, eyeZ);
    normals.push(-1, 0.5, 0.2);
    uvs.push(0.95, 0.95);
    vertIndex++;
    positions.push(-eyeX - 0.04, eyeY, eyeZ + eyeRad);
    normals.push(-1, 0, 0.5);
    uvs.push(0.95, 0.95);
    vertIndex++;
    positions.push(-eyeX - 0.02, eyeY - eyeRad, eyeZ);
    normals.push(-1, -0.5, 0.2);
    uvs.push(0.95, 0.95);
    vertIndex++;
    positions.push(-eyeX - 0.04, eyeY, eyeZ - eyeRad);
    normals.push(-1, 0, -0.2);
    uvs.push(0.95, 0.95);
    vertIndex++;
    indices.push(eR, eR + 1, eR + 2, eR, eR + 2, eR + 3);

    // ── Dorsal Fin (Top Spine) ──
    const dBase = vertIndex;
    positions.push(0, bodyH * 0.45, 0.25 * bodyLen);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0);
    vertIndex++;

    positions.push(0, bodyH * dorsalH, -0.15 * bodyLen); // dorsal tip
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);
    vertIndex++;

    positions.push(0, bodyH * 0.38, -0.45 * bodyLen);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0);
    vertIndex++;

    indices.push(dBase, dBase + 1, dBase + 2);
    indices.push(dBase + 2, dBase + 1, dBase); // two-sided

    // ── Forked Caudal (Tail) Fin ──
    const tBase = vertIndex;
    const tailZ = -bodyLen * 0.5 - 0.08;

    positions.push(0, 0, tailZ);
    normals.push(0, 0, -1);
    uvs.push(0, 0.5);
    vertIndex++;

    // Upper lobe
    positions.push(0, bodyH * tailSpread, tailZ - 0.55);
    normals.push(0, 0, -1);
    uvs.push(1, 1);
    vertIndex++;

    // Center fork notch
    positions.push(0, 0, tailZ - 0.32);
    normals.push(0, 0, -1);
    uvs.push(0.5, 0.5);
    vertIndex++;

    // Lower lobe
    positions.push(0, -bodyH * tailSpread * 0.9, tailZ - 0.55);
    normals.push(0, 0, -1);
    uvs.push(1, 0);
    vertIndex++;

    indices.push(tBase, tBase + 1, tBase + 2);
    indices.push(tBase + 2, tBase + 1, tBase);
    indices.push(tBase, tBase + 2, tBase + 3);
    indices.push(tBase + 3, tBase + 2, tBase);

    // ── Paired Pectoral Fins (Left & Right Wings) ──
    // Left Pectoral
    const pLeft = vertIndex;
    positions.push(bodyW * 0.45, -0.05, 0.25 * bodyLen);
    normals.push(1, 0, 0);
    uvs.push(0, 0);
    vertIndex++;
    positions.push(bodyW * 1.55, -0.25, -0.15 * bodyLen);
    normals.push(1, 0, 0);
    uvs.push(1, 0.5);
    vertIndex++;
    positions.push(bodyW * 0.40, -0.22, 0.05 * bodyLen);
    normals.push(1, 0, 0);
    uvs.push(0, 1);
    vertIndex++;
    indices.push(pLeft, pLeft + 1, pLeft + 2, pLeft + 2, pLeft + 1, pLeft);

    // Right Pectoral
    const pRight = vertIndex;
    positions.push(-bodyW * 0.45, -0.05, 0.25 * bodyLen);
    normals.push(-1, 0, 0);
    uvs.push(0, 0);
    vertIndex++;
    positions.push(-bodyW * 1.55, -0.25, -0.15 * bodyLen);
    normals.push(-1, 0, 0);
    uvs.push(1, 0.5);
    vertIndex++;
    positions.push(-bodyW * 0.40, -0.22, 0.05 * bodyLen);
    normals.push(-1, 0, 0);
    uvs.push(0, 1);
    vertIndex++;
    indices.push(pRight, pRight + 1, pRight + 2, pRight + 2, pRight + 1, pRight);

    // ── Paired Pelvic (Ventral) Fins (Belly Stabilizers) ──
    const pvL = vertIndex;
    positions.push(bodyW * 0.22, -bodyH * 0.45, 0.05 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0, 0);
    vertIndex++;
    positions.push(bodyW * 0.55, -bodyH * 0.72, -0.15 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0.5, 1);
    vertIndex++;
    positions.push(bodyW * 0.15, -bodyH * 0.42, -0.12 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0, 1);
    vertIndex++;
    indices.push(pvL, pvL + 1, pvL + 2, pvL + 2, pvL + 1, pvL);

    const pvR = vertIndex;
    positions.push(-bodyW * 0.22, -bodyH * 0.45, 0.05 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0, 0);
    vertIndex++;
    positions.push(-bodyW * 0.55, -bodyH * 0.72, -0.15 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0.5, 1);
    vertIndex++;
    positions.push(-bodyW * 0.15, -bodyH * 0.42, -0.12 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0, 1);
    vertIndex++;
    indices.push(pvR, pvR + 1, pvR + 2, pvR + 2, pvR + 1, pvR);

    // ── Anal Fin (Ventral Rear) ──
    const anBase = vertIndex;
    positions.push(0, -bodyH * 0.35, -0.25 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0);
    vertIndex++;
    positions.push(0, -bodyH * 0.65, -0.42 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0.5, 1);
    vertIndex++;
    positions.push(0, -bodyH * 0.28, -0.52 * bodyLen);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0);
    vertIndex++;
    indices.push(anBase, anBase + 1, anBase + 2, anBase + 2, anBase + 1, anBase);

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

// ─── Species Palette & Identifiers ─────────────────────────────
const SPECIES_CONFIG = {
    striped_reef: {
        id: 0.0,
        color: new THREE.Color(0xf6841e), // bright clownfish orange/yellow
        scale: 0.85,
    },
    blue_pelagic: {
        id: 1.0,
        color: new THREE.Color(0x0bd8ea), // electric turquoise/azure
        scale: 1.05,
    },
    crimson_snapper: {
        id: 2.0,
        color: new THREE.Color(0xe82c5a), // coral crimson / rose
        scale: 1.18,
    },
};

// ─── Main Fish System Factory ──────────────────────────────────
export function createFishSystem() {
    const group = new THREE.Group();
    group.name = 'FishSystem_Root';

    const schools = FISH_CONFIG.schools;
    const totalFish = schools.reduce((sum, s) => sum + s.count, 0);

    // Create shared realistic anatomical geometry & custom PBR-style shader
    const fishGeo = create3DAnatomicalFishGeometry('striped_reef');

    const fishMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: fishVertexShader,
        fragmentShader: fishFragmentShader,
        side: THREE.DoubleSide,
    });

    const instancedMesh = new THREE.InstancedMesh(fishGeo, fishMaterial, totalFish);
    instancedMesh.name = 'Fish_InstancedMesh';

    // Instanced custom vertex attributes
    const swimSpeedArray = new Float32Array(totalFish);
    const phaseArray = new Float32Array(totalFish);
    const colorArray = new Float32Array(totalFish * 3);
    const speciesIdArray = new Float32Array(totalFish);

    // Boids Fish Agent Data Structure
    const fishData = [];

    let globalIdx = 0;
    schools.forEach((school, sIdx) => {
        const specConf = SPECIES_CONFIG[school.species] || SPECIES_CONFIG.blue_pelagic;
        const speciesColor = specConf.color;
        const speciesId = specConf.id;

        for (let i = 0; i < school.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * school.radius;
            const px = school.center.x + Math.cos(angle) * dist;
            const pz = school.center.z + Math.sin(angle) * dist;
            const py = THREE.MathUtils.lerp(school.depthRange[0], school.depthRange[1], Math.random());

            const swimSpeed = school.speed * (0.85 + Math.random() * 0.35);
            const phase = Math.random() * Math.PI * 2;

            swimSpeedArray[globalIdx] = swimSpeed;
            phaseArray[globalIdx] = phase;
            colorArray[globalIdx * 3 + 0] = speciesColor.r;
            colorArray[globalIdx * 3 + 1] = speciesColor.g;
            colorArray[globalIdx * 3 + 2] = speciesColor.b;
            speciesIdArray[globalIdx] = speciesId;

            // Initial forward velocity
            const vAngle = Math.random() * Math.PI * 2;
            const vel = new THREE.Vector3(
                Math.cos(vAngle) * swimSpeed,
                (Math.random() - 0.5) * 0.4,
                Math.sin(vAngle) * swimSpeed
            );

            fishData.push({
                index: globalIdx,
                schoolIndex: sIdx,
                pos: new THREE.Vector3(px, py, pz),
                vel: vel,
                targetSpeed: swimSpeed,
                species: school.species,
                scale: specConf.scale * (0.9 + Math.random() * 0.2),
            });

            globalIdx++;
        }
    });

    fishGeo.setAttribute('aSwimSpeed', new THREE.InstancedBufferAttribute(swimSpeedArray, 1));
    fishGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phaseArray, 1));
    fishGeo.setAttribute('aSpeciesColor', new THREE.InstancedBufferAttribute(colorArray, 3));
    fishGeo.setAttribute('aSpeciesId', new THREE.InstancedBufferAttribute(speciesIdArray, 1));

    group.add(instancedMesh);

    // Reusable math objects to prevent garbage collection spikes
    const dummy = new THREE.Object3D();
    const forward = new THREE.Vector3();
    const steer = new THREE.Vector3();
    const schoolCentroids = schools.map(() => new THREE.Vector3());

    return {
        group,
        material: fishMaterial,
        update(elapsed, delta, cameraPos, sharkPos, fogColor, fogDensity, sunDir, sunColor, nightFactor) {
            fishMaterial.uniforms.uTime.value = elapsed;
            if (fogColor) fishMaterial.uniforms.uFogColor.value.copy(fogColor);
            if (fogDensity !== undefined) fishMaterial.uniforms.uFogDensity.value = fogDensity;
            if (sunDir) fishMaterial.uniforms.uSunDirection.value.copy(sunDir);
            if (sunColor) fishMaterial.uniforms.uSunColor.value.copy(sunColor);
            if (nightFactor !== undefined) fishMaterial.uniforms.uNightFactor.value = nightFactor;

            const dt = Math.min(delta, 0.1);

            // 1. Update School Roaming Centroids with smooth harmonic paths
            schools.forEach((school, sIdx) => {
                const wanderAngle = elapsed * 0.16 + sIdx * 1.5;
                const wanderDist = school.radius * 0.58;
                const wx = school.center.x + Math.cos(wanderAngle) * wanderDist;
                const wz = school.center.z + Math.sin(wanderAngle * 0.85) * wanderDist;
                const wy = THREE.MathUtils.lerp(school.depthRange[0], school.depthRange[1], (Math.sin(elapsed * 0.22 + sIdx) + 1) * 0.5);
                schoolCentroids[sIdx].set(wx, wy, wz);
            });

            // 2. Simulate Boids Flocking, Soft PFZ Boundary Steering & Avoidance
            for (let i = 0; i < fishData.length; i++) {
                const fish = fishData[i];
                const school = schools[fish.schoolIndex];
                const centroid = schoolCentroids[fish.schoolIndex];

                steer.set(0, 0, 0);

                // A. Cohesion: pull gently toward school roaming centroid
                steer.x += (centroid.x - fish.pos.x) * 0.36;
                steer.y += (centroid.y - fish.pos.y) * 0.52;
                steer.z += (centroid.z - fish.pos.z) * 0.36;

                // B. Soft PFZ Boundary Steering:
                // When approaching boundary of designated PFZ habitat, smoothly steer back toward center
                const distFromCenter = Math.hypot(fish.pos.x - school.center.x, fish.pos.z - school.center.z);
                if (distFromCenter > school.radius * 0.72) {
                    const softFactor = (distFromCenter - school.radius * 0.72) / (school.radius * 0.28);
                    steer.x += (school.center.x - fish.pos.x) * softFactor * 0.85;
                    steer.z += (school.center.z - fish.pos.z) * softFactor * 0.85;
                }

                // C. Organic Micro-Wandering Impulse (prevents rigid schooling lines)
                steer.x += Math.sin(elapsed * 1.6 + fish.index * 0.7) * 0.75;
                steer.y += Math.cos(elapsed * 1.2 + fish.index * 0.5) * 0.32;
                steer.z += Math.cos(elapsed * 1.7 + fish.index * 0.9) * 0.75;

                // D. Procedural Seabed Elevation & Surface Clamping
                // Uses authoritative getSeabedHeight(x, z)
                const seabedY = getSeabedHeight(fish.pos.x, fish.pos.z);
                const minSafeY = seabedY + 2.2;
                const maxSafeY = -1.5; // remain submerged beneath wave troughs
                if (fish.pos.y < minSafeY) {
                    steer.y += (minSafeY - fish.pos.y) * 4.5;
                } else if (fish.pos.y > maxSafeY) {
                    steer.y += (maxSafeY - fish.pos.y) * 4.5;
                }

                // E. Smooth Camera Avoidance (fish part naturally when camera approaches)
                const camDist = fish.pos.distanceTo(cameraPos);
                if (camDist < FISH_CONFIG.repulsionDistCamera) {
                    const repel = (FISH_CONFIG.repulsionDistCamera - camDist) / FISH_CONFIG.repulsionDistCamera;
                    steer.x += (fish.pos.x - cameraPos.x) * repel * 6.5;
                    steer.y += (fish.pos.y - cameraPos.y) * repel * 3.5;
                    steer.z += (fish.pos.z - cameraPos.z) * repel * 6.5;
                }

                // F. Shark Predator Scatter Avoidance
                if (sharkPos) {
                    const sharkDist = fish.pos.distanceTo(sharkPos);
                    if (sharkDist < FISH_CONFIG.repulsionDistShark) {
                        const sharkRepel = Math.pow((FISH_CONFIG.repulsionDistShark - sharkDist) / FISH_CONFIG.repulsionDistShark, 1.8);
                        steer.x += (fish.pos.x - sharkPos.x) * sharkRepel * 18.0;
                        steer.y += (fish.pos.y - sharkPos.y) * sharkRepel * 8.0;
                        steer.z += (fish.pos.z - sharkPos.z) * sharkRepel * 18.0;
                    }
                }

                // Apply steering impulse to velocity
                fish.vel.addScaledVector(steer, dt);

                // Speed regulation with natural cruising bounds
                const curSpeed = fish.vel.length();
                if (curSpeed > 0.001) {
                    const clampedSpeed = THREE.MathUtils.clamp(curSpeed, fish.targetSpeed * 0.65, fish.targetSpeed * 1.75);
                    fish.vel.normalize().multiplyScalar(clampedSpeed);
                }

                // Integrate position
                fish.pos.addScaledVector(fish.vel, dt);

                // Update transformation matrix for instanced rendering
                dummy.position.copy(fish.pos);

                // Orient forward facing swimming direction
                forward.copy(fish.vel).normalize();
                dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);

                // Banking into turns (realistic hydrodynamic tilt)
                const bank = -steer.x * 0.14;
                dummy.rotateZ(bank);

                dummy.scale.setScalar(fish.scale);
                dummy.updateMatrix();

                instancedMesh.setMatrixAt(fish.index, dummy.matrix);
            }

            instancedMesh.instanceMatrix.needsUpdate = true;
        }
    };
}
