// ═══════════════════════════════════════════════════════════════
// SCHOOLING FISH & MARINE LIFE SYSTEM
// Multi-Species 3D Fish + Boids Flocking + Body Undulation + Predator/Camera Avoidance
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { FISH_CONFIG } from './config.js';
import { getSeabedHeight } from './seabed.js';

// ─── Fish Swimming Vertex & Shading Shaders ────────────────────
const fishVertexShader = /* glsl */ `
attribute float aSwimSpeed;
attribute float aPhase;
attribute vec3 aSpeciesColor;

uniform float uTime;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;

void main() {
    vUv = uv;
    vColor = aSpeciesColor;
    vNormal = normalize(mat3(instanceMatrix) * normalMatrix * normal);

    // Dynamic swimming undulation:
    // Tail (negative Z) undulates with sine wave; head (positive Z) stays stable
    float tailFactor = smoothstep(0.1, -1.2, position.z);
    float tailWave = sin(uTime * aSwimSpeed * 5.2 + aPhase);
    vec3 displaced = position;
    displaced.x += tailWave * tailFactor * 0.28;

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

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);

    // Subtle stripe pattern along fish body (UV based)
    float stripe = sin(vUv.x * 32.0);
    stripe = smoothstep(0.2, 0.8, stripe);

    // Counter-shading: lighter belly (N.y < 0) vs darker back (N.y > 0)
    float counterShade = clamp(N.y * 0.35 + 0.65, 0.4, 1.0);

    vec3 fishColor = vColor * counterShade;
    // Dark accent stripes (Reference 1 style)
    fishColor = mix(fishColor, fishColor * 0.45, stripe * 0.35);

    // Specular marine scales shine
    vec3 V = normalize(cameraPosition - vWorldPosition);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.4;

    // Ambient + diffuse lighting
    float NdotL = max(dot(N, L), 0.0);
    vec3 ambient = vec3(0.12, 0.28, 0.38) * mix(1.0, 0.25, uNightFactor);
    vec3 diffuse = uSunColor * NdotL * 0.8 * (1.0 - uNightFactor * 0.85);

    vec3 finalColor = fishColor * (ambient + diffuse) + vec3(spec);

    // Distance underwater fog attenuation
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * uFogDensity);
    finalColor = mix(finalColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ─── 3D Recognizable Fish Geometry Builder ─────────────────────
// Models an organic fish with tapered snout, hydrodynamic body, dorsal fin,
// pectoral fins, ventral fins, and forked caudal (tail) fin.
function create3DFishGeometry(bodyLength = 1.6, bodyHeight = 0.7, bodyWidth = 0.32) {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Body Rings along Z axis (from snout at +Z to tail peduncle at -Z)
    // Z: 0.8 (snout) -> 0.4 (head) -> 0.0 (chest) -> -0.4 (belly) -> -0.8 (peduncle)
    const ringZ = [0.85, 0.65, 0.35, 0.0, -0.4, -0.75, -1.0];
    const ringScaleX = [0.05, 0.65, 1.0, 0.95, 0.75, 0.4, 0.12];
    const ringScaleY = [0.05, 0.70, 1.0, 0.90, 0.65, 0.35, 0.15];

    const radialSegments = 10;
    const ringOffsets = [];

    let vertIndex = 0;
    for (let r = 0; r < ringZ.length; r++) {
        ringOffsets.push(vertIndex);
        const z = ringZ[r] * (bodyLength * 0.5);
        const rx = ringScaleX[r] * (bodyWidth * 0.5);
        const ry = ringScaleY[r] * (bodyHeight * 0.5);

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

    // Connect body rings with quad faces
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

    // ── Dorsal Fin (Top) ──
    const dBase = vertIndex;
    positions.push(0, bodyHeight * 0.45, 0.2);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0);
    vertIndex++;

    positions.push(0, bodyHeight * 1.05, -0.15); // tip
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);
    vertIndex++;

    positions.push(0, bodyHeight * 0.35, -0.55);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0);
    vertIndex++;

    indices.push(dBase, dBase + 1, dBase + 2);
    indices.push(dBase + 2, dBase + 1, dBase); // two-sided

    // ── Forked Caudal (Tail) Fin ──
    const tBase = vertIndex;
    const tailZ = -bodyLength * 0.5 - 0.1;
    // Tail root
    positions.push(0, 0, tailZ);
    normals.push(0, 0, -1);
    uvs.push(0, 0.5);
    vertIndex++;

    // Upper lobe
    positions.push(0, bodyHeight * 0.95, tailZ - 0.55);
    normals.push(0, 0, -1);
    uvs.push(1, 1);
    vertIndex++;

    // Center notch
    positions.push(0, 0, tailZ - 0.35);
    normals.push(0, 0, -1);
    uvs.push(0.5, 0.5);
    vertIndex++;

    // Lower lobe
    positions.push(0, -bodyHeight * 0.85, tailZ - 0.55);
    normals.push(0, 0, -1);
    uvs.push(1, 0);
    vertIndex++;

    indices.push(tBase, tBase + 1, tBase + 2);
    indices.push(tBase + 2, tBase + 1, tBase);
    indices.push(tBase, tBase + 2, tBase + 3);
    indices.push(tBase + 3, tBase + 2, tBase);

    // ── Pectoral Fins (Left & Right) ──
    // Left pectoral
    const pLeft = vertIndex;
    positions.push(bodyWidth * 0.45, -0.05, 0.25);
    normals.push(1, 0, 0);
    uvs.push(0, 0);
    vertIndex++;

    positions.push(bodyWidth * 1.5, -0.25, -0.15);
    normals.push(1, 0, 0);
    uvs.push(1, 0.5);
    vertIndex++;

    positions.push(bodyWidth * 0.4, -0.22, 0.05);
    normals.push(1, 0, 0);
    uvs.push(0, 1);
    vertIndex++;

    indices.push(pLeft, pLeft + 1, pLeft + 2);
    indices.push(pLeft + 2, pLeft + 1, pLeft);

    // Right pectoral
    const pRight = vertIndex;
    positions.push(-bodyWidth * 0.45, -0.05, 0.25);
    normals.push(-1, 0, 0);
    uvs.push(0, 0);
    vertIndex++;

    positions.push(-bodyWidth * 1.5, -0.25, -0.15);
    normals.push(-1, 0, 0);
    uvs.push(1, 0.5);
    vertIndex++;

    positions.push(-bodyWidth * 0.4, -0.22, 0.05);
    normals.push(-1, 0, 0);
    uvs.push(0, 1);
    vertIndex++;

    indices.push(pRight, pRight + 1, pRight + 2);
    indices.push(pRight + 2, pRight + 1, pRight);

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

// ─── Fish Species Palette ──────────────────────────────────────
const SPECIES_PALETTE = {
    striped_reef: new THREE.Color(0xf57d18),   // vibrant clownfish orange / striped yellow (Ref 1)
    blue_pelagic: new THREE.Color(0x0cd2e8),   // brilliant electric turquoise/azure
    crimson_snapper: new THREE.Color(0xe02856),// deep coral crimson / rose
};

// ─── Main Fish System Factory ──────────────────────────────────
export function createFishSystem() {
    const group = new THREE.Group();
    const schools = FISH_CONFIG.schools;
    const totalFish = schools.reduce((sum, s) => sum + s.count, 0);

    const fishGeo = create3DFishGeometry(1.5, 0.7, 0.32);

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

    // Custom attributes for per-instance speed, phase, and species color
    const swimSpeedArray = new Float32Array(totalFish);
    const phaseArray = new Float32Array(totalFish);
    const colorArray = new Float32Array(totalFish * 3);

    // Boids Fish Agent Data Structure
    const fishData = [];

    let globalIdx = 0;
    schools.forEach((school, sIdx) => {
        const speciesColor = SPECIES_PALETTE[school.species] || SPECIES_PALETTE.blue_pelagic;

        for (let i = 0; i < school.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * school.radius;
            const px = school.center.x + Math.cos(angle) * dist;
            const pz = school.center.z + Math.sin(angle) * dist;
            const py = THREE.MathUtils.lerp(school.depthRange[0], school.depthRange[1], Math.random());

            const swimSpeed = school.speed * (0.8 + Math.random() * 0.4);
            const phase = Math.random() * Math.PI * 2;

            swimSpeedArray[globalIdx] = swimSpeed;
            phaseArray[globalIdx] = phase;
            colorArray[globalIdx * 3 + 0] = speciesColor.r;
            colorArray[globalIdx * 3 + 1] = speciesColor.g;
            colorArray[globalIdx * 3 + 2] = speciesColor.b;

            // Velocity vector
            const vAngle = Math.random() * Math.PI * 2;
            const vel = new THREE.Vector3(
                Math.cos(vAngle) * swimSpeed,
                (Math.random() - 0.5) * 0.6,
                Math.sin(vAngle) * swimSpeed
            );

            fishData.push({
                index: globalIdx,
                schoolIndex: sIdx,
                pos: new THREE.Vector3(px, py, pz),
                vel: vel,
                targetSpeed: swimSpeed,
                species: school.species,
                scale: school.species === 'striped_reef' ? 0.75 : school.species === 'crimson_snapper' ? 1.15 : 0.95,
            });

            globalIdx++;
        }
    });

    fishGeo.setAttribute('aSwimSpeed', new THREE.InstancedBufferAttribute(swimSpeedArray, 1));
    fishGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phaseArray, 1));
    fishGeo.setAttribute('aSpeciesColor', new THREE.InstancedBufferAttribute(colorArray, 3));

    group.add(instancedMesh);

    // Reusable math objects (avoid runtime GC)
    const dummy = new THREE.Object3D();
    const forward = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
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
                const wanderAngle = elapsed * 0.18 + sIdx * 1.6;
                const wanderDist = school.radius * 0.65;
                const wx = school.center.x + Math.cos(wanderAngle) * wanderDist;
                const wz = school.center.z + Math.sin(wanderAngle * 0.8) * wanderDist;
                const wy = THREE.MathUtils.lerp(school.depthRange[0], school.depthRange[1], (Math.sin(elapsed * 0.25 + sIdx) + 1) * 0.5);
                schoolCentroids[sIdx].set(wx, wy, wz);
            });

            // 2. Simulate Boids Flocking & Obstacle/Predator Repulsion
            for (let i = 0; i < fishData.length; i++) {
                const fish = fishData[i];
                const school = schools[fish.schoolIndex];
                const centroid = schoolCentroids[fish.schoolIndex];

                steer.set(0, 0, 0);

                // A. Cohesion: pull toward school roaming centroid
                steer.x += (centroid.x - fish.pos.x) * 0.35;
                steer.y += (centroid.y - fish.pos.y) * 0.5;
                steer.z += (centroid.z - fish.pos.z) * 0.35;

                // B. Random organic micro-wander impulse
                steer.x += Math.sin(elapsed * 1.5 + fish.index * 0.7) * 0.8;
                steer.y += Math.cos(elapsed * 1.2 + fish.index * 0.5) * 0.35;
                steer.z += Math.cos(elapsed * 1.6 + fish.index * 0.9) * 0.8;

                // C. Seabed and Surface boundary clamping
                const seabedY = getSeabedHeight(fish.pos.x, fish.pos.z);
                const minSafeY = seabedY + 2.5;
                const maxSafeY = -1.5; // stay below surface
                if (fish.pos.y < minSafeY) {
                    steer.y += (minSafeY - fish.pos.y) * 4.0;
                } else if (fish.pos.y > maxSafeY) {
                    steer.y += (maxSafeY - fish.pos.y) * 4.0;
                }

                // D. Camera Avoidance (fish part smoothly when camera gets close)
                const camDist = fish.pos.distanceTo(cameraPos);
                if (camDist < FISH_CONFIG.repulsionDistCamera) {
                    const repel = (FISH_CONFIG.repulsionDistCamera - camDist) / FISH_CONFIG.repulsionDistCamera;
                    steer.x += (fish.pos.x - cameraPos.x) * repel * 6.5;
                    steer.y += (fish.pos.y - cameraPos.y) * repel * 3.5;
                    steer.z += (fish.pos.z - cameraPos.z) * repel * 6.5;
                }

                // E. Shark Predator Avoidance (fish scatter rapidly from shark)
                if (sharkPos) {
                    const sharkDist = fish.pos.distanceTo(sharkPos);
                    if (sharkDist < FISH_CONFIG.repulsionDistShark) {
                        const sharkRepel = Math.pow((FISH_CONFIG.repulsionDistShark - sharkDist) / FISH_CONFIG.repulsionDistShark, 1.8);
                        steer.x += (fish.pos.x - sharkPos.x) * sharkRepel * 18.0;
                        steer.y += (fish.pos.y - sharkPos.y) * sharkRepel * 8.0;
                        steer.z += (fish.pos.z - sharkPos.z) * sharkRepel * 18.0;
                    }
                }

                // Apply steering to velocity
                fish.vel.addScaledVector(steer, dt);

                // Speed regulation
                const curSpeed = fish.vel.length();
                if (curSpeed > 0.001) {
                    const speed = THREE.MathUtils.clamp(curSpeed, fish.targetSpeed * 0.6, fish.targetSpeed * 1.8);
                    fish.vel.normalize().multiplyScalar(speed);
                }

                // Step position
                fish.pos.addScaledVector(fish.vel, dt);

                // Update transformation matrix for instanced rendering
                dummy.position.copy(fish.pos);

                // Point forward in velocity direction
                forward.copy(fish.vel).normalize();
                dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);

                // Subtle bank into turns
                const bank = -steer.x * 0.12;
                dummy.rotateZ(bank);

                dummy.scale.setScalar(fish.scale);
                dummy.updateMatrix();

                instancedMesh.setMatrixAt(fish.index, dummy.matrix);
            }

            instancedMesh.instanceMatrix.needsUpdate = true;
        }
    };
}
