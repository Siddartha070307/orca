// ═══════════════════════════════════════════════════════════════
// THREE DISTINCT MARINE VEGETATION REGIONS (CHLOROPHYLL HABITATS)
// Region 1: Shallow Coastal Meadow
// Region 2: Mid-Depth Coral Reef & Seaweed Atoll
// Region 3: Deep Giant Kelp Forest
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { VEGETATION_CONFIG } from './config.js';
import { getSeabedHeight } from './seabed.js';

// ─── Swaying Plant Vertex & Fragment Shaders ───────────────────
const plantVertexShader = /* glsl */ `
uniform float uTime;
uniform float uSwayStrength;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeightNorm;

void main() {
    vUv = uv;
    vNormal = normalize(mat3(instanceMatrix) * normalMatrix * normal);

    // Height normalization: position.y is local model height (0 at root)
    float h = max(0.0, position.y);
    float hNorm = clamp(h / 12.0, 0.0, 1.0);
    vHeightNorm = hNorm;

    // Organic current swaying: roots stay firmly planted, tops undulate
    float sway = pow(hNorm, 1.45) * uSwayStrength;

    // Sample instance world origin
    vec4 instanceOrigin = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float phase = instanceOrigin.x * 0.15 + instanceOrigin.z * 0.12;

    float currentX = sin(uTime * 1.65 + phase) * sway;
    float currentZ = cos(uTime * 1.35 + phase * 0.8) * sway * 0.75;

    vec3 displacedPos = position;
    displacedPos.x += currentX;
    displacedPos.z += currentZ;

    vec4 worldPos = instanceMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const plantFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uBaseColor;
uniform vec3 uTipColor;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNightFactor;

varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vHeightNorm;

void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uSunDirection);

    // Color gradient from root to swaying tip
    vec3 plantColor = mix(uBaseColor, uTipColor, vHeightNorm);

    // Two-sided soft lighting
    float NdotL = abs(dot(N, L));
    vec3 ambient = vec3(0.08, 0.20, 0.28) * mix(1.0, 0.2, uNightFactor);
    vec3 light = ambient + uSunColor * NdotL * 0.75 * (1.0 - uNightFactor * 0.85);

    vec3 finalColor = plantColor * light;

    // Distance underwater fog attenuation
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * uFogDensity);
    finalColor = mix(finalColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ─── Procedural Plant Geometries ───────────────────────────────

// 1. Sea Grass Cluster Geometry (Shallow meadow)
function createGrassClusterGeo(bladeCount = 5, height = 4.0) {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    let vertOffset = 0;
    for (let b = 0; b < bladeCount; b++) {
        const angle = (b / bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const radius = 0.35 + Math.random() * 0.25;
        const bx = Math.cos(angle) * radius;
        const bz = Math.sin(angle) * radius;
        const bHeight = height * (0.8 + Math.random() * 0.4);
        const segments = 4;

        for (let s = 0; s <= segments; s++) {
            const frac = s / segments;
            const y = frac * bHeight;
            // Taper blade width
            const w = (1.0 - frac * 0.75) * 0.35;
            // Slight natural curve outward
            const curve = Math.pow(frac, 1.6) * 0.9;
            const cx = bx + Math.cos(angle) * curve;
            const cz = bz + Math.sin(angle) * curve;

            const perpX = -Math.sin(angle) * w;
            const perpZ = Math.cos(angle) * w;

            // Left vertex
            positions.push(cx - perpX, y, cz - perpZ);
            normals.push(0, 0, 1);
            uvs.push(0, frac);

            // Right vertex
            positions.push(cx + perpX, y, cz + perpZ);
            normals.push(0, 0, 1);
            uvs.push(1, frac);

            if (s < segments) {
                const i0 = vertOffset + s * 2;
                const i1 = vertOffset + s * 2 + 1;
                const i2 = vertOffset + (s + 1) * 2;
                const i3 = vertOffset + (s + 1) * 2 + 1;

                indices.push(i0, i1, i2);
                indices.push(i1, i3, i2);
                // Two-sided
                indices.push(i2, i1, i0);
                indices.push(i2, i3, i1);
            }
        }
        vertOffset += (segments + 1) * 2;
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

// 2. Giant Kelp Stalk Geometry (Deep Kelp Forest)
function createKelpStalkGeo(height = 16.0) {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Central flexible stem
    const stemSegments = 12;
    const stemRadius = 0.22;
    let vertOffset = 0;

    for (let s = 0; s <= stemSegments; s++) {
        const frac = s / stemSegments;
        const y = frac * height;
        positions.push(-stemRadius, y, 0);
        normals.push(0, 0, 1);
        uvs.push(0, frac);

        positions.push(stemRadius, y, 0);
        normals.push(0, 0, 1);
        uvs.push(1, frac);

        if (s < stemSegments) {
            const i0 = vertOffset + s * 2;
            const i1 = i0 + 1;
            const i2 = i0 + 2;
            const i3 = i0 + 3;
            indices.push(i0, i1, i2, i1, i3, i2);
            indices.push(i2, i1, i0, i2, i3, i1);
        }
    }
    vertOffset += (stemSegments + 1) * 2;

    // Staggered wide kelp fronds / blades along stem
    const frondCount = 10;
    for (let f = 0; f < frondCount; f++) {
        const fFrac = 0.2 + (f / frondCount) * 0.75;
        const fy = fFrac * height;
        const side = f % 2 === 0 ? 1 : -1;
        const frondLen = 2.8 + Math.random() * 1.6;
        const frondWidth = 0.75;

        const fBaseIdx = vertOffset;
        // Base of leaf attached to stem
        positions.push(0, fy, 0);
        normals.push(0, 1, 0);
        uvs.push(0, 0);

        // Mid wide section
        positions.push(side * frondLen * 0.5, fy + 0.4, frondWidth);
        normals.push(0, 1, 0);
        uvs.push(0.5, 1);

        positions.push(side * frondLen * 0.5, fy + 0.3, -frondWidth);
        normals.push(0, 1, 0);
        uvs.push(0.5, 0);

        // Tip of leaf
        positions.push(side * frondLen, fy + 0.7, 0);
        normals.push(0, 1, 0);
        uvs.push(1, 0.5);

        indices.push(fBaseIdx, fBaseIdx + 1, fBaseIdx + 2);
        indices.push(fBaseIdx + 1, fBaseIdx + 3, fBaseIdx + 2);
        indices.push(fBaseIdx + 2, fBaseIdx + 1, fBaseIdx);
        indices.push(fBaseIdx + 2, fBaseIdx + 3, fBaseIdx + 1);

        vertOffset += 4;
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

// 3. Branching Coral Antler / Bush Geometry (Reference 1 style)
function createCoralBushGeo(height = 3.5) {
    const geo = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    let vertOffset = 0;
    const branchCount = 7;

    for (let b = 0; b < branchCount; b++) {
        const phi = (b / branchCount) * Math.PI * 2;
        const spread = 0.4 + Math.random() * 0.5;
        const bHeight = height * (0.7 + Math.random() * 0.5);
        const segs = 3;

        for (let s = 0; s <= segs; s++) {
            const frac = s / segs;
            const y = frac * bHeight;
            const r = (1.0 - frac * 0.5) * 0.28;
            const ox = Math.cos(phi) * spread * frac * bHeight * 0.35;
            const oz = Math.sin(phi) * spread * frac * bHeight * 0.35;

            positions.push(ox - r, y, oz);
            normals.push(Math.cos(phi), 0.5, Math.sin(phi));
            uvs.push(0, frac);

            positions.push(ox + r, y, oz);
            normals.push(Math.cos(phi), 0.5, Math.sin(phi));
            uvs.push(1, frac);

            if (s < segs) {
                const i0 = vertOffset + s * 2;
                const i1 = i0 + 1;
                const i2 = i0 + 2;
                const i3 = i0 + 3;
                indices.push(i0, i1, i2, i1, i3, i2);
                indices.push(i2, i1, i0, i2, i3, i1);
            }
        }
        vertOffset += (segs + 1) * 2;
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

// ─── Main Vegetation System Factory ────────────────────────────
export function createVegetationSystem() {
    const group = new THREE.Group();
    const materials = [];

    // ── Region 1: Shallow Coastal Meadow (Bright Green Grass & Orange Coral) ──
    const reg1 = VEGETATION_CONFIG.region1;
    const grassGeo = createGrassClusterGeo(6, reg1.plantHeight);

    const grassMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSwayStrength: { value: reg1.swayStrength },
            uBaseColor: { value: new THREE.Color(0x0a4820) }, // deep rich green root
            uTipColor: { value: new THREE.Color(0x28d655) },  // bright emerald luminous green
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: plantVertexShader,
        fragmentShader: plantFragmentShader,
        side: THREE.DoubleSide,
    });
    materials.push(grassMat);

    const grassInstanced = new THREE.InstancedMesh(grassGeo, grassMat, reg1.density);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < reg1.density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * reg1.radius;
        const x = reg1.center.x + Math.cos(angle) * dist;
        const z = reg1.center.z + Math.sin(angle) * dist;
        const y = getSeabedHeight(x, z);

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.5;
        dummy.scale.set(scale, scale * (0.85 + Math.random() * 0.4), scale);
        dummy.updateMatrix();

        grassInstanced.setMatrixAt(i, dummy.matrix);
    }
    grassInstanced.instanceMatrix.needsUpdate = true;
    group.add(grassInstanced);

    // Warm Orange Coral Tufts in Region 1
    const orangeCoralGeo = createCoralBushGeo(2.5);
    const orangeCoralMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSwayStrength: { value: 0.15 },
            uBaseColor: { value: new THREE.Color(0x752008) },
            uTipColor: { value: new THREE.Color(0xf57224) }, // bright coral orange
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: plantVertexShader,
        fragmentShader: plantFragmentShader,
        side: THREE.DoubleSide,
    });
    materials.push(orangeCoralMat);

    const coral1Count = 50;
    const coral1Instanced = new THREE.InstancedMesh(orangeCoralGeo, orangeCoralMat, coral1Count);
    for (let i = 0; i < coral1Count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * (reg1.radius * 0.8);
        const x = reg1.center.x + Math.cos(angle) * dist;
        const z = reg1.center.z + Math.sin(angle) * dist;
        const y = getSeabedHeight(x, z);

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.7 + Math.random() * 0.5;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        coral1Instanced.setMatrixAt(i, dummy.matrix);
    }
    coral1Instanced.instanceMatrix.needsUpdate = true;
    group.add(coral1Instanced);

    // ── Region 2: Mid-Depth Coral Reef Atoll (Purple, Magenta & Azure Corals) ──
    const reg2 = VEGETATION_CONFIG.region2;

    // Magenta/Purple Coral Antlers
    const purpleCoralGeo = createCoralBushGeo(reg2.plantHeight * 0.65);
    const purpleCoralMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSwayStrength: { value: 0.22 },
            uBaseColor: { value: new THREE.Color(0x320845) },
            uTipColor: { value: new THREE.Color(0xb51cb8) }, // vibrant purple-magenta (Ref 1)
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: plantVertexShader,
        fragmentShader: plantFragmentShader,
        side: THREE.DoubleSide,
    });
    materials.push(purpleCoralMat);

    const purpleCount = Math.floor(reg2.density * 0.5);
    const purpleInstanced = new THREE.InstancedMesh(purpleCoralGeo, purpleCoralMat, purpleCount);
    for (let i = 0; i < purpleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * reg2.radius;
        const x = reg2.center.x + Math.cos(angle) * dist;
        const z = reg2.center.z + Math.sin(angle) * dist;
        const y = getSeabedHeight(x, z);

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.85 + Math.random() * 0.6;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        purpleInstanced.setMatrixAt(i, dummy.matrix);
    }
    purpleInstanced.instanceMatrix.needsUpdate = true;
    group.add(purpleInstanced);

    // Azure Blue Branching Fans
    const blueCoralGeo = createCoralBushGeo(reg2.plantHeight * 0.7);
    const blueCoralMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSwayStrength: { value: 0.25 },
            uBaseColor: { value: new THREE.Color(0x041848) },
            uTipColor: { value: new THREE.Color(0x0d72e8) }, // electric cobalt blue (Ref 1)
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: plantVertexShader,
        fragmentShader: plantFragmentShader,
        side: THREE.DoubleSide,
    });
    materials.push(blueCoralMat);

    const blueCount = Math.floor(reg2.density * 0.5);
    const blueInstanced = new THREE.InstancedMesh(blueCoralGeo, blueCoralMat, blueCount);
    for (let i = 0; i < blueCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * reg2.radius;
        const x = reg2.center.x + Math.cos(angle) * dist;
        const z = reg2.center.z + Math.sin(angle) * dist;
        const y = getSeabedHeight(x, z);

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.8 + Math.random() * 0.55;
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        blueInstanced.setMatrixAt(i, dummy.matrix);
    }
    blueInstanced.instanceMatrix.needsUpdate = true;
    group.add(blueInstanced);

    // ── Region 3: Deep Giant Kelp Forest (Towering Amber/Golden Kelp) ──
    const reg3 = VEGETATION_CONFIG.region3;
    const kelpGeo = createKelpStalkGeo(reg3.plantHeight);

    const kelpMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSwayStrength: { value: reg3.swayStrength },
            uBaseColor: { value: new THREE.Color(0x1a2608) }, // dark olive base
            uTipColor: { value: new THREE.Color(0x769b22) },  // golden amber-green translucent fronds
            uSunDirection: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
            uSunColor: { value: new THREE.Color(0xfff8ed) },
            uFogColor: { value: new THREE.Color(0x054868) },
            uFogDensity: { value: 0.0085 },
            uNightFactor: { value: 0.0 },
        },
        vertexShader: plantVertexShader,
        fragmentShader: plantFragmentShader,
        side: THREE.DoubleSide,
    });
    materials.push(kelpMat);

    const kelpInstanced = new THREE.InstancedMesh(kelpGeo, kelpMat, reg3.density);
    for (let i = 0; i < reg3.density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * reg3.radius;
        const x = reg3.center.x + Math.cos(angle) * dist;
        const z = reg3.center.z + Math.sin(angle) * dist;
        const y = getSeabedHeight(x, z);

        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        const scale = 0.85 + Math.random() * 0.65;
        dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.4), scale);
        dummy.updateMatrix();

        kelpInstanced.setMatrixAt(i, dummy.matrix);
    }
    kelpInstanced.instanceMatrix.needsUpdate = true;
    group.add(kelpInstanced);

    return {
        group,
        materials,
        update(elapsed, fogColor, fogDensity, sunDir, sunColor, nightFactor) {
            materials.forEach(mat => {
                mat.uniforms.uTime.value = elapsed;
                if (fogColor) mat.uniforms.uFogColor.value.copy(fogColor);
                if (fogDensity !== undefined) mat.uniforms.uFogDensity.value = fogDensity;
                if (sunDir) mat.uniforms.uSunDirection.value.copy(sunDir);
                if (sunColor) mat.uniforms.uSunColor.value.copy(sunColor);
                if (nightFactor !== undefined) mat.uniforms.uNightFactor.value = nightFactor;
            });
        }
    };
}
