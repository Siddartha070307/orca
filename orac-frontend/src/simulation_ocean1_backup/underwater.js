// ═══════════════════════════════════════════════════════════════
// UNDERWATER ATMOSPHERE, LIGHT RAYS & MARINE SNOW SYSTEM
// Continuous Submersion Engine + Depth Zones + Volumetric Sun Rays + Plankton
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { UNDERWATER_CONFIG } from './config.js';

// ─── Volumetric Sunlight Shafts Shaders ────────────────────────
const sunRayVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const sunRayFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uRayColor;
uniform float uIntensity;

varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
    // Height fade: brightest at surface (vUv.y = 0.0), fades out at depth (vUv.y = 1.0)
    float depthFade = clamp(1.0 - vUv.y, 0.0, 1.0);
    depthFade = pow(depthFade, 1.4);

    // Lateral edge soft falloff
    float edgeFade = sin(vUv.x * 3.141592);

    // Subtle wave shimmer along ray shaft
    float shimmer = sin(vWorldPosition.y * 0.15 - uTime * 1.8 + vWorldPosition.x * 0.05) * 0.25 + 0.75;

    float alpha = depthFade * edgeFade * shimmer * uIntensity;
    gl_FragColor = vec4(uRayColor, alpha);
}
`;

// ─── Procedural Plankton Particle Texture ──────────────────────
function createPlanktonTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const radGrad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    radGrad.addColorStop(0.0, 'rgba(230, 248, 255, 0.95)');
    radGrad.addColorStop(0.35, 'rgba(160, 225, 245, 0.55)');
    radGrad.addColorStop(0.7, 'rgba(100, 190, 230, 0.18)');
    radGrad.addColorStop(1.0, 'rgba(80, 170, 220, 0.0)');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
}

// ─── Create Volumetric Sun Rays ────────────────────────────────
function createSunRays() {
    const rayGroup = new THREE.Group();
    const rayCount = UNDERWATER_CONFIG.lightRayCount;

    const rayGeo = new THREE.PlaneGeometry(16, 85, 4, 12);
    rayGeo.rotateX(Math.PI / 2);
    rayGeo.translate(0, -42.5, 0); // origin at surface Y = 0

    const rayMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uRayColor: { value: new THREE.Color(0xa8e6ff) },
            uIntensity: { value: 0.22 },
        },
        vertexShader: sunRayVertexShader,
        fragmentShader: sunRayFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });

    const rays = [];
    for (let i = 0; i < rayCount; i++) {
        const mesh = new THREE.Mesh(rayGeo, rayMaterial);
        // Distribute shafts across active ocean volume
        const angle = (i / rayCount) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 30 + Math.random() * 220;
        mesh.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

        // Angled naturally downward matching sunlight
        mesh.rotation.x = 0.15 + (Math.random() - 0.5) * 0.12;
        mesh.rotation.y = angle + Math.PI * 0.5;
        mesh.rotation.z = (Math.random() - 0.5) * 0.15;

        const scale = 0.8 + Math.random() * 0.7;
        mesh.scale.set(scale * (1.2 + Math.random() * 0.8), 1.0, scale);

        rayGroup.add(mesh);
        rays.push(mesh);
    }

    return { group: rayGroup, material: rayMaterial, rays };
}

// ─── Create Marine Snow / Plankton Particle Volume ─────────────
function createMarineSnow() {
    const particleCount = UNDERWATER_CONFIG.particleCount;
    const boxSize = UNDERWATER_CONFIG.particleBoxSize;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const driftSeeds = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * boxSize;
        positions[i * 3 + 1] = -Math.random() * 95.0;
        positions[i * 3 + 2] = (Math.random() - 0.5) * boxSize;

        driftSeeds[i * 3 + 0] = Math.random() * Math.PI * 2;
        driftSeeds[i * 3 + 1] = 0.2 + Math.random() * 0.4; // downward sink speed
        driftSeeds[i * 3 + 2] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color: 0xcbeef8,
        size: 1.2,
        map: createPlanktonTexture(),
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);

    return { points, geo, mat, positions, driftSeeds, boxSize };
}

// ─── Main Underwater System Factory ────────────────────────────
export function createUnderwaterSystem(scene) {
    const group = new THREE.Group();

    const sunRays = createSunRays();
    group.add(sunRays.group);

    const marineSnow = createMarineSnow();
    group.add(marineSnow.points);

    // Underwater depth zones color palette
    const ZONES = {
        surface: new THREE.Color(0x0a6886), // bright tropical cyan/teal
        shallow: new THREE.Color(0x064c6b), // vibrant turquoise-azure
        medium:  new THREE.Color(0x032e4d), // deep sapphire blue
        deep:    new THREE.Color(0x011a33), // dark oceanic navy
        abyss:   new THREE.Color(0x000c1e), // mysterious deep navy-black
    };

    // Submersion state
    let submersionFactor = 0.0;
    const currentUnderwaterColor = new THREE.Color(0x064c6b);
    let currentUnderwaterFogDensity = 0.008;

    return {
        group,
        sunRays,
        marineSnow,
        submersionFactor,
        currentUnderwaterColor,
        currentUnderwaterFogDensity,

        update(elapsed, delta, camera, getWaveHeightFn, weatherState, lightningFlashIntensity) {
            const dt = Math.min(delta, 0.1);
            const camPos = camera.position;

            // 1. Calculate continuous submersion factor
            const surfaceWaveY = getWaveHeightFn ? getWaveHeightFn(camPos.x, camPos.z, elapsed) : 0.0;
            const depth = surfaceWaveY - camPos.y;

            // Smooth continuous 0 (above surface) -> 1 (underwater) transition
            const targetSubmersion = THREE.MathUtils.clamp((depth + 0.6) / 1.6, 0.0, 1.0);
            submersionFactor = THREE.MathUtils.damp(submersionFactor, targetSubmersion, 8.0, dt);
            this.submersionFactor = submersionFactor;

            // 2. Depth-Based Underwater Atmosphere Interpolation
            const dClamped = Math.max(0.0, depth);
            let targetColor = ZONES.surface;
            let targetFogDensity = 0.007;

            if (dClamped < 6.0) {
                const t = dClamped / 6.0;
                targetColor = ZONES.surface.clone().lerp(ZONES.shallow, t);
                targetFogDensity = THREE.MathUtils.lerp(0.006, 0.008, t);
            } else if (dClamped < 25.0) {
                const t = (dClamped - 6.0) / 19.0;
                targetColor = ZONES.shallow.clone().lerp(ZONES.medium, t);
                targetFogDensity = THREE.MathUtils.lerp(0.008, 0.011, t);
            } else if (dClamped < 65.0) {
                const t = (dClamped - 25.0) / 40.0;
                targetColor = ZONES.medium.clone().lerp(ZONES.deep, t);
                targetFogDensity = THREE.MathUtils.lerp(0.011, 0.0145, t);
            } else {
                const t = Math.min(1.0, (dClamped - 65.0) / 50.0);
                targetColor = ZONES.deep.clone().lerp(ZONES.abyss, t);
                targetFogDensity = THREE.MathUtils.lerp(0.0145, 0.0185, t);
            }

            // Weather adaptations
            const nightFactor = weatherState ? (weatherState.nightFactor || 0.0) : 0.0;
            const isStorm = weatherState ? weatherState.isStorm : false;

            if (nightFactor > 0.0) {
                targetColor.lerp(new THREE.Color(0x010814), nightFactor * 0.85);
            }
            if (isStorm) {
                targetColor.lerp(new THREE.Color(0x021622), 0.65);
                targetFogDensity *= 1.35;
            }

            // Lightning Flash seen from underwater (Requirement 54, 55)
            if (lightningFlashIntensity > 0.0) {
                // Surface lighting flash subtly illuminates the upper water column
                const flashDepthAtten = clamp(1.0 - dClamped / 35.0, 0.0, 1.0);
                const flashColor = new THREE.Color(0xa6e6ff).multiplyScalar(lightningFlashIntensity * flashDepthAtten * 0.6);
                targetColor.add(flashColor);
            }

            currentUnderwaterColor.lerp(targetColor, 5.0 * dt);
            currentUnderwaterFogDensity = THREE.MathUtils.damp(currentUnderwaterFogDensity, targetFogDensity, 4.0, dt);

            this.currentUnderwaterColor = currentUnderwaterColor;
            this.currentUnderwaterFogDensity = currentUnderwaterFogDensity;

            // 3. Volumetric Sun Rays Update
            sunRays.material.uniforms.uTime.value = elapsed;
            let targetRayIntensity = 0.24 * (1.0 - nightFactor * 0.95);
            if (isStorm) targetRayIntensity *= 0.2;
            // Rays are visible both from above looking in and from underwater
            sunRays.material.uniforms.uIntensity.value = THREE.MathUtils.damp(
                sunRays.material.uniforms.uIntensity.value,
                targetRayIntensity,
                3.0,
                dt
            );

            // Follow camera horizontally so shafts stay around view area
            sunRays.group.position.x = Math.floor(camPos.x / 100) * 100;
            sunRays.group.position.z = Math.floor(camPos.z / 100) * 100;

            // 4. Marine Snow Plankton Drifting Update
            const ms = marineSnow;
            const targetSnowOpacity = submersionFactor * (0.65 + Math.min(0.3, dClamped * 0.005));
            ms.mat.opacity = THREE.MathUtils.damp(ms.mat.opacity, targetSnowOpacity, 4.0, dt);

            if (ms.mat.opacity > 0.01) {
                const pos = ms.positions;
                const seeds = ms.driftSeeds;
                const halfBox = ms.boxSize * 0.5;

                for (let i = 0; i < pos.length / 3; i++) {
                    const idx = i * 3;
                    // Slow current drift
                    pos[idx + 0] += Math.sin(elapsed * 0.4 + seeds[idx + 0]) * 0.08 * dt * 60.0;
                    pos[idx + 1] -= seeds[idx + 1] * 0.12 * dt * 60.0; // gentle downward settling
                    pos[idx + 2] += Math.cos(elapsed * 0.35 + seeds[idx + 2]) * 0.06 * dt * 60.0;

                    // Wrap around camera
                    if (pos[idx + 0] < camPos.x - halfBox) pos[idx + 0] += ms.boxSize;
                    if (pos[idx + 0] > camPos.x + halfBox) pos[idx + 0] -= ms.boxSize;
                    if (pos[idx + 2] < camPos.z - halfBox) pos[idx + 2] += ms.boxSize;
                    if (pos[idx + 2] > camPos.z + halfBox) pos[idx + 2] -= ms.boxSize;

                    if (pos[idx + 1] < -110.0) pos[idx + 1] = -0.5;
                    if (pos[idx + 1] > 0.5) pos[idx + 1] = -95.0;
                }
                ms.geo.attributes.position.needsUpdate = true;
            }
        }
    };
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
