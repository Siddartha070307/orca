// ═══════════════════════════════════════════════════════════════
// Ocean Surface Simulation — GLSL Shaders
// Gerstner Waves + PBR Ocean Rendering
// ═══════════════════════════════════════════════════════════════

const oceanVertexShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec4 uWaves[12];

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vHeight;
varying float vFoamFactor;
varying vec2 vUv;

#define PI 3.14159265359
#define GRAVITY 9.81

vec3 gerstnerWave(vec4 wave, vec3 p, inout vec3 tangent, inout vec3 binormal) {
    float steepness = wave.z;
    float wavelength = wave.w;
    float k = 2.0 * PI / wavelength;
    float c = sqrt(GRAVITY / k);
    vec2 d = normalize(wave.xy);
    float f = k * (dot(d, p.xz) - c * uTime);
    float a = steepness / k;

    tangent += vec3(
        -d.x * d.x * steepness * sin(f),
         d.x * steepness * cos(f),
        -d.x * d.y * steepness * sin(f)
    );
    binormal += vec3(
        -d.x * d.y * steepness * sin(f),
         d.y * steepness * cos(f),
        -d.y * d.y * steepness * sin(f)
    );

    return vec3(
        d.x * a * cos(f),
        a * sin(f),
        d.y * a * cos(f)
    );
}

// ── Hash-based value noise for vertex displacement chaos ──
float hash31(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash31(i), hash31(i+vec3(1,0,0)), f.x),
            mix(hash31(i+vec3(0,1,0)), hash31(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash31(i+vec3(0,0,1)), hash31(i+vec3(1,0,1)), f.x),
            mix(hash31(i+vec3(0,1,1)), hash31(i+vec3(1,1,1)), f.x), f.y), f.z);
}

float vfbm(vec3 p) {
    float f = 0.0;
    f += 0.500 * vnoise(p); p *= 2.03;
    f += 0.250 * vnoise(p); p *= 2.01;
    f += 0.125 * vnoise(p); p *= 2.04;
    f += 0.0625 * vnoise(p);
    return f;
}

void main() {
    vUv = uv;
    vec3 pos = position;
    vec3 tangent = vec3(1.0, 0.0, 0.0);
    vec3 binormal = vec3(0.0, 0.0, 1.0);

    vec3 totalDisp = vec3(0.0);
    for (int i = 0; i < 12; i++) {
        totalDisp += gerstnerWave(uWaves[i], position, tangent, binormal);
    }

    // ── Turbulent noise displacement for ocean chaos ──
    // Breaks the periodic uniformity of Gerstner waves
    vec3 nc1 = position * 0.015 + vec3(uTime * 0.35, 0.0, uTime * 0.22);
    float heightNoise = (vfbm(nc1) - 0.5) * 2.0;
    totalDisp.y += heightNoise * 2.2;

    // Horizontal noise for organic undulation
    vec3 nc2 = position * 0.01 + vec3(-uTime * 0.12, 0.0, uTime * 0.08);
    totalDisp.x += (vfbm(nc2) - 0.5) * 0.9;
    totalDisp.z += (vfbm(nc2 + vec3(4.7, 1.3, 6.1)) - 0.5) * 0.9;

    // ── Crest softening: tanh compression rounds off sharp peaks ──
    float softFactor = 3.5;
    totalDisp.y = tanh(totalDisp.y / softFactor) * softFactor;

    pos += totalDisp;

    vec3 normal = normalize(cross(binormal, tangent));

    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vHeight = totalDisp.y;

    // More foam: lower threshold for scattered whitecaps
    float maxH = 2.2;
    vFoamFactor = smoothstep(0.25 * maxH, maxH, totalDisp.y);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const oceanFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform samplerCube uEnvMap;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uBoatPos;
uniform float uBoatHeading;
uniform float uBoatSpeed;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vHeight;
varying float vFoamFactor;
varying vec2 vUv;

// ─── Simplex Noise (Ashima) ───
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x2_ = x_ * ns.x + ns.yyyy;
    vec4 y2_ = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x2_) - abs(y2_);

    vec4 b0 = vec4(x2_.xy, y2_.xy);
    vec4 b1 = vec4(x2_.zw, y2_.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5000 * snoise(p); p *= 2.01;
    f += 0.2500 * snoise(p); p *= 2.02;
    f += 0.1250 * snoise(p); p *= 2.03;
    f += 0.0625 * snoise(p);
    return f;
}

// ─── Fresnel (Schlick) ───
float fresnelSchlick(float cosTheta, float F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    // ═══ LOCAL VESSEL COORDINATES ═══
    vec2 boatDelta = vWorldPosition.xz - uBoatPos.xz;
    float boatDistSq = dot(boatDelta, boatDelta);
    float lx = 0.0;
    float lz = 0.0;
    if (boatDistSq < 16000.0) {
        float cosH = cos(-uBoatHeading);
        float sinH = sin(-uBoatHeading);
        lx = boatDelta.x * cosH - boatDelta.y * sinH;
        lz = boatDelta.x * sinH + boatDelta.y * cosH;
    }

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 N = normalize(vWorldNormal);

    // ═══ DOMAIN-WARPED MULTI-SCALE NORMAL PERTURBATION ═══
    // Creates dense micro-ripples that break the plastic look

    // Domain warp: noise distorts noise coordinates for organic feel
    float wt = uTime * 0.04;
    vec3 warp = vec3(
        snoise(vWorldPosition * 0.02 + vec3(wt, 0.0, wt * 0.7)),
        0.0,
        snoise(vWorldPosition * 0.02 + vec3(0.0, wt, -wt * 0.5))
    ) * 3.0;

    // Layer 1: medium ripples (wind direction)
    float t1 = uTime * 0.22;
    vec3 p1 = vWorldPosition * 0.07 + warp * 0.3 + vec3(t1, 0.0, t1 * 0.65);
    float r1x = fbm(p1);
    float r1z = fbm(p1 + vec3(7.3, 1.1, 3.7));

    // Layer 2: fine ripples (cross-wind)
    float t2 = uTime * 0.16;
    vec3 p2 = vWorldPosition * 0.18 + warp * 0.2 + vec3(-t2 * 0.5, 0.0, t2);
    float r2x = snoise(p2) * 0.55;
    float r2z = snoise(p2 + vec3(5.2, 0.0, 2.8)) * 0.55;

    // Layer 3: micro-ripples (high frequency)
    float t3 = uTime * 0.35;
    vec3 p3 = vWorldPosition * 0.45 + vec3(t3 * 0.4, 0.0, -t3 * 0.25);
    float r3x = snoise(p3) * 0.35;
    float r3z = snoise(p3 + vec3(3.1, 2.7, 0.0)) * 0.35;

    // Layer 4: capillary waves (very high frequency)
    float t4 = uTime * 0.5;
    vec3 p4 = vWorldPosition * 0.9 + vec3(-t4 * 0.2, 0.0, t4 * 0.15);
    float r4x = snoise(p4) * 0.22;
    float r4z = snoise(p4 + vec3(1.9, 0.5, 4.3)) * 0.22;

    // Layer 5: ultra-fine detail (breaks any remaining smoothness)
    float t5 = uTime * 0.7;
    vec3 p5 = vWorldPosition * 1.8 + vec3(t5 * 0.15, 0.0, -t5 * 0.1);
    float r5x = snoise(p5) * 0.15;
    float r5z = snoise(p5 + vec3(6.4, 3.2, 1.1)) * 0.15;

    // Combine all layers with strong perturbation
    float ns = 0.22;
    vec3 noiseOffset = vec3(
        (r1x + r2x + r3x + r4x + r5x) * ns,
        1.0,
        (r1z + r2z + r3z + r4z + r5z) * ns
    );
    vec3 noiseNormal = normalize(noiseOffset);
    N = normalize(mix(N, noiseNormal, 0.45));

    float NdotV = max(dot(N, viewDir), 0.001);

    // ── Fresnel ──
    float fresnel = fresnelSchlick(NdotV, 0.02);

    // ── Sky reflection via cubemap ──
    vec3 reflectDir = reflect(-viewDir, N);
    vec3 envColor = textureCube(uEnvMap, reflectDir).rgb;

    // ── Water body color (deep vs shallow) ──
    float depthFactor = pow(NdotV, 0.35);
    vec3 waterColor = mix(uDeepColor, uShallowColor, depthFactor);

    // ── Subsurface scattering ──
    vec3 sssDir = normalize(uSunDirection + N * 0.6);
    float sssDot = pow(max(dot(viewDir, -sssDir), 0.0), 5.0);
    float sssHeight = clamp(vHeight / 3.0, 0.0, 1.0);
    vec3 sssColor = vec3(0.05, 0.55, 0.35) * sssDot * sssHeight * 0.7;

    // ── Specular sun glints (triple-lobe for scattered micro-glints) ──
    vec3 halfVec = normalize(uSunDirection + viewDir);
    float NdotH = max(dot(N, halfVec), 0.0);
    float specSharp  = pow(NdotH, 512.0) * 4.0;  // tight sun disc
    float specMedium = pow(NdotH, 128.0) * 0.6;  // medium scatter
    float specBroad  = pow(NdotH, 32.0)  * 0.15; // wide ambient glow
    vec3 specular = uSunColor * (specSharp + specMedium + specBroad);

    // ═══ ADVANCED FOAM SYSTEM ═══
    // Multi-layer anisotropic foam matching reference image

    vec2 worldXZ = vWorldPosition.xz;
    // Wind direction for anisotropic stretching
    vec2 windDir = normalize(vec2(0.85, 0.35));
    vec2 windPerp = vec2(-windDir.y, windDir.x);

    // Coordinates stretched along wind direction (elongated foam streaks)
    vec2 stretchA = vec2(dot(worldXZ, windDir) * 0.06, dot(worldXZ, windPerp) * 0.22);
    vec2 stretchB = vec2(dot(worldXZ, windDir) * 0.12, dot(worldXZ, windPerp) * 0.35);

    // Layer 1: Streaky crest foam (elongated along wind)
    float streak = snoise(vec3(stretchA + uTime * vec2(0.035, 0.015), uTime * 0.04));
    streak = smoothstep(0.30, 0.75, streak);

    // Layer 2: Secondary streaks (different scale, cross-angle)
    vec2 crossDir = normalize(vec2(0.5, 0.85));
    vec2 stretchC = vec2(dot(worldXZ, crossDir) * 0.09, dot(worldXZ, vec2(-crossDir.y, crossDir.x)) * 0.28);
    float streak2 = snoise(vec3(stretchC + uTime * vec2(-0.02, 0.03), uTime * 0.06));
    streak2 = smoothstep(0.35, 0.8, streak2) * 0.45;

    // Layer 3: Cellular texture — soft detail, NOT hard mask
    float cell1 = abs(snoise(vec3(worldXZ * 0.5, uTime * 0.08)));
    float cell2 = abs(snoise(vec3(worldXZ * 1.0 + 5.3, uTime * 0.12)));
    float cellular = cell1 * cell2;
    cellular = smoothstep(0.03, 0.20, cellular);  // soft gradient, not binary

    // Layer 4: Fine spray wisps
    float spray = snoise(vec3(stretchB + uTime * vec2(0.05, 0.02), uTime * 0.12));
    spray = smoothstep(0.60, 0.92, spray) * 0.3;

    // Combine: cellular modulates opacity (creates gaps/holes in foam)
    float crest = vFoamFactor;
    float foamBase = crest * streak * cellular * 0.8;
    foamBase += crest * streak2 * cellular * 0.4;
    foamBase += crest * spray * 0.3;

    // ═══ HYDRODYNAMIC BOAT WAKE & BOW SPRAY (SEAMLESS INTEGRATION ON OCEAN SURFACE) ═══
    if (uBoatSpeed > 0.4 && boatDistSq < 16000.0) {
        // Stern Wake: Kelvin divergent wash crests + propeller boil
        float wakeDist = -lz - 15.5; // 0 at stern transom, increases trailing backwards
        if (wakeDist > 0.0 && wakeDist < 110.0) {
            float wakeSpread = 3.4 + pow(wakeDist * 0.01, 0.7) * 20.0;
            float lateralDist = abs(lx);

            float washLine = abs(lateralDist - wakeSpread);
            float washPeak = smoothstep(2.6, 0.0, washLine);

            float boilDist = smoothstep(30.0, 0.0, wakeDist);
            float boilCenter = smoothstep(3.8, 0.0, lateralDist) * boilDist * 0.9;

            float lengthFade = smoothstep(110.0, 6.0, wakeDist);
            float bubbleNoise = snoise(vec3(vWorldPosition.xz * 0.4 - vec2(0.0, uTime * 2.2), uTime * 0.4)) * 0.5 + 0.5;

            float speedRatio = clamp(uBoatSpeed / 26.0, 0.0, 1.0);
            float boatWake = (washPeak * 0.85 + boilCenter) * lengthFade * speedRatio * (0.65 + 0.35 * bubbleNoise);

            foamBase = max(foamBase, boatWake);
        }

        // Bow stem spray foam
        float bowDist = lz - 14.6;
        if (bowDist > 0.0 && bowDist < 6.5) {
            float bowSpread = 0.8 + bowDist * 0.65;
            float bowLateral = abs(lx);
            float bowWave = smoothstep(bowSpread + 1.2, bowSpread - 0.4, bowLateral) * smoothstep(6.5, 0.0, bowDist);
            float speedRatio = clamp(uBoatSpeed / 26.0, 0.0, 1.0);
            foamBase = max(foamBase, bowWave * speedRatio * 0.7);
        }
    }

    float totalFoam = clamp(foamBase, 0.0, 1.0);

    // Foam color — slight variation
    float colorVar = snoise(vec3(worldXZ * 0.6, uTime * 0.04)) * 0.05;
    vec3 foamColor = vec3(0.82 + colorVar, 0.88 + colorVar, 0.93 + colorVar);

    // Gentle blending — translucent wisps, not opaque patches
    float foamEdge = smoothstep(0.0, 0.20, totalFoam);

    // ── Underwater Surface View (Snell's window & sky transmission from below) ──
    bool isUnderwaterView = !gl_FrontFacing || (cameraPosition.y < vWorldPosition.y);
    if (isUnderwaterView) {
        vec3 N_under = -N;
        float cosTheta = max(dot(N_under, viewDir), 0.001);

        // Snell's window / Total Internal Reflection (critical angle ≈ 48.6°)
        float snellWindow = smoothstep(0.48, 0.72, cosTheta);

        // Sky transmission through Snell's window
        vec3 refractDir = refract(-viewDir, -N_under, 1.333 / 1.0);
        if (length(refractDir) < 0.01) refractDir = vec3(0.0, 1.0, 0.0);
        vec3 skyColor = textureCube(uEnvMap, refractDir).rgb * 1.35;

        // Total internal reflection (reflects deep water color)
        vec3 deepReflection = mix(uDeepColor * 0.9, uShallowColor * 0.6, 0.5);

        // Sun direct highlight through surface
        vec3 halfSun = normalize(uSunDirection + viewDir);
        float sunTransmission = pow(max(dot(-N_under, halfSun), 0.0), 128.0) * 2.5;

        vec3 underSurfaceColor = mix(deepReflection, skyColor, snellWindow);
        underSurfaceColor += uSunColor * sunTransmission * snellWindow;

        // Foamy patches from below appear as translucent backlit silhouettes
        underSurfaceColor = mix(underSurfaceColor, vec3(0.92, 0.96, 1.0), foamEdge * 0.35);

        // Distance fog
        float dist = length(vWorldPosition - cameraPosition);
        float fogFactor = 1.0 - exp(-dist * uFogDensity);
        underSurfaceColor = mix(underSurfaceColor, uFogColor, fogFactor);

        gl_FragColor = vec4(underSurfaceColor, 1.0);
        return;
    }

    // ── Combine ──
    vec3 color = mix(waterColor + sssColor, envColor, fresnel);
    color += specular;
    color = mix(color, foamColor, foamEdge * 0.45);

    // ── Distance fog ──
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * uFogDensity);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
}
`;

// ═══════════════════════════════════════════════════════════════
// Ocean Surface Simulation — Main Application
// Three.js + Gerstner Waves + PBR Ocean + Post-Processing
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
window.THREE = THREE;
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { OCEAN_CONFIG, UNDERWATER_CONFIG, VEGETATION_CONFIG, FISH_CONFIG, SHARK_CONFIG, PFZ_CONFIG, NAV_CONFIG, EMERGENCY_COMM_CONFIG } from './config.js';
import { createSeabedSystem, getSeabedHeight } from './seabed.js';
import { createVegetationSystem } from './vegetation.js';
import { createFishSystem } from './fish.js';
import { createSharkSystem } from './shark.js';
import { createUnderwaterSystem } from './underwater.js';
import { createPFZSystem, getPFZAtPosition } from './pfz.js';
import { AutonomousNavigationSystem, getNavigationTarget } from './navigation.js';
import { createEmergencyCommunicationSystem } from './emergencyCommunication.js';
import { createDetailedTrawlerVessel, BOAT_CONFIG } from './boat.js';

// ─── Wave Configuration ───────────────────────────────────────
// 12 Gerstner waves: [dirX, dirZ, steepness(0-1), wavelength]
// Wavelengths ≥ 16 for mesh resolution. Higher steepness on medium
// waves for dramatic height variation. Tanh compression keeps crests soft.
const WAVE_CONFIG = [
    // Primary ocean swells (dominant energy, long period)
    [1.0, 0.15, 0.10, 140.0],
    [0.80, -0.30, 0.09, 95.0],
    [0.55, 0.60, 0.07, 70.0],
    // Cross swells (directional chaos)
    [-0.20, 1.0, 0.11, 48.0],
    [0.70, -0.55, 0.13, 36.0],
    [-0.85, 0.25, 0.12, 28.0],
    // Medium chop (more steepness for dramatic peaks)
    [0.92, 0.40, 0.16, 24.0],
    [0.35, -0.88, 0.14, 20.0],
    [-0.45, 0.80, 0.12, 18.0],
    // Short-medium chop (aggressive but mesh-safe)
    [0.78, 0.20, 0.14, 17.0],
    [0.20, 0.95, 0.11, 16.5],
    [-0.55, -0.70, 0.10, 16.0],
];

// ─── Sun / Sky Configuration (Peaceful Tropical Daylight) ───────
const SUN_CONFIG = {
    elevation: 26,      // bright, warm sunny tropical daylight
    azimuth: 155,       // side-front illumination for sparkling sun glints
    turbidity: 2.2,     // crisp, clean tropical air
    rayleigh: 1.2,      // vibrant azure blue sky
    mieCoefficient: 0.003,
    mieDirectionalG: 0.85,
};

// ─── Color Palette (Clear Tropical Ocean & Sky) ────────────────
const COLORS = {
    deep: new THREE.Color(0.005, 0.045, 0.12),
    shallow: new THREE.Color(0.04, 0.35, 0.44),
    fog: new THREE.Color(0.68, 0.78, 0.88),  // soft atmospheric sky tint, NOT dull gray
    sun: new THREE.Color(1.0, 0.97, 0.90),   // warm radiant sunlight
};

// ═══════════════════════════════════════════════════════════════
// RENDERER SETUP
// ═══════════════════════════════════════════════════════════════
// ─── Canvas & Renderer ─────────────────────────────────────────
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;

// ─── Scene & Camera ────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 1, 25000
);
// Coastal starting camera position: framing boat in front of city looking seaward
camera.position.set(0, 24, -565);
camera.lookAt(0, 4, -485);

// ─── Controls ──────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI * 0.98;
controls.minPolarAngle = 0.02;
controls.minDistance = 6;     // close inspection
controls.maxDistance = 3500;  // grand panoramic view
controls.target.set(0, 3.5, -500);

// ═══════════════════════════════════════════════════════════════
// SKY
// ═══════════════════════════════════════════════════════════════
const sky = new Sky();
sky.scale.setScalar(12000);
scene.add(sky);

const sunPosition = new THREE.Vector3();
const phi = THREE.MathUtils.degToRad(90 - SUN_CONFIG.elevation);
const theta = THREE.MathUtils.degToRad(SUN_CONFIG.azimuth);
sunPosition.setFromSphericalCoords(1, phi, theta);

sky.material.uniforms['turbidity'].value = SUN_CONFIG.turbidity;
sky.material.uniforms['rayleigh'].value = SUN_CONFIG.rayleigh;
sky.material.uniforms['mieCoefficient'].value = SUN_CONFIG.mieCoefficient;
sky.material.uniforms['mieDirectionalG'].value = SUN_CONFIG.mieDirectionalG;
sky.material.uniforms['sunPosition'].value.copy(sunPosition);

// ─── Environment CubeMap from Sky ──────────────────────────────
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(1024, {
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
});
const cubeCamera = new THREE.CubeCamera(1, 12000, cubeRenderTarget);
cubeCamera.update(renderer, scene);

// Set environment reflection and clear atmospheric fog on scene
scene.environment = cubeRenderTarget.texture;
scene.fog = new THREE.FogExp2(COLORS.fog, 0.00022);

// ─── Scene Lighting for PBR Materials (Warm Tropical Sun) ───────
const sunLight = new THREE.DirectionalLight(0xfff8ed, 2.8);
sunLight.position.copy(sunPosition.clone().multiplyScalar(4500));
scene.add(sunLight);

const hemiLight = new THREE.HemisphereLight(0x90ccf4, 0x0e3c4a, 1.4);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
scene.add(ambientLight);

// ═══════════════════════════════════════════════════════════════
// OCEAN MESH
// ═══════════════════════════════════════════════════════════════
const oceanGeometry = new THREE.PlaneGeometry(4000, 4000, 512, 512);
oceanGeometry.rotateX(-Math.PI / 2);

// Build wave uniform array
const wavesUniform = WAVE_CONFIG.map(w =>
    new THREE.Vector4(w[0], w[1], w[2], w[3])
);

const oceanMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0.0 },
        uWaves: { value: wavesUniform },
        uSunDirection: { value: sunPosition.clone().normalize() },
        uSunColor: { value: COLORS.sun },
        uEnvMap: { value: cubeRenderTarget.texture },
        uDeepColor: { value: COLORS.deep },
        uShallowColor: { value: COLORS.shallow },
        uFogColor: { value: COLORS.fog },
        uFogDensity: { value: 0.00022 },
        uBoatPos: { value: new THREE.Vector3(0, 0, -500) },
        uBoatHeading: { value: 0.0 },
        uBoatSpeed: { value: 0.0 },
    },
    vertexShader: oceanVertexShader,
    fragmentShader: oceanFragmentShader,
    side: THREE.DoubleSide,
});

const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
scene.add(ocean);

// ─── Expansive Horizon Ocean Skirt ─────────────────────────────
// Extends water seamlessly out to 36,000 units radius, eliminating visible edges
const horizonGeometry = new THREE.RingGeometry(1950, 36000, 96, 16);
horizonGeometry.rotateX(-Math.PI / 2);
const horizonOcean = new THREE.Mesh(horizonGeometry, oceanMaterial);
scene.add(horizonOcean);

// ═══════════════════════════════════════════════════════════════
// GERSTNER WAVE BUOYANCY SIMULATION (JAVASCRIPT)
// ═══════════════════════════════════════════════════════════════
const GRAVITY = 9.81;
const PI = Math.PI;

function getGerstnerWaveHeight(x, z, time, waveMult = 1.0) {
    let y = 0;
    for (let i = 0; i < WAVE_CONFIG.length; i++) {
        const w = WAVE_CONFIG[i];
        const dirX = w[0];
        const dirZ = w[1];
        const steepness = w[2] * waveMult;
        const wavelength = w[3];
        const k = (2.0 * PI) / wavelength;
        const c = Math.sqrt(GRAVITY / k);
        const len = Math.hypot(dirX, dirZ);
        const dx = dirX / len;
        const dz = dirZ / len;
        const f = k * (dx * x + dz * z - c * time);
        const a = steepness / k;
        y += a * Math.sin(f);
    }
    // Matching shader tanh crest softening:
    const softFactor = 3.5 * Math.sqrt(Math.max(0.5, waveMult));
    return Math.tanh(y / softFactor) * softFactor;
}

// ═══════════════════════════════════════════════════════════════
// PROCEDURAL TEXTURE GENERATORS (CANVAS-BASED)
// ═══════════════════════════════════════════════════════════════

// High-contrast marine vessel markings: "H102"
function createMarkingTexture(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);

    ctx.font = '900 82px "Arial Black", "Segoe UI", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bold dark outline for contrast against turquoise hull
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#05222b';
    ctx.strokeText(text, 256, 64);

    // Clean white marine typography
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// Teak wood deck plank texture
function createDeckTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#9c8167';
    ctx.fillRect(0, 0, 512, 512);

    const plankW = 20;
    for (let x = 0; x < 512; x += plankW) {
        ctx.fillStyle = (x / plankW) % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(x, 0, plankW, 512);
        // Caulk seam lines
        ctx.strokeStyle = 'rgba(40, 24, 14, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 512);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
}

// Commercial fishing net texture (diamond mesh with woven knots)
function createNetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Translucent dark teal/green net backing
    ctx.fillStyle = 'rgba(8, 28, 24, 0.75)';
    ctx.fillRect(0, 0, 256, 256);

    // Diamond net cords
    ctx.strokeStyle = '#28a284';
    ctx.lineWidth = 2.5;

    const spacing = 16;
    for (let i = -256; i < 512; i += spacing) {
        // Diagonal 1
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 256, 256);
        ctx.stroke();

        // Diagonal 2
        ctx.beginPath();
        ctx.moveTo(i, 256);
        ctx.lineTo(i + 256, 0);
        ctx.stroke();
    }

    // Knots at intersections
    ctx.fillStyle = '#54e2bd';
    for (let x = 0; x <= 256; x += spacing / 2) {
        for (let y = 0; y <= 256; y += spacing / 2) {
            if ((x + y) % spacing === 0) {
                ctx.beginPath();
                ctx.arc(x, y, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 6);
    return texture;
}

// Procedural skyscraper facades (Glass, Residential, Resort)
function createBuildingFacadeTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (type === 'glass') {
        // Modern reflective blue glass curtain-wall
        ctx.fillStyle = '#163852';
        ctx.fillRect(0, 0, 256, 512);
        const rows = 32;
        const cols = 8;
        const cellW = 256 / cols;
        const cellH = 512 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const varShade = Math.sin(r * 0.4 + c * 0.7) * 0.15;
                ctx.fillStyle = `rgb(${Math.floor(40 + varShade * 40)}, ${Math.floor(100 + varShade * 50)}, ${Math.floor(155 + varShade * 40)})`;
                ctx.fillRect(c * cellW + 1.5, r * cellH + 1.5, cellW - 3, cellH - 3);
            }
            // Horizontal aluminum spandrel
            ctx.fillStyle = '#d2dce6';
            ctx.fillRect(0, r * cellH, 256, 1.5);
        }
    } else if (type === 'residential') {
        // Modern white residential tower with wraparound balconies
        ctx.fillStyle = '#eef1f5';
        ctx.fillRect(0, 0, 256, 512);
        const floors = 24;
        const floorH = 512 / floors;
        for (let f = 0; f < floors; f++) {
            // Dark recessed glass windows
            ctx.fillStyle = '#1d2730';
            ctx.fillRect(16, f * floorH + 4, 224, floorH - 12);
            // Glass railing band
            ctx.fillStyle = 'rgba(100, 160, 210, 0.65)';
            ctx.fillRect(12, f * floorH + floorH - 9, 232, 6);
            // White balcony slab
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, f * floorH + floorH - 3, 256, 3);
        }
    } else {
        // Coastal resort / hotel facade
        ctx.fillStyle = '#f0ebe1';
        ctx.fillRect(0, 0, 256, 512);
        const rows = 28;
        const cols = 6;
        const cellW = 256 / cols;
        const cellH = 512 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.fillStyle = '#223340';
                ctx.fillRect(c * cellW + 6, r * cellH + 4, cellW - 12, cellH - 8);
                // Window mullion
                ctx.fillStyle = '#e4ded4';
                ctx.fillRect(c * cellW + cellW / 2 - 1, r * cellH + 4, 2, cellH - 8);
            }
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Procedural building night emissive windows texture
function createBuildingNightEmissiveTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Black non-emitting building facade
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 512);

    if (type === 'glass') {
        const rows = 32;
        const cols = 8;
        const cellW = 256 / cols;
        const cellH = 512 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hash = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
                const rnd = hash - Math.floor(hash);
                if (rnd > 0.44) {
                    const warm = rnd > 0.72;
                    ctx.fillStyle = warm ? 'rgb(255, 220, 130)' : 'rgb(200, 230, 255)';
                    ctx.fillRect(c * cellW + 2, r * cellH + 2, cellW - 4, cellH - 4);
                }
            }
        }
    } else if (type === 'residential') {
        const floors = 24;
        const floorH = 512 / floors;
        for (let f = 0; f < floors; f++) {
            for (let apt = 0; apt < 5; apt++) {
                const hash = Math.sin(f * 23.17 + apt * 45.31) * 31415.92;
                const rnd = hash - Math.floor(hash);
                if (rnd > 0.40) {
                    const aptW = 224 / 5;
                    ctx.fillStyle = rnd > 0.75 ? 'rgb(255, 215, 120)' : 'rgb(255, 235, 180)';
                    ctx.fillRect(16 + apt * aptW + 3, f * floorH + 6, aptW - 6, floorH - 16);
                }
            }
        }
    } else {
        // Resort
        const rows = 28;
        const cols = 6;
        const cellW = 256 / cols;
        const cellH = 512 / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hash = Math.sin(r * 9.2 + c * 33.7) * 23421.1;
                const rnd = hash - Math.floor(hash);
                if (rnd > 0.50) {
                    ctx.fillStyle = 'rgb(255, 220, 130)';
                    ctx.fillRect(c * cellW + 8, r * cellH + 6, cellW - 16, cellH - 12);
                }
            }
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Hydrodynamic Boat Wake Texture (Twin wash crests and bubbly foam trail)
function createWakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    // Twin divergent wash crests
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.12, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.26, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.72)'); // center propeller wash boil
    grad.addColorStop(0.74, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.88, 'rgba(255,255,255,0.85)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Fade along length (stern to tail)
    const fadeGrad = ctx.createLinearGradient(0, 0, 0, 512);
    fadeGrad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
    fadeGrad.addColorStop(0.6, 'rgba(255,255,255,0.75)');
    fadeGrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');

    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalCompositeOperation = 'source-over';

    // Fine bubbly foam dots
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 180; i++) {
        const bx = Math.random() * 512;
        const by = Math.random() * 512;
        const br = 1 + Math.random() * 3.5;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Bow spray foam meshes (activated dynamically during forward throttle)
function createBowSprayMesh() {
    const sprayGeo = new THREE.BufferGeometry();
    const pos = [
        // Port spray triangle
        -3.5, 0.2, 19.5,
        -6.5, 0.65, 11.5,
        -8.5, 1.7, 6.0,
        // Starboard spray triangle
        3.5, 0.2, 19.5,
        6.5, 0.65, 11.5,
        8.5, 1.7, 6.0,
    ];
    const uvs = [
        0, 1,  0.5, 0.5,  1, 0,
        0, 1,  0.5, 0.5,  1, 0,
    ];
    const indices = [0, 1, 2, 3, 5, 4];
    sprayGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sprayGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    sprayGeo.setIndex(indices);
    sprayGeo.computeVertexNormals();

    const sprayMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    return new THREE.Mesh(sprayGeo, sprayMat);
}

// ═══════════════════════════════════════════════════════════════
// REALISTIC ATMOSPHERIC CLOUD SYSTEM (DUAL LAYER)
// ═══════════════════════════════════════════════════════════════
function createCloudSystem() {
    const cloudGroup = new THREE.Group();

    // ── Lower Deck: Layered Cumulus & Stratus (Y ≈ 1100) ──
    const canvas1 = document.createElement('canvas');
    canvas1.width = 1024;
    canvas1.height = 1024;
    const ctx1 = canvas1.getContext('2d');
    ctx1.clearRect(0, 0, 1024, 1024);

    for (let c = 0; c < 45; c++) {
        const cx = Math.random() * 1024;
        const cy = Math.random() * 1024;
        const numPuffs = 8 + Math.floor(Math.random() * 10);
        for (let p = 0; p < numPuffs; p++) {
            const px = cx + (Math.random() - 0.5) * 160;
            const py = cy + (Math.random() - 0.5) * 90;
            const pr = 45 + Math.random() * 75;
            const radGrad = ctx1.createRadialGradient(px, py, pr * 0.12, px, py, pr);
            radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
            radGrad.addColorStop(0.38, 'rgba(255, 255, 255, 0.55)');
            radGrad.addColorStop(0.75, 'rgba(245, 250, 255, 0.18)');
            radGrad.addColorStop(1.0, 'rgba(240, 248, 255, 0.0)');
            ctx1.fillStyle = radGrad;
            ctx1.beginPath();
            ctx1.arc(px, py, pr, 0, Math.PI * 2);
            ctx1.fill();
        }
    }

    const lowerTex = new THREE.CanvasTexture(canvas1);
    lowerTex.wrapS = THREE.RepeatWrapping;
    lowerTex.wrapT = THREE.RepeatWrapping;
    lowerTex.repeat.set(4, 4);

    const lowerGeo = new THREE.PlaneGeometry(24000, 24000, 16, 16);
    lowerGeo.rotateX(-Math.PI / 2);

    const lowerMat = new THREE.MeshBasicMaterial({
        map: lowerTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
    });
    const lowerMesh = new THREE.Mesh(lowerGeo, lowerMat);
    lowerMesh.position.y = 1100;
    cloudGroup.add(lowerMesh);

    // ── Upper Layer: Cirrus Veil (Y ≈ 2450) ──
    const canvas2 = document.createElement('canvas');
    canvas2.width = 1024;
    canvas2.height = 1024;
    const ctx2 = canvas2.getContext('2d');
    ctx2.clearRect(0, 0, 1024, 1024);

    for (let s = 0; s < 36; s++) {
        const sx = Math.random() * 1024;
        const sy = Math.random() * 1024;
        const slen = 120 + Math.random() * 220;
        const sangle = 0.35 + (Math.random() - 0.5) * 0.25;
        const sgrad = ctx2.createLinearGradient(
            sx, sy,
            sx + Math.cos(sangle) * slen,
            sy + Math.sin(sangle) * slen
        );
        sgrad.addColorStop(0.0, 'rgba(255,255,255,0.0)');
        sgrad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
        sgrad.addColorStop(0.7, 'rgba(255,255,255,0.22)');
        sgrad.addColorStop(1.0, 'rgba(255,255,255,0.0)');

        ctx2.lineWidth = 15 + Math.random() * 25;
        ctx2.strokeStyle = sgrad;
        ctx2.beginPath();
        ctx2.moveTo(sx, sy);
        ctx2.lineTo(sx + Math.cos(sangle) * slen, sy + Math.sin(sangle) * slen);
        ctx2.stroke();
    }

    const upperTex = new THREE.CanvasTexture(canvas2);
    upperTex.wrapS = THREE.RepeatWrapping;
    upperTex.wrapT = THREE.RepeatWrapping;
    upperTex.repeat.set(3, 3);

    const upperGeo = new THREE.PlaneGeometry(28000, 28000, 16, 16);
    upperGeo.rotateX(-Math.PI / 2);

    const upperMat = new THREE.MeshBasicMaterial({
        map: upperTex,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
    });
    const upperMesh = new THREE.Mesh(upperGeo, upperMat);
    upperMesh.position.y = 2450;
    cloudGroup.add(upperMesh);

    return { group: cloudGroup, lowerMesh, upperMesh, lowerTex, upperTex };
}

function createRaindropTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(16, 0, 16, 64);
    grad.addColorStop(0.0, 'rgba(200, 230, 255, 0.0)');
    grad.addColorStop(0.4, 'rgba(215, 240, 255, 0.4)');
    grad.addColorStop(0.85, 'rgba(235, 248, 255, 0.85)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(16, 32, 5, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

// ═══════════════════════════════════════════════════════════════
// 3D PARTICLE RAIN & SURFACE RIPPLES
// ═══════════════════════════════════════════════════════════════
function createRainSystem() {
    const rainCount = 4500;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount);

    for (let i = 0; i < rainCount; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * 260;
        positions[i * 3 + 1] = Math.random() * 120;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 260;
        velocities[i] = 85 + Math.random() * 35;
    }

    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
        color: 0xbeddf5,
        size: 1.8,
        map: createRaindropTexture(),
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const rainMesh = new THREE.Points(rainGeo, rainMat);
    rainMesh.visible = false;

    // Ocean surface ripples near vessel
    const rippleCount = 18;
    const rippleGroup = new THREE.Group();
    const rippleMat = new THREE.MeshBasicMaterial({
        color: 0xbeddf5,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const rippleRingGeo = new THREE.RingGeometry(0.3, 0.45, 16);
    rippleRingGeo.rotateX(-Math.PI / 2);

    const ripples = [];
    for (let i = 0; i < rippleCount; i++) {
        const rMesh = new THREE.Mesh(rippleRingGeo, rippleMat.clone());
        rMesh.position.set((Math.random() - 0.5) * 50, 0.12, (Math.random() - 0.5) * 50);
        rMesh.scale.setScalar(0.2);
        rippleGroup.add(rMesh);
        ripples.push({
            mesh: rMesh,
            scale: Math.random() * 1.5,
            opacity: 0.0,
            speed: 1.2 + Math.random() * 1.5,
        });
    }

    const rainGroup = new THREE.Group();
    rainGroup.add(rainMesh);
    rainGroup.add(rippleGroup);

    return {
        group: rainGroup,
        mesh: rainMesh,
        mat: rainMat,
        geo: rainGeo,
        positions,
        velocities,
        ripples,
        update(delta, centerPos, intensity) {
            if (intensity <= 0.01) {
                rainMesh.visible = false;
                rippleGroup.visible = false;
                rainMat.opacity = 0.0;
                return;
            }

            rainMesh.visible = true;
            rippleGroup.visible = true;
            rainMat.opacity = THREE.MathUtils.clamp(intensity * 0.7, 0.0, 0.85);

            // Storm wind drift
            const windSpeedX = 22.0;
            const windSpeedZ = 12.0;

            for (let i = 0; i < rainCount; i++) {
                const idx = i * 3;
                positions[idx + 1] -= velocities[i] * delta;
                positions[idx + 0] += windSpeedX * delta;
                positions[idx + 2] += windSpeedZ * delta;

                const relX = positions[idx + 0] - centerPos.x;
                const relZ = positions[idx + 2] - centerPos.z;

                if (positions[idx + 1] < -2.0 || Math.abs(relX) > 140 || Math.abs(relZ) > 140) {
                    positions[idx + 1] = 110 + Math.random() * 15;
                    positions[idx + 0] = centerPos.x + (Math.random() - 0.5) * 260;
                    positions[idx + 2] = centerPos.z + (Math.random() - 0.5) * 260;
                }
            }
            rainGeo.attributes.position.needsUpdate = true;

            // Update ripples near boat
            ripples.forEach(r => {
                r.scale += r.speed * delta;
                r.opacity = Math.max(0, (1.0 - r.scale / 2.2) * intensity * 0.55);
                r.mesh.scale.setScalar(r.scale);
                r.mesh.material.opacity = r.opacity;
                if (r.scale >= 2.2 || r.opacity <= 0.01) {
                    r.scale = 0.2;
                    r.mesh.position.set(
                        centerPos.x + (Math.random() - 0.5) * 55,
                        0.12,
                        centerPos.z + (Math.random() - 0.5) * 55
                    );
                }
            });
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// PROCEDURAL THUNDERSTORM LIGHTNING SYSTEM
// ═══════════════════════════════════════════════════════════════
function createLightningSystem() {
    const lightningGroup = new THREE.Group();

    const boltMat = new THREE.LineBasicMaterial({
        color: 0xecf8ff,
        linewidth: 2,
        transparent: true,
        opacity: 0.0,
    });

    const maxPoints = 40;
    const boltGeo = new THREE.BufferGeometry();
    const boltPos = new Float32Array(maxPoints * 3);
    boltGeo.setAttribute('position', new THREE.BufferAttribute(boltPos, 3));
    const boltLine = new THREE.Line(boltGeo, boltMat);
    boltLine.visible = false;
    lightningGroup.add(boltLine);

    const lightningLight = new THREE.PointLight(0xdcf0ff, 0.0, 5000, 1.0);
    lightningGroup.add(lightningLight);

    let nextStrikeTime = 4.0 + Math.random() * 5.0;
    let flashTime = 0.0;
    const strikePos = new THREE.Vector3();

    return {
        group: lightningGroup,
        light: lightningLight,
        isFlashing: false,
        flashIntensity: 0.0,
        update(delta, isStorm, boatPos) {
            if (!isStorm) {
                boltLine.visible = false;
                lightningLight.intensity = 0.0;
                this.isFlashing = false;
                this.flashIntensity = 0.0;
                return;
            }

            nextStrikeTime -= delta;
            if (nextStrikeTime <= 0) {
                nextStrikeTime = 4.5 + Math.random() * 5.5;
                flashTime = 0.16;

                // Pick strike origin and destination
                const sx = boatPos.x + (Math.random() - 0.5) * 600;
                const sz = boatPos.z - 300 + (Math.random() - 0.5) * 500;
                strikePos.set(sx, 400, sz);
                lightningLight.position.copy(strikePos);

                // Generate jagged path
                let curX = sx + (Math.random() - 0.5) * 120;
                let curY = 950;
                let curZ = sz + (Math.random() - 0.5) * 120;
                const segs = 24;
                const stepY = curY / segs;

                for (let i = 0; i < segs; i++) {
                    const idx = i * 3;
                    boltPos[idx + 0] = curX;
                    boltPos[idx + 1] = curY;
                    boltPos[idx + 2] = curZ;

                    curY -= stepY;
                    curX += (Math.random() - 0.5) * 45;
                    curZ += (Math.random() - 0.5) * 45;
                }
                for (let i = segs; i < maxPoints; i++) {
                    const idx = i * 3;
                    boltPos[idx + 0] = curX;
                    boltPos[idx + 1] = 0;
                    boltPos[idx + 2] = curZ;
                }
                boltGeo.attributes.position.needsUpdate = true;
            }

            if (flashTime > 0) {
                flashTime -= delta;
                this.isFlashing = true;
                const pulse = Math.sin(flashTime * 50) > 0.15 ? 1.0 : 0.25;
                this.flashIntensity = pulse;
                boltLine.visible = true;
                boltMat.opacity = pulse;
                lightningLight.intensity = 9.0 * pulse;
            } else {
                boltLine.visible = false;
                lightningLight.intensity = 0.0;
                this.isFlashing = false;
                this.flashIntensity = 0.0;
            }
        }
    };
}

// ═══════════════════════════════════════════════════════════════
// CELESTIAL MOON, MOONLIGHT & STARFIELD
// ═══════════════════════════════════════════════════════════════
function createCelestialSystem() {
    const celestialGroup = new THREE.Group();

    // ── 1. Realistic Moon Sphere ──
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 512;
    moonCanvas.height = 512;
    const mCtx = moonCanvas.getContext('2d');

    mCtx.fillStyle = '#dbe5f0';
    mCtx.fillRect(0, 0, 512, 512);

    // Lunar maria (dark plains) and crater mottling
    mCtx.fillStyle = '#a9b7c8';
    for (let i = 0; i < 35; i++) {
        const mx = Math.random() * 512;
        const my = Math.random() * 512;
        const mr = 20 + Math.random() * 65;
        mCtx.beginPath();
        mCtx.arc(mx, my, mr, 0, Math.PI * 2);
        mCtx.fill();
    }
    mCtx.fillStyle = '#8e9eaf';
    for (let i = 0; i < 20; i++) {
        const mx = Math.random() * 512;
        const my = Math.random() * 512;
        const mr = 15 + Math.random() * 40;
        mCtx.beginPath();
        mCtx.arc(mx, my, mr, 0, Math.PI * 2);
        mCtx.fill();
    }
    // Bright crater rims
    mCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 40; i++) {
        const mx = Math.random() * 512;
        const my = Math.random() * 512;
        const mr = 4 + Math.random() * 12;
        mCtx.beginPath();
        mCtx.arc(mx, my, mr, 0, Math.PI * 2);
        mCtx.fill();
    }

    const moonTex = new THREE.CanvasTexture(moonCanvas);
    const moonGeo = new THREE.SphereGeometry(140, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({
        map: moonTex,
        color: 0xffffff,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    const moonPos = new THREE.Vector3(-450, 1650, -2800);
    moonMesh.position.copy(moonPos);
    celestialGroup.add(moonMesh);

    // ── 2. Moon Halo / Glow Disc ──
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 512;
    haloCanvas.height = 512;
    const hCtx = haloCanvas.getContext('2d');
    const hGrad = hCtx.createRadialGradient(256, 256, 40, 256, 256, 256);
    hGrad.addColorStop(0.0, 'rgba(215, 235, 255, 0.8)');
    hGrad.addColorStop(0.25, 'rgba(180, 215, 255, 0.45)');
    hGrad.addColorStop(0.65, 'rgba(140, 185, 245, 0.12)');
    hGrad.addColorStop(1.0, 'rgba(100, 150, 230, 0.0)');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(0, 0, 512, 512);

    const haloTex = new THREE.CanvasTexture(haloCanvas);
    const haloGeo = new THREE.PlaneGeometry(850, 850);
    const haloMat = new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    haloMesh.position.copy(moonPos);
    celestialGroup.add(haloMesh);

    // ── 3. Directional Moonlight (Silvery reflection on ocean waves) ──
    const moonLight = new THREE.DirectionalLight(0xb5d4ff, 0.0);
    moonLight.position.copy(moonPos);
    moonLight.target.position.set(0, 0, 0);
    celestialGroup.add(moonLight);
    celestialGroup.add(moonLight.target);

    // ── 4. Celestial Starfield Dome ──
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.42;
        const r = 9200;
        starPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.cos(phi) + 400;
        starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2.0,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
    });
    const starfieldMesh = new THREE.Points(starGeo, starMat);
    celestialGroup.add(starfieldMesh);

    return {
        group: celestialGroup,
        moonMesh,
        haloMesh,
        moonLight,
        starfieldMesh,
        moonPos,
        update(delta, nightFactor, cameraPos) {
            haloMesh.lookAt(cameraPos);

            const isNightVisible = nightFactor > 0.01;
            moonMesh.visible = isNightVisible;
            haloMesh.visible = isNightVisible;
            starfieldMesh.visible = isNightVisible;

            if (isNightVisible) {
                haloMat.opacity = nightFactor * 0.65;
                moonLight.intensity = nightFactor * 0.75;
                const twinkle = Math.sin(performance.now() * 0.003) * 0.1;
                starMat.opacity = THREE.MathUtils.clamp(nightFactor * 0.9 + twinkle, 0.0, 1.0);
            } else {
                moonLight.intensity = 0.0;
                haloMat.opacity = 0.0;
                starMat.opacity = 0.0;
            }
        }
    };
}


// ═══════════════════════════════════════════════════════════════
// FEATURE A — 3D FISHING BOAT
// ═══════════════════════════════════════════════════════════════

function createFishingBoat() {
    return createDetailedTrawlerVessel();
}

function createCoastalEnvironment() {
    const coastalGroup = new THREE.Group();

    // ── 1. Shallow Water Transition Lagoon ──
    // Gentle turquoise water shelf at shoreline matching tropical reference
    const shallowGeo = new THREE.PlaneGeometry(3600, 75, 128, 8);
    shallowGeo.rotateX(-Math.PI / 2);

    // Apply natural shoreline curvature to shallow water
    const sPos = shallowGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
        const x = sPos.getX(i);
        const z = sPos.getZ(i);
        const curveOffset = Math.sin(x * 0.0035) * 42 + Math.cos(x * 0.007) * 22;
        sPos.setZ(i, z - 615 + curveOffset);
        sPos.setY(i, 0.35); // slightly above ocean to create shallow shelf
    }
    shallowGeo.computeVertexNormals();

    const shallowMat = new THREE.MeshStandardMaterial({
        color: 0x00e6d6, // luminous tropical cyan / turquoise
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
    });
    const shallowMesh = new THREE.Mesh(shallowGeo, shallowMat);
    coastalGroup.add(shallowMesh);

    // ── 2. Curving Sandy Beach ──
    // Warm golden sand sloping gently into the sea with a darker wet-sand zone
    const beachGeo = new THREE.PlaneGeometry(3600, 110, 128, 12);
    beachGeo.rotateX(-Math.PI / 2);

    const bPos = beachGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
        const x = bPos.getX(i);
        const z = bPos.getZ(i);
        const curveOffset = Math.sin(x * 0.0035) * 42 + Math.cos(x * 0.007) * 22;

        // Normalized distance from water (0 = water edge, 1 = inland berm)
        const t = (z + 55) / 110;
        const elevation = 0.2 + Math.pow(t, 1.4) * 4.5;

        bPos.setZ(i, z - 680 + curveOffset);
        bPos.setY(i, elevation);
    }
    beachGeo.computeVertexNormals();

    const beachMat = new THREE.MeshStandardMaterial({
        color: 0xeed7a8, // warm golden tropical sand
        roughness: 0.92,
        metalness: 0.02,
    });
    const beachMesh = new THREE.Mesh(beachGeo, beachMat);
    coastalGroup.add(beachMesh);

    // Wet sand rim along water edge
    const wetSandGeo = new THREE.PlaneGeometry(3600, 25, 128, 4);
    wetSandGeo.rotateX(-Math.PI / 2);
    const wsPos = wetSandGeo.attributes.position;
    for (let i = 0; i < wsPos.count; i++) {
        const x = wsPos.getX(i);
        const z = wsPos.getZ(i);
        const curveOffset = Math.sin(x * 0.0035) * 42 + Math.cos(x * 0.007) * 22;
        wsPos.setZ(i, z - 635 + curveOffset);
        wsPos.setY(i, 0.28);
    }
    wetSandGeo.computeVertexNormals();

    const wetSandMat = new THREE.MeshStandardMaterial({
        color: 0xb29465, // darker wet sand
        roughness: 0.5,
        metalness: 0.08,
    });
    const wetSandMesh = new THREE.Mesh(wetSandGeo, wetSandMat);
    coastalGroup.add(wetSandMesh);

    // ── 3. Coastal Terrain & Elevated Bluffs ──
    // Elevated green terrain supporting the coastal city behind the beach
    const terrainGeo = new THREE.PlaneGeometry(3800, 550, 128, 32);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
        const x = tPos.getX(i);
        const z = tPos.getZ(i);
        const curveOffset = Math.sin(x * 0.0035) * 42 + Math.cos(x * 0.007) * 22;

        const inlandDist = (z + 275) / 550; // 0 near beach, 1 far inland
        const rolling = Math.sin(x * 0.008) * 6.0 + Math.cos(x * 0.015) * 4.0;
        const elevation = 4.2 + inlandDist * 28.0 + rolling;

        tPos.setZ(i, z - 980 + curveOffset);
        tPos.setY(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
        color: 0x2e7039, // rich tropical green vegetation
        roughness: 0.88,
        metalness: 0.02,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    coastalGroup.add(terrainMesh);

    // Coastal paved promenade / esplanade separating beach and city
    const promenadeGeo = new THREE.PlaneGeometry(3600, 28, 128, 2);
    promenadeGeo.rotateX(-Math.PI / 2);
    const pPos = promenadeGeo.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
        const x = pPos.getX(i);
        const z = pPos.getZ(i);
        const curveOffset = Math.sin(x * 0.0035) * 42 + Math.cos(x * 0.007) * 22;
        pPos.setZ(i, z - 740 + curveOffset);
        pPos.setY(i, 4.8);
    }
    promenadeGeo.computeVertexNormals();
    const promenadeMat = new THREE.MeshStandardMaterial({
        color: 0x737980,
        roughness: 0.8,
    });
    const promenadeMesh = new THREE.Mesh(promenadeGeo, promenadeMat);
    coastalGroup.add(promenadeMesh);

    // ── 4. Tropical Palm Trees ──
    function createPalmTree(trunkHeight, leanX, leanZ) {
        const treeGroup = new THREE.Group();

        // Curved segmented trunk
        const trunkPts = [];
        const segs = 7;
        for (let s = 0; s <= segs; s++) {
            const frac = s / segs;
            const px = Math.sin(frac * Math.PI * 0.5) * leanX;
            const pz = Math.sin(frac * Math.PI * 0.5) * leanZ;
            const py = frac * trunkHeight;
            trunkPts.push(new THREE.Vector3(px, py, pz));
        }
        const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
        const trunkGeo = new THREE.TubeGeometry(trunkCurve, 12, 0.45, 8, false);
        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x5a3e26, // rich brown trunk
            roughness: 0.9,
        });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        treeGroup.add(trunk);

        // Crown of arching tropical palm fronds
        const crownTop = trunkPts[trunkPts.length - 1];
        const numFronds = 8;
        const frondMat = new THREE.MeshStandardMaterial({
            color: 0x2e8236, // vibrant palm green
            roughness: 0.65,
            side: THREE.DoubleSide,
        });

        for (let f = 0; f < numFronds; f++) {
            const angle = (f / numFronds) * Math.PI * 2 + Math.random() * 0.2;
            const frondPts = [
                crownTop.clone(),
                crownTop.clone().add(new THREE.Vector3(Math.cos(angle) * 2.8, 1.2, Math.sin(angle) * 2.8)),
                crownTop.clone().add(new THREE.Vector3(Math.cos(angle) * 5.8, -0.6, Math.sin(angle) * 5.8)),
            ];
            const frondCurve = new THREE.CatmullRomCurve3(frondPts);
            const frondGeo = new THREE.TubeGeometry(frondCurve, 8, 0.45, 4, false);
            const frondMesh = new THREE.Mesh(frondGeo, frondMat);
            treeGroup.add(frondMesh);
        }

        // Coconut cluster
        const coconutMat = new THREE.MeshStandardMaterial({ color: 0x48321e, roughness: 0.8 });
        for (let c = 0; c < 4; c++) {
            const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), coconutMat);
            coconut.position.copy(crownTop).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.6,
                -0.3 - Math.random() * 0.3,
                (Math.random() - 0.5) * 0.6
            ));
            treeGroup.add(coconut);
        }

        return treeGroup;
    }

    // Plant palm tree groves along beachfront esplanade and coastal bluffs
    const palmPositions = [];
    for (let px = -850; px <= 850; px += 32) {
        const curveOffset = Math.sin(px * 0.0035) * 42 + Math.cos(px * 0.007) * 22;
        // Beachfront row
        palmPositions.push({
            x: px + (Math.random() - 0.5) * 12,
            y: 4.8,
            z: -745 + curveOffset + (Math.random() - 0.5) * 16,
            h: 12 + Math.random() * 6,
            lx: (Math.random() - 0.5) * 3,
            lz: (Math.random() - 0.5) * 3,
        });
        // Inland park row
        if (Math.abs(px) > 100 && Math.random() > 0.3) {
            palmPositions.push({
                x: px + (Math.random() - 0.5) * 18,
                y: 8.5 + Math.random() * 5,
                z: -790 + curveOffset + (Math.random() - 0.5) * 24,
                h: 14 + Math.random() * 5,
                lx: (Math.random() - 0.5) * 3.5,
                lz: (Math.random() - 0.5) * 3.5,
            });
        }
    }

    palmPositions.forEach(p => {
        const palm = createPalmTree(p.h, p.lx, p.lz);
        palm.position.set(p.x, p.y, p.z);
        palm.rotation.y = Math.random() * Math.PI * 2;
        coastalGroup.add(palm);
    });

    // ── 5. Coastal City Skyline (Modern Tall Buildings) ──
    const glassTex = createBuildingFacadeTexture('glass');
    const resTex = createBuildingFacadeTexture('residential');
    const resortTex = createBuildingFacadeTexture('resort');

    const glassEmissiveTex = createBuildingNightEmissiveTexture('glass');
    const resEmissiveTex = createBuildingNightEmissiveTexture('residential');
    const resortEmissiveTex = createBuildingNightEmissiveTexture('resort');

    const matGlassBuilding = new THREE.MeshStandardMaterial({
        map: glassTex,
        emissiveMap: glassEmissiveTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.12,
        metalness: 0.35,
    });

    const matResBuilding = new THREE.MeshStandardMaterial({
        map: resTex,
        emissiveMap: resEmissiveTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.38,
        metalness: 0.05,
    });

    const matResortBuilding = new THREE.MeshStandardMaterial({
        map: resortTex,
        emissiveMap: resortEmissiveTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.45,
        metalness: 0.08,
    });

    const matWhiteConcrete = new THREE.MeshStandardMaterial({
        color: 0xf4f6f8,
        roughness: 0.35,
    });

    const matRoofPlant = new THREE.MeshStandardMaterial({
        color: 0x484f55,
        roughness: 0.7,
        metalness: 0.3,
    });

    // Beachfront Promenade Streetlights (Illuminating shoreline at night)
    const streetLightGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const streetLightMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffd580),
        emissiveIntensity: 0.0,
        roughness: 0.2,
    });

    for (let sx = -820; sx <= 820; sx += 40) {
        const curveOffset = Math.sin(sx * 0.0035) * 42 + Math.cos(sx * 0.007) * 22;
        const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 5.0, 8);
        const pole = new THREE.Mesh(poleGeo, matRoofPlant);
        pole.position.set(sx, 5.0, -740 + curveOffset);
        coastalGroup.add(pole);

        const globe = new THREE.Mesh(streetLightGeo, streetLightMat);
        globe.position.set(sx, 7.6, -740 + curveOffset);
        coastalGroup.add(globe);
    }

    // Generate diverse coastal towers
    // Central core has tallest modern skyscrapers (heights 90 to 220)
    // Flanks have luxury beachfront resorts and mid-rises (heights 40 to 85)
    const buildingList = [];
    const minX = -820;
    const maxX = 820;
    const stepX = 26;

    for (let bx = minX; bx <= maxX; bx += stepX) {
        const curveOffset = Math.sin(bx * 0.0035) * 42 + Math.cos(bx * 0.007) * 22;
        const distFromCenter = Math.abs(bx);

        // Tower height profile: soaring in center, tapering naturally at edges
        let baseHeight = 55;
        if (distFromCenter < 380) {
            baseHeight = 110 + (1.0 - distFromCenter / 380) * 115; // 110 to 225
        } else if (distFromCenter < 600) {
            baseHeight = 70 + (1.0 - (distFromCenter - 380) / 220) * 45; // 70 to 115
        } else {
            baseHeight = 40 + Math.random() * 35; // 40 to 75
        }

        const height = baseHeight * (0.8 + Math.random() * 0.45);
        const width = 18 + Math.random() * 12;
        const depth = 18 + Math.random() * 12;

        // Front row vs Back row
        const rows = [0, 1];
        rows.forEach(r => {
            if (r === 1 && Math.random() < 0.2) return; // natural gaps

            const rowZ = -790 - r * 65 + curveOffset - Math.random() * 20;
            const rowY = 7.0 + r * 6.0;

            const bType = (r === 0 && Math.random() > 0.4) ? 'resort' : (Math.random() > 0.5 ? 'glass' : 'residential');
            const bMat = bType === 'glass' ? matGlassBuilding : (bType === 'residential' ? matResBuilding : matResortBuilding);

            const bGeo = new THREE.BoxGeometry(width, height, depth);
            const building = new THREE.Mesh(bGeo, bMat);
            building.position.set(bx + (Math.random() - 0.5) * 8, rowY + height / 2, rowZ);
            coastalGroup.add(building);

            // Architectural Rooftop Details: Spire, Helipad, or Mechanical Penthouse
            const roofY = rowY + height;
            if (height > 120 && Math.random() > 0.4) {
                // Tall communication spire
                const spireGeo = new THREE.CylinderGeometry(0.15, 0.9, 28, 8);
                const spire = new THREE.Mesh(spireGeo, matWhiteConcrete);
                spire.position.set(building.position.x, roofY + 14, building.position.z);
                coastalGroup.add(spire);

                // Warning beacon on top
                const beacon = new THREE.Mesh(
                    new THREE.SphereGeometry(0.6, 8, 8),
                    new THREE.MeshBasicMaterial({ color: 0xff2222 })
                );
                beacon.position.set(building.position.x, roofY + 28, building.position.z);
                coastalGroup.add(beacon);
            } else if (height > 80 && Math.random() > 0.5) {
                // Stepped penthouse tier
                const tierGeo = new THREE.BoxGeometry(width * 0.65, 8.0, depth * 0.65);
                const tier = new THREE.Mesh(tierGeo, matWhiteConcrete);
                tier.position.set(building.position.x, roofY + 4.0, building.position.z);
                coastalGroup.add(tier);
            } else {
                // Mechanical plant box
                const plantGeo = new THREE.BoxGeometry(width * 0.4, 4.5, depth * 0.4);
                const plant = new THREE.Mesh(plantGeo, matRoofPlant);
                plant.position.set(building.position.x, roofY + 2.25, building.position.z);
                coastalGroup.add(plant);
            }
        });
    }

    // ── 6. Majestic Background Mountain Range ──
    // Dramatic low-poly mountain ridges behind the coastal city matching tropical reference
    // Layer 1: Foothills / Mid-distance ridges (Z ≈ -1400)
    const footHillGeo = new THREE.ConeGeometry(380, 220, 7);
    const footHillMat = new THREE.MeshStandardMaterial({
        color: 0x2b4e39, // deep tropical green / slate
        roughness: 0.9,
        flatShading: true,
    });

    const footHillXs = [-1800, -1300, -850, -400, 0, 450, 950, 1450, 1950];
    footHillXs.forEach(mx => {
        const hill = new THREE.Mesh(footHillGeo, footHillMat);
        const hScale = 0.8 + Math.random() * 0.5;
        hill.scale.set(1.4 + Math.random() * 0.4, hScale, 1.0 + Math.random() * 0.4);
        hill.position.set(mx, 110 * hScale, -1450 + (Math.random() - 0.5) * 150);
        hill.rotation.y = Math.random() * Math.PI;
        coastalGroup.add(hill);
    });

    // Layer 2: Grand Distant Mountain Peaks (Z ≈ -2000 to -2400)
    const peakGeo = new THREE.ConeGeometry(650, 480, 8);
    const peakMat = new THREE.MeshStandardMaterial({
        color: 0x243e36, // atmospheric mountain slate-green
        roughness: 0.95,
        flatShading: true,
    });

    const peakXs = [-2200, -1600, -1050, -500, 50, 600, 1200, 1750, 2300];
    peakXs.forEach(px => {
        const peak = new THREE.Mesh(peakGeo, peakMat);
        const pScale = 0.85 + Math.random() * 0.55;
        peak.scale.set(1.5 + Math.random() * 0.5, pScale, 1.2 + Math.random() * 0.4);
        peak.position.set(px, 240 * pScale, -2150 + (Math.random() - 0.5) * 250);
        peak.rotation.y = Math.random() * Math.PI;
        coastalGroup.add(peak);
    });

    coastalGroup.userData = {
        cityMaterials: [matGlassBuilding, matResBuilding, matResortBuilding],
        streetLightMat,
    };

    return coastalGroup;
}

// ═══════════════════════════════════════════════════════════════
// BOAT NAVIGATION CONTROLLER
// ═══════════════════════════════════════════════════════════════

class BoatController {
    constructor(boatGroup, wakeMesh, bowSprayMesh, antennaNode = null) {
        this.group = boatGroup;
        this.wakeMesh = wakeMesh;
        this.bowSprayMesh = bowSprayMesh;
        this.antennaNode = antennaNode;

        // World coordinates & Heading (radians) — Stationary coastal resting position
        this.position = new THREE.Vector3(NAV_CONFIG.coastalStart.x, 0, NAV_CONFIG.coastalStart.z);
        this.heading = NAV_CONFIG.coastalStart.heading;
        this.targetHeading = this.heading;

        // Hydrodynamic Physics
        this.speed = 0.0;
        this.maxForwardSpeed = 54.0;    // ~31 knots sprint speed for modern commercial vessel
        this.maxReverseSpeed = 16.0;    // ~9 knots reverse
        this.acceleration = 18.0;       // high-torque marine diesel acceleration
        this.reverseAcceleration = 10.0;
        this.waterDrag = 8.8;           // gradual deceleration upon throttle release
        this.turnRate = 1.05;           // radians/s turning agility
        this.weatherSystem = null;

        // Momentum / Keel slip resistance
        this.velocity = new THREE.Vector2(0, 0);

        // Smooth wave elevation and tilts
        this.curY = 0.0;
        this.curPitch = 0.0;
        this.curRoll = 0.0;

        // Input state
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };

        this.mouseSteer = 0.0;

        this.setupInputs();
    }

    setupInputs() {
        window.addEventListener('keydown', (e) => {
            const isInput = e.target && e.target.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if (isInput) return;

            let isNavKey = false;
            if (e.code === 'KeyW' || e.code === 'ArrowUp') { this.keys.forward = true; isNavKey = true; }
            if (e.code === 'KeyS' || e.code === 'ArrowDown') { this.keys.backward = true; isNavKey = true; }
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') { this.keys.left = true; isNavKey = true; }
            if (e.code === 'KeyD' || e.code === 'ArrowRight') { this.keys.right = true; isNavKey = true; }

            // Seamless handover: if resting in PFZ, stopped, or idle, restore full manual control immediately
            if (isNavKey && window.navSystem) {
                if (['ARRIVED', 'STOPPED', 'IDLE'].includes(window.navSystem.state)) {
                    window.navSystem.setManualMode();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
        });

        window.addEventListener('blur', () => {
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            this.mouseSteer = 0.0;
        });
    }

    update(time, delta) {
        const dt = Math.min(delta, 0.1);

        // 1. Throttle / Acceleration / Deceleration
        const isAutoNav = window.navSystem && ['NAVIGATING', 'ARRIVING', 'DECELERATING', 'AUTONOMOUS_RETURN'].includes(window.navSystem.state);
        const isStormHalted = window.navSystem && ['STORM_BLOCKED', 'SAFE_AT_COAST'].includes(window.navSystem.state);

        if (isStormHalted) {
            this.speed = 0.0;
            this.velocity.set(0, 0);
        } else if (!isAutoNav) {
            let throttle = 0;
            if (this.keys.forward) throttle += 1;
            if (this.keys.backward) throttle -= 1;

            if (throttle > 0) {
                this.speed = Math.min(this.maxForwardSpeed, this.speed + this.acceleration * dt);
            } else if (throttle < 0) {
                this.speed = Math.max(-this.maxReverseSpeed, this.speed - this.reverseAcceleration * dt);
            } else {
                // Natural water drag deceleration (momentum)
                if (this.speed > 0) {
                    this.speed = Math.max(0, this.speed - this.waterDrag * dt);
                } else if (this.speed < 0) {
                    this.speed = Math.min(0, this.speed + this.waterDrag * dt);
                }
            }
        }

        // 2. Speed-Dependent Rudder Steering
        let steerInput = 0;
        if (this.keys.left) steerInput += 1;
        if (this.keys.right) steerInput -= 1;
        steerInput = THREE.MathUtils.clamp(steerInput + this.mouseSteer, -1, 1);

        const speedRatio = Math.abs(this.speed) / this.maxForwardSpeed;
        const rudderAuthority = Math.max(0.25, speedRatio * 0.75 + 0.25);
        const steerDir = this.speed >= 0 ? 1 : -1;

        const turnDelta = steerInput * this.turnRate * rudderAuthority * steerDir * dt;
        this.targetHeading += turnDelta;

        // Angular damping
        this.heading = THREE.MathUtils.damp(this.heading, this.targetHeading, 4.5, dt);

        // 3. Movement with Keel Slip Damping
        const cosH = Math.cos(this.heading);
        const sinH = Math.sin(this.heading);

        const forwardX = sinH;
        const forwardZ = cosH;

        const targetVx = forwardX * this.speed;
        const targetVz = forwardZ * this.speed;

        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVx, 4.2, dt);
        this.velocity.y = THREE.MathUtils.damp(this.velocity.y, targetVz, 4.2, dt);

        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.y * dt;

        // 4. Shoreline & Ocean Boundary Constraints
        const shoreZ = -610 + Math.sin(this.position.x * 0.0035) * 42 + Math.cos(this.position.x * 0.007) * 22;
        const safeShoreLimit = shoreZ + 42.0; // safe shallow water buffer
        if (this.position.z < safeShoreLimit) {
            this.position.z = safeShoreLimit;
            if (this.velocity.y < 0) this.velocity.y = 0;
            if (this.speed > 0) this.speed *= 0.85;
        }

        const maxOceanZ = 1500.0;
        const maxOceanX = 1650.0;
        if (this.position.z > maxOceanZ) {
            this.position.z = maxOceanZ;
            this.speed = Math.max(0, this.speed);
        }
        if (Math.abs(this.position.x) > maxOceanX) {
            this.position.x = Math.sign(this.position.x) * maxOceanX;
            this.speed *= 0.9;
        }

        // 5. Dynamic 5-Probe Gerstner Wave Buoyancy (Scaled for ~41m vessel)
        const bowX = this.position.x + forwardX * 15.0;
        const bowZ = this.position.z + forwardZ * 15.0;

        const sternX = this.position.x - forwardX * 15.0;
        const sternZ = this.position.z - forwardZ * 15.0;

        const rightX = cosH;
        const rightZ = -sinH;

        const portX = this.position.x - rightX * 4.5;
        const portZ = this.position.z - rightZ * 4.5;

        const starX = this.position.x + rightX * 4.5;
        const starZ = this.position.z + rightZ * 4.5;

        const waveMult = (this.weatherSystem && this.weatherSystem.currentWaveMultiplier) ? this.weatherSystem.currentWaveMultiplier : 1.0;

        const hBow = getGerstnerWaveHeight(bowX, bowZ, time, waveMult);
        const hStern = getGerstnerWaveHeight(sternX, sternZ, time, waveMult);
        const hPort = getGerstnerWaveHeight(portX, portZ, time, waveMult);
        const hStar = getGerstnerWaveHeight(starX, starZ, time, waveMult);
        const hCenter = getGerstnerWaveHeight(this.position.x, this.position.z, time, waveMult);

        const targetY = (hBow + hStern + hPort + hStar + 2.0 * hCenter) / 6.0;

        // Wave slopes + dynamic bow lift under forward throttle
        // In Three.js (+Z forward, +Y up), negative X-rotation lifts the bow (+Z).
        // When hBow > hStern, bow rises over wave crest, requiring negative pitch angle:
        const wavePitch = -Math.atan2(hBow - hStern, 30.0);
        const speedPitch = -(this.speed / this.maxForwardSpeed) * 0.038;
        const targetPitch = THREE.MathUtils.clamp(wavePitch + speedPitch, -0.065, 0.065); // ±3.7 deg max

        // Wave roll + centrifugal heel into turns
        const waveRoll = Math.atan2(hStar - hPort, 9.0);
        const turnRoll = -steerInput * speedRatio * 0.038;
        const targetRoll = THREE.MathUtils.clamp(waveRoll + turnRoll, -0.075, 0.075); // ±4.3 deg max

        // Engine idle pulsation
        const idleBob = Math.sin(time * 2.0) * 0.04 * (1.0 - speedRatio * 0.7);

        this.curY = THREE.MathUtils.damp(this.curY, targetY, 4.5, dt);

        // Anti-sink safety constraint: ensure main deck (Y = +2.2m) stays safely above water surface
        const minSafeY = hCenter - 1.0; // Deck stays at least 1.2m above local water
        if (this.curY < minSafeY) {
            this.curY = minSafeY;
        }

        this.curPitch = THREE.MathUtils.damp(this.curPitch, targetPitch, 4.0, dt);
        this.curRoll = THREE.MathUtils.damp(this.curRoll, targetRoll, 4.0, dt);

        this.group.position.set(this.position.x, this.curY + idleBob, this.position.z);
        this.group.rotation.set(this.curPitch, this.heading, this.curRoll);

        // 6. Hydrodynamic Wake & Bow Spray Animations
        if (this.wakeMesh) {
            const wakeAlpha = Math.min(0.65, speedRatio * 0.85);
            this.wakeMesh.material.opacity = THREE.MathUtils.damp(this.wakeMesh.material.opacity, wakeAlpha, 3.5, dt);
            if (this.wakeMesh.material.map) {
                this.wakeMesh.material.map.offset.y = -time * this.speed * 0.035;
            }
        }
        if (this.bowSprayMesh) {
            const sprayAlpha = Math.max(0, (this.speed / this.maxForwardSpeed) * 0.55);
            this.bowSprayMesh.material.opacity = THREE.MathUtils.damp(this.bowSprayMesh.material.opacity, sprayAlpha, 4.0, dt);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// SMOOTH CINEMATIC CAMERA SYSTEM
// ═══════════════════════════════════════════════════════════════

class CameraController {
    constructor(camera, controls, boatController) {
        this.camera = camera;
        this.controls = controls;
        this.boat = boatController;

        this.mode = 'follow'; // 'follow', 'orbit', or 'underwater'

        // Smooth zoom target & damping (Strictly bounded to prevent flinging into the sky)
        this.followMinDistance = 18.0;
        this.followMaxDistance = 140.0;
        this.followDistance = 58.0;
        this.targetFollowDistance = 58.0;
        this.minDistance = 8.0;     // close inspection
        this.maxDistance = 1200.0;  // panoramic coastal view

        // Smooth follow configuration
        this.heightRatio = 0.38;
        this.lookAheadBase = 7.0;
        this.lookAheadSpeedFactor = 0.40;
        this.smoothness = 4.2;

        this.currentCamPos = camera.position.clone();
        this.currentTarget = controls.target.clone();

        this.setupControls();
    }

    setupControls() {
        // Toggle camera mode with 'C' (Follow -> Orbit -> Underwater)
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyC') {
                this.cycleMode();
            } else if (e.code === 'KeyU') {
                this.toggleDive();
            }
        });

        // Smooth zoom wheel handler with strict boundary clamping
        window.addEventListener('wheel', (e) => {
            if (this.mode === 'follow') {
                const zoomFactor = e.deltaY > 0 ? 1.14 : 0.88;
                this.targetFollowDistance = THREE.MathUtils.clamp(
                    this.targetFollowDistance * zoomFactor,
                    this.followMinDistance,
                    this.followMaxDistance
                );
            } else if (this.mode === 'underwater') {
                const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
                this.targetFollowDistance = THREE.MathUtils.clamp(
                    this.targetFollowDistance * zoomFactor,
                    this.minDistance,
                    280.0
                );
            }
        }, { passive: true });
    }

    cycleMode() {
        if (this.mode === 'follow') {
            this.setMode('orbit');
        } else if (this.mode === 'orbit') {
            this.setMode('underwater');
        } else {
            this.setMode('follow');
        }
    }

    toggleDive() {
        if (this.camera.position.y > 0.5) {
            this.setMode('underwater');
        } else {
            this.setMode('follow');
        }
    }

    focusBoat(resetDistance = true) {
        if (resetDistance) {
            this.targetFollowDistance = 58.0;
            this.followDistance = 58.0;
        }
        const boatPos = this.boat.position;
        const heading = this.boat.heading;
        const forwardX = Math.sin(heading);
        const forwardZ = Math.cos(heading);
        const effDist = this.followDistance;
        const effHeight = effDist * this.heightRatio + 4.5;
        const idealCamPos = new THREE.Vector3(
            boatPos.x - forwardX * effDist,
            boatPos.y + effHeight,
            boatPos.z - forwardZ * effDist
        );
        this.currentCamPos.copy(idealCamPos);
        this.camera.position.copy(idealCamPos);
        this.currentTarget.set(
            boatPos.x + forwardX * this.lookAheadBase,
            boatPos.y + 4.0,
            boatPos.z + forwardZ * this.lookAheadBase
        );
        this.camera.lookAt(this.currentTarget);
        this.controls.target.copy(this.currentTarget);
    }

    setMode(newMode) {
        this.mode = newMode;
        const badge = document.getElementById('cam-mode');
        if (badge) {
            badge.textContent = this.mode.toUpperCase();
        }

        const boatPos = this.boat.position;
        if (this.mode === 'orbit') {
            this.controls.enabled = true;
            this.controls.minDistance = this.minDistance;
            this.controls.maxDistance = this.maxDistance;
            this.controls.target.set(boatPos.x, boatPos.y + 4.0, boatPos.z);
        } else if (this.mode === 'underwater') {
            // Position camera submerged beneath vessel looking up at hull & into the reef
            this.controls.enabled = true;
            this.controls.minDistance = this.minDistance;
            this.controls.maxDistance = 450.0;
            this.controls.target.set(boatPos.x, -2.0, boatPos.z);
            this.currentCamPos.set(boatPos.x - 22, -14.0, boatPos.z - 26);
            this.camera.position.copy(this.currentCamPos);
        } else if (this.mode === 'follow') {
            this.controls.enabled = false;
            // Bound follow distance strictly
            this.targetFollowDistance = THREE.MathUtils.clamp(
                this.targetFollowDistance,
                this.followMinDistance,
                this.followMaxDistance
            );
            this.followDistance = this.targetFollowDistance;

            const heading = this.boat.heading;
            const forwardX = Math.sin(heading);
            const forwardZ = Math.cos(heading);
            const effDist = this.followDistance;
            const effHeight = effDist * this.heightRatio + 4.5;
            const idealCamPos = new THREE.Vector3(
                boatPos.x - forwardX * effDist,
                boatPos.y + effHeight,
                boatPos.z - forwardZ * effDist
            );

            // Re-anchor camera safely if coming from distant orbit view (> 160m)
            if (this.camera.position.distanceTo(boatPos) > 160.0) {
                this.currentCamPos.copy(idealCamPos);
                this.camera.position.copy(idealCamPos);
            }

            this.currentTarget.set(
                boatPos.x + forwardX * this.lookAheadBase,
                boatPos.y + 4.0,
                boatPos.z + forwardZ * this.lookAheadBase
            );
            this.camera.lookAt(this.currentTarget);
        }
    }

    update(time, delta) {
        const dt = Math.min(delta, 0.1);
        const boatPos = this.boat.position;
        const heading = this.boat.heading;
        const speed = this.boat.speed;

        this.followDistance = THREE.MathUtils.clamp(
            THREE.MathUtils.damp(this.followDistance, this.targetFollowDistance, 5.0, dt),
            this.followMinDistance,
            this.followMaxDistance
        );

        if (this.mode === 'follow') {
            this.controls.enabled = false;

            const forwardX = Math.sin(heading);
            const forwardZ = Math.cos(heading);

            // Dynamic camera pullback with speed
            const speedPullback = (Math.abs(speed) / this.boat.maxForwardSpeed) * 8.0;
            const effDist = this.followDistance + speedPullback;
            const effHeight = effDist * this.heightRatio + 4.5;

            // Target camera position: behind boat and elevated
            const desiredCamX = boatPos.x - forwardX * effDist;
            const desiredCamY = Math.max(2.5, boatPos.y + effHeight);
            const desiredCamZ = boatPos.z - forwardZ * effDist;

            // Look-ahead target point ahead of the boat
            const lookAheadDist = this.lookAheadBase + speed * this.lookAheadSpeedFactor;
            const desiredTargetX = boatPos.x + forwardX * lookAheadDist;
            const desiredTargetY = boatPos.y + 4.0;
            const desiredTargetZ = boatPos.z + forwardZ * lookAheadDist;

            // Smooth damping for position and target (ZERO JITTER)
            this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, desiredCamX, this.smoothness, dt);
            this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, desiredCamY, this.smoothness, dt);
            this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, desiredCamZ, this.smoothness, dt);

            this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, desiredTargetX, this.smoothness * 1.2, dt);
            this.currentTarget.y = THREE.MathUtils.damp(this.currentTarget.y, desiredTargetY, this.smoothness * 1.2, dt);
            this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, desiredTargetZ, this.smoothness * 1.2, dt);

            this.camera.position.copy(this.currentCamPos);
            this.camera.lookAt(this.currentTarget);
            this.controls.target.copy(this.currentTarget);
        } else if (this.mode === 'underwater') {
            // Underwater Follow & Free Orbit: tracks submerged vessel keel while allowing full 360 underwater view
            this.controls.enabled = true;
            this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, boatPos.x, 3.5, dt);
            this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, -1.8, 3.5, dt);
            this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, boatPos.z, 3.5, dt);
            this.controls.update();
        } else {
            // Free Orbit Mode: controls target smoothly tracks boat center
            this.controls.enabled = true;
            this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, boatPos.x, 4.0, dt);
            this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, boatPos.y + 4.0, 4.0, dt);
            this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, boatPos.z, 4.0, dt);
            this.controls.update();
        }

        // Seabed collision protection: prevent camera from ever clipping below the ocean floor
        const seabedY = getSeabedHeight(this.camera.position.x, this.camera.position.z);
        if (this.camera.position.y < seabedY + 2.5) {
            this.camera.position.y = seabedY + 2.5;
        }
    }
}

// ═══════════════════════════════════════════════════════════════

const WEATHER_PRESETS = {
    sunny: {
        name: 'SUNNY',
        sunElevation: 26,
        sunAzimuth: 155,
        turbidity: 2.2,
        rayleigh: 1.2,
        mieCoefficient: 0.003,
        mieDirectionalG: 0.85,
        sunLightColor: new THREE.Color(0xfff8ed),
        sunLightIntensity: 2.8,
        hemiSkyColor: new THREE.Color(0x90ccf4),
        hemiGroundColor: new THREE.Color(0x0e3c4a),
        hemiIntensity: 1.4,
        ambientLightColor: new THREE.Color(0xffffff),
        ambientLightIntensity: 0.45,
        fogColor: new THREE.Color(0.68, 0.78, 0.88),
        fogDensity: 0.00022,
        oceanDeep: new THREE.Color(0.005, 0.045, 0.12),
        oceanShallow: new THREE.Color(0.04, 0.35, 0.44),
        oceanSunColor: new THREE.Color(1.0, 0.97, 0.90),
        exposure: 0.62,
        bloomStrength: 0.22,
        waveMultiplier: 1.0,
        cloudColor: new THREE.Color(0xffffff),
        cloudOpacity: 0.55,
        upperCloudOpacity: 0.35,
        rainIntensity: 0.0,
        nightFactor: 0.0,
        cityEmissive: 0.0,
        boatLights: 0.0,
        isStorm: false,
    },
    cloudy: {
        name: 'CLOUDY',
        sunElevation: 20,
        sunAzimuth: 140,
        turbidity: 6.8,
        rayleigh: 2.6,
        mieCoefficient: 0.012,
        mieDirectionalG: 0.8,
        sunLightColor: new THREE.Color(0xd2e0ec),
        sunLightIntensity: 1.3,
        hemiSkyColor: new THREE.Color(0x6e889a),
        hemiGroundColor: new THREE.Color(0x182834),
        hemiIntensity: 0.95,
        ambientLightColor: new THREE.Color(0xa2b2be),
        ambientLightIntensity: 0.55,
        fogColor: new THREE.Color(0.52, 0.60, 0.68),
        fogDensity: 0.00035,
        oceanDeep: new THREE.Color(0.008, 0.035, 0.08),
        oceanShallow: new THREE.Color(0.03, 0.22, 0.28),
        oceanSunColor: new THREE.Color(0.8, 0.85, 0.9),
        exposure: 0.52,
        bloomStrength: 0.18,
        waveMultiplier: 1.18,
        cloudColor: new THREE.Color(0x8e9ca8),
        cloudOpacity: 0.85,
        upperCloudOpacity: 0.65,
        rainIntensity: 0.08,
        nightFactor: 0.0,
        cityEmissive: 0.15,
        boatLights: 0.2,
        isStorm: false,
    },
    night: {
        name: 'NIGHT',
        sunElevation: -14, // below horizon
        sunAzimuth: 155,
        turbidity: 1.8,
        rayleigh: 0.4,
        mieCoefficient: 0.002,
        mieDirectionalG: 0.8,
        sunLightColor: new THREE.Color(0x020408),
        sunLightIntensity: 0.0,
        hemiSkyColor: new THREE.Color(0x0c1a2e),
        hemiGroundColor: new THREE.Color(0x020810),
        hemiIntensity: 0.35,
        ambientLightColor: new THREE.Color(0x0e1c30),
        ambientLightIntensity: 0.25,
        fogColor: new THREE.Color(0.03, 0.06, 0.12),
        fogDensity: 0.00028,
        oceanDeep: new THREE.Color(0.001, 0.008, 0.02),
        oceanShallow: new THREE.Color(0.005, 0.03, 0.06),
        oceanSunColor: new THREE.Color(0.45, 0.60, 0.82), // moonlight reflection
        exposure: 0.42,
        bloomStrength: 0.45,
        waveMultiplier: 0.95,
        cloudColor: new THREE.Color(0x121a28),
        cloudOpacity: 0.40,
        upperCloudOpacity: 0.25,
        rainIntensity: 0.0,
        nightFactor: 1.0,
        cityEmissive: 1.0,
        boatLights: 1.0,
        isStorm: false,
    },
    storm: {
        name: 'STORM',
        sunElevation: 10,
        sunAzimuth: 125,
        turbidity: 9.8,
        rayleigh: 4.8,
        mieCoefficient: 0.035,
        mieDirectionalG: 0.72,
        sunLightColor: new THREE.Color(0x455260),
        sunLightIntensity: 0.45,
        hemiSkyColor: new THREE.Color(0x28343e),
        hemiGroundColor: new THREE.Color(0x0a1014),
        hemiIntensity: 0.45,
        ambientLightColor: new THREE.Color(0x35424c),
        ambientLightIntensity: 0.35,
        fogColor: new THREE.Color(0.16, 0.20, 0.25),
        fogDensity: 0.00048,
        oceanDeep: new THREE.Color(0.002, 0.015, 0.025),
        oceanShallow: new THREE.Color(0.01, 0.09, 0.11),
        oceanSunColor: new THREE.Color(0.35, 0.4, 0.48),
        exposure: 0.38,
        bloomStrength: 0.35,
        waveMultiplier: 1.6, // dramatic storm swells & foam!
        cloudColor: new THREE.Color(0x1a2128),
        cloudOpacity: 0.96,
        upperCloudOpacity: 0.88,
        rainIntensity: 1.0,
        nightFactor: 0.0,
        cityEmissive: 0.65,
        boatLights: 1.0,
        isStorm: true,
    }
};

class WeatherSystem {
    constructor(sky, sunPosition, sunLight, hemiLight, ambientLight, scene, oceanMaterial, composer, bloomPass, renderer, clouds, rainSystem, lightningSystem, celestials, cityData, boatNightLights) {
        this.sky = sky;
        this.sunPosition = sunPosition;
        this.sunLight = sunLight;
        this.hemiLight = hemiLight;
        this.ambientLight = ambientLight;
        this.scene = scene;
        this.oceanMaterial = oceanMaterial;
        this.composer = composer;
        this.bloomPass = bloomPass;
        this.renderer = renderer;
        this.clouds = clouds;
        this.rainSystem = rainSystem;
        this.lightningSystem = lightningSystem;
        this.celestials = celestials;
        this.cityData = cityData;
        this.boatNightLights = boatNightLights;

        this.currentPresetKey = 'sunny';
        this.targetPreset = WEATHER_PRESETS.sunny;

        const s = WEATHER_PRESETS.sunny;
        this.currentSunElevation = s.sunElevation;
        this.currentSunAzimuth = s.sunAzimuth;
        this.currentTurbidity = s.turbidity;
        this.currentRayleigh = s.rayleigh;
        this.currentMieCoefficient = s.mieCoefficient;
        this.currentMieDirectionalG = s.mieDirectionalG;

        this.currentSunLightColor = s.sunLightColor.clone();
        this.currentSunLightIntensity = s.sunLightIntensity;

        this.currentHemiSkyColor = s.hemiSkyColor.clone();
        this.currentHemiGroundColor = s.hemiGroundColor.clone();
        this.currentHemiIntensity = s.hemiIntensity;

        this.currentAmbientColor = s.ambientLightColor.clone();
        this.currentAmbientIntensity = s.ambientLightIntensity;

        this.currentFogColor = s.fogColor.clone();
        this.currentFogDensity = s.fogDensity;

        this.currentOceanDeep = s.oceanDeep.clone();
        this.currentOceanShallow = s.oceanShallow.clone();
        this.currentOceanSunColor = s.oceanSunColor.clone();

        this.currentExposure = s.exposure;
        this.currentBloom = s.bloomStrength;
        this.currentWaveMultiplier = s.waveMultiplier;

        this.currentCloudColor = s.cloudColor.clone();
        this.currentCloudOpacity = s.cloudOpacity;
        this.currentUpperCloudOpacity = s.upperCloudOpacity;

        this.currentRainIntensity = s.rainIntensity;
        this.currentNightFactor = s.nightFactor;
        this.currentCityEmissive = s.cityEmissive;
        this.currentBoatLights = s.boatLights;
        this.currentIsStorm = s.isStorm;

        this.setupUI();
    }

    setupUI() {
        const buttons = document.querySelectorAll('.weather-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const w = btn.dataset.weather;
                if (w && WEATHER_PRESETS[w]) {
                    this.setWeather(w);
                }
            });
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Digit1') this.setWeather('sunny');
            if (e.code === 'Digit2') this.setWeather('cloudy');
            if (e.code === 'Digit3') this.setWeather('night');
            if (e.code === 'Digit4') this.setWeather('storm');
        });
    }

    setWeather(key) {
        if (!WEATHER_PRESETS[key]) return;
        this.currentPresetKey = key;
        this.targetPreset = WEATHER_PRESETS[key];

        const buttons = document.querySelectorAll('.weather-btn');
        buttons.forEach(btn => {
            if (btn.dataset.weather === key) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const badge = document.getElementById('weather-val');
        if (badge) {
            badge.textContent = this.targetPreset.name;
        }

        // Notify Emergency Communication System
        if (window.emergencyCommSystem) {
            window.emergencyCommSystem.setActive(key === 'storm');
        }

        // Notify Autonomous Navigation System of environmental weather change
        if (window.navSystem) {
            window.navSystem.onWeatherChange(key);
        }
    }

    update(delta, boatPos, cameraPos) {
        const dt = Math.min(delta, 0.1);
        const rate = 2.8;

        const t = this.targetPreset;

        this.currentSunElevation = THREE.MathUtils.damp(this.currentSunElevation, t.sunElevation, rate, dt);
        this.currentSunAzimuth = THREE.MathUtils.damp(this.currentSunAzimuth, t.sunAzimuth, rate, dt);
        this.currentTurbidity = THREE.MathUtils.damp(this.currentTurbidity, t.turbidity, rate, dt);
        this.currentRayleigh = THREE.MathUtils.damp(this.currentRayleigh, t.rayleigh, rate, dt);
        this.currentMieCoefficient = THREE.MathUtils.damp(this.currentMieCoefficient, t.mieCoefficient, rate, dt);
        this.currentMieDirectionalG = THREE.MathUtils.damp(this.currentMieDirectionalG, t.mieDirectionalG, rate, dt);

        this.currentSunLightColor.lerp(t.sunLightColor, rate * dt);
        this.currentSunLightIntensity = THREE.MathUtils.damp(this.currentSunLightIntensity, t.sunLightIntensity, rate, dt);

        this.currentHemiSkyColor.lerp(t.hemiSkyColor, rate * dt);
        this.currentHemiGroundColor.lerp(t.hemiGroundColor, rate * dt);
        this.currentHemiIntensity = THREE.MathUtils.damp(this.currentHemiIntensity, t.hemiIntensity, rate, dt);

        this.currentAmbientColor.lerp(t.ambientLightColor, rate * dt);
        this.currentAmbientIntensity = THREE.MathUtils.damp(this.currentAmbientIntensity, t.ambientLightIntensity, rate, dt);

        this.currentFogColor.lerp(t.fogColor, rate * dt);
        this.currentFogDensity = THREE.MathUtils.damp(this.currentFogDensity, t.fogDensity, rate, dt);

        this.currentOceanDeep.lerp(t.oceanDeep, rate * dt);
        this.currentOceanShallow.lerp(t.oceanShallow, rate * dt);
        this.currentOceanSunColor.lerp(t.oceanSunColor, rate * dt);

        this.currentExposure = THREE.MathUtils.damp(this.currentExposure, t.exposure, rate, dt);
        this.currentBloom = THREE.MathUtils.damp(this.currentBloom, t.bloomStrength, rate, dt);
        this.currentWaveMultiplier = THREE.MathUtils.damp(this.currentWaveMultiplier, t.waveMultiplier, rate, dt);

        this.currentCloudColor.lerp(t.cloudColor, rate * dt);
        this.currentCloudOpacity = THREE.MathUtils.damp(this.currentCloudOpacity, t.cloudOpacity, rate, dt);
        this.currentUpperCloudOpacity = THREE.MathUtils.damp(this.currentUpperCloudOpacity, t.upperCloudOpacity, rate, dt);

        this.currentRainIntensity = THREE.MathUtils.damp(this.currentRainIntensity, t.rainIntensity, rate, dt);
        this.currentNightFactor = THREE.MathUtils.damp(this.currentNightFactor, t.nightFactor, rate, dt);
        this.currentCityEmissive = THREE.MathUtils.damp(this.currentCityEmissive, t.cityEmissive, rate, dt);
        this.currentBoatLights = THREE.MathUtils.damp(this.currentBoatLights, t.boatLights, rate, dt);
        this.currentIsStorm = t.isStorm;

        // 1. Sky & Sun Coordinates
        const phi = THREE.MathUtils.degToRad(90 - this.currentSunElevation);
        const theta = THREE.MathUtils.degToRad(this.currentSunAzimuth);
        this.sunPosition.setFromSphericalCoords(1, phi, theta);

        this.sky.material.uniforms['turbidity'].value = this.currentTurbidity;
        this.sky.material.uniforms['rayleigh'].value = this.currentRayleigh;
        this.sky.material.uniforms['mieCoefficient'].value = this.currentMieCoefficient;
        this.sky.material.uniforms['mieDirectionalG'].value = this.currentMieDirectionalG;
        this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);

        // 2. Sun / Ambient / Hemisphere Lighting
        this.sunLight.color.copy(this.currentSunLightColor);
        this.sunLight.intensity = this.currentSunLightIntensity;
        this.sunLight.position.copy(this.sunPosition).multiplyScalar(4500);

        this.hemiLight.color.copy(this.currentHemiSkyColor);
        this.hemiLight.groundColor.copy(this.currentHemiGroundColor);
        this.hemiLight.intensity = this.currentHemiIntensity;

        this.ambientLight.color.copy(this.currentAmbientColor);
        this.ambientLight.intensity = this.currentAmbientIntensity;

        // 3. Scene Fog
        this.scene.fog.color.copy(this.currentFogColor);
        this.scene.fog.density = this.currentFogDensity;

        // 4. Ocean Shader Uniforms
        const u = this.oceanMaterial.uniforms;
        u.uDeepColor.value.copy(this.currentOceanDeep);
        u.uShallowColor.value.copy(this.currentOceanShallow);
        u.uSunColor.value.copy(this.currentOceanSunColor);

        // In night mode, point specular glints to moon; otherwise to sun
        if (this.currentNightFactor > 0.4) {
            const moonDir = this.celestials.moonPos.clone().normalize();
            u.uSunDirection.value.lerp(moonDir, this.currentNightFactor);
        } else {
            u.uSunDirection.value.copy(this.sunPosition).normalize();
        }

        u.uFogColor.value.copy(this.currentFogColor);
        u.uFogDensity.value = this.currentFogDensity;

        // Scale wave amplitudes with waveMultiplier
        for (let i = 0; i < 12; i++) {
            u.uWaves.value[i].z = WAVE_CONFIG[i][2] * this.currentWaveMultiplier;
        }

        // 5. Post-Processing & Lightning Flashes
        let finalExposure = this.currentExposure;
        this.lightningSystem.update(dt, this.currentIsStorm, boatPos);

        if (this.lightningSystem.isFlashing) {
            const flashPulse = this.lightningSystem.flashIntensity;
            this.sunLight.intensity += 4.5 * flashPulse;
            this.ambientLight.intensity += 2.0 * flashPulse;
            finalExposure += 1.3 * flashPulse;
        }

        this.renderer.toneMappingExposure = finalExposure;
        this.bloomPass.strength = this.currentBloom;

        // 6. Clouds
        this.clouds.lowerMesh.material.color.copy(this.currentCloudColor);
        this.clouds.lowerMesh.material.opacity = this.currentCloudOpacity;
        this.clouds.upperMesh.material.color.copy(this.currentCloudColor);
        this.clouds.upperMesh.material.opacity = this.currentUpperCloudOpacity;

        // 7. Rain System
        this.rainSystem.update(dt, boatPos, this.currentRainIntensity);

        // 8. Celestials (Moon & Stars)
        this.celestials.update(dt, this.currentNightFactor, cameraPos);

        // 9. Coastal City Night Lights
        if (this.cityData) {
            if (this.cityData.cityMaterials) {
                this.cityData.cityMaterials.forEach(m => {
                    m.emissiveIntensity = this.currentCityEmissive;
                });
            }
            if (this.cityData.streetLightMat) {
                this.cityData.streetLightMat.emissiveIntensity = this.currentCityEmissive;
            }
        }

        // 10. Boat Night Illumination
        if (this.boatNightLights) {
            this.boatNightLights.setIntensity(this.currentBoatLights);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// INSTANTIATE ENVIRONMENT, CLOUDS, BOAT, SYSTEMS & CONTROLLERS
// ═══════════════════════════════════════════════════════════════
const coastalEnvironment = createCoastalEnvironment();
scene.add(coastalEnvironment);

const clouds = createCloudSystem();
scene.add(clouds.group);

const rainSystem = createRainSystem();
scene.add(rainSystem.group);

const lightningSystem = createLightningSystem();
scene.add(lightningSystem.group);

const celestials = createCelestialSystem();
scene.add(celestials.group);

const fishingBoat = createFishingBoat();
scene.add(fishingBoat.group);

// ─── Instantiate Underwater, Marine Life & Seabed Systems ──────
const seabedSystem = createSeabedSystem();
scene.add(seabedSystem.group);

const vegetationSystem = createVegetationSystem();
scene.add(vegetationSystem.group);

const fishSystem = createFishSystem();
scene.add(fishSystem.group);

const sharkSystem = createSharkSystem();
scene.add(sharkSystem.group);

const underwaterSystem = createUnderwaterSystem(scene);
scene.add(underwaterSystem.group);

// ─── Instantiate Potential Fishing Zone (PFZ) System ───────────
const pfzSystem = createPFZSystem(scene);

// Wire up PFZ toggle button and [P] shortcut
const pfzBtn = document.getElementById('pfz-btn');
if (pfzBtn) {
    pfzBtn.addEventListener('click', () => {
        pfzSystem.toggle();
    });
}

window.addEventListener('keydown', (e) => {
    // Toggle PFZ on [P] key (ignore if user is typing in an input element)
    const isInput = e.target && e.target.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if (e.code === 'KeyP' && !isInput) {
        pfzSystem.toggle();
    }
});

const boatController = new BoatController(fishingBoat.group, fishingBoat.wakeMesh, fishingBoat.bowSprayMesh, fishingBoat.antennaNode);
const cameraController = new CameraController(camera, controls, boatController);

// Expose digital twin controllers and systems for telemetry and analytics
window.boatController = boatController;
window.cameraController = cameraController;
const camBadgeEl = document.getElementById('cam-badge');
if (camBadgeEl) {
    camBadgeEl.style.cursor = 'pointer';
    camBadgeEl.title = 'Click to toggle Camera Mode [C]';
    camBadgeEl.addEventListener('click', () => cameraController.cycleMode());
}
window.pfzSystem = pfzSystem;
window.vegetationSystem = vegetationSystem;
window.fishSystem = fishSystem;
window.seabedSystem = seabedSystem;
window.PFZ_CONFIG = PFZ_CONFIG;
window.EMERGENCY_COMM_CONFIG = EMERGENCY_COMM_CONFIG;

// ═══════════════════════════════════════════════════════════════
// POST-PROCESSING
// ═══════════════════════════════════════════════════════════════
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.22,   // strength — subtle bloom for sun glints
    0.5,    // radius
    0.92    // threshold — only very bright specular blooms
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const weatherSystem = new WeatherSystem(
    sky, sunPosition, sunLight, hemiLight, ambientLight, scene,
    oceanMaterial, composer, bloomPass, renderer,
    clouds, rainSystem, lightningSystem, celestials,
    coastalEnvironment.userData, fishingBoat.nightLights
);
boatController.weatherSystem = weatherSystem;
window.weatherSystem = weatherSystem;

// ─── Instantiate Autonomous Navigation System ─────────────────
const navSystem = new AutonomousNavigationSystem(boatController, cameraController, pfzSystem, weatherSystem);
window.navSystem = navSystem;
window.getNavigationTarget = getNavigationTarget;

// ─── Instantiate Emergency Maritime Communication System ─────
const emergencyCommSystem = createEmergencyCommunicationSystem(scene, boatController);
window.emergencyCommSystem = emergencyCommSystem;

// ─── Minimal HUD Update ────────────────────────────────────────
const speedValEl = document.getElementById('speed-val');
const zoneValEl = document.getElementById('zone-val');
const targetValEl = document.getElementById('target-val');
const statusValEl = document.getElementById('status-val');
const distValEl = document.getElementById('dist-val');
const camModeEl = document.getElementById('cam-mode');
const weatherValEl = document.getElementById('weather-val');
const depthValEl = document.getElementById('depth-val');
const commValEl = document.getElementById('comm-val');

function updateHud() {
    if (speedValEl) {
        const knots = Math.abs(boatController.speed * 0.58).toFixed(1);
        speedValEl.textContent = knots;
    }
    if (zoneValEl) {
        const currentZone = getPFZAtPosition(boatController.position.x, boatController.position.z);
        if (currentZone) {
            const label = `${currentZone.id} [${currentZone.level}]`;
            if (zoneValEl.textContent !== label) {
                zoneValEl.textContent = label;
                zoneValEl.style.color = currentZone.colorCss;
            }
        } else {
            if (zoneValEl.textContent !== 'OPEN SEA') {
                zoneValEl.textContent = 'OPEN SEA';
                zoneValEl.style.color = '#80d0f5';
            }
        }
    }
    if (targetValEl) {
        if (navSystem.state === 'AUTONOMOUS_RETURN') {
            const tText = 'COAST [SAFE HARBOR]';
            if (targetValEl.textContent !== tText) {
                targetValEl.textContent = tText;
                targetValEl.style.color = '#ff9944';
            }
        } else if (navSystem.state === 'SAFE_AT_COAST') {
            const tText = 'COAST ANCHORAGE';
            if (targetValEl.textContent !== tText) {
                targetValEl.textContent = tText;
                targetValEl.style.color = '#00ff66';
            }
        } else if (navSystem.state === 'MANUAL') {
            const tText = 'MANUAL PILOT';
            if (targetValEl.textContent !== tText) {
                targetValEl.textContent = tText;
                targetValEl.style.color = '#80d0f5';
            }
        } else if (navSystem.targetZone) {
            const tText = `${navSystem.targetZone.id} [${navSystem.targetZone.level}]`;
            if (targetValEl.textContent !== tText) {
                targetValEl.textContent = tText;
                targetValEl.style.color = navSystem.targetZone.colorCss;
            }
        } else if (weatherSystem.currentPresetKey === 'storm') {
            if (targetValEl.textContent !== 'COAST ANCHORAGE') {
                targetValEl.textContent = 'COAST ANCHORAGE';
                targetValEl.style.color = '#ff5555';
            }
        } else {
            if (targetValEl.textContent !== '--') {
                targetValEl.textContent = '--';
                targetValEl.style.color = 'rgba(255, 255, 255, 0.4)';
            }
        }
    }
    if (statusValEl) {
        if (statusValEl.textContent !== navSystem.statusMessage) {
            statusValEl.textContent = navSystem.statusMessage;
            if (navSystem.state === 'NAVIGATING' || navSystem.state === 'ARRIVING') {
                statusValEl.style.color = '#00f0d0';
            } else if (navSystem.state === 'ARRIVED') {
                statusValEl.style.color = '#00ff66';
            } else if (navSystem.state === 'AUTONOMOUS_RETURN') {
                statusValEl.style.color = '#ff9944';
            } else if (navSystem.state === 'SAFE_AT_COAST') {
                statusValEl.style.color = '#00ff66';
            } else if (navSystem.state === 'MANUAL') {
                statusValEl.style.color = '#00f0d0';
            } else if (navSystem.state === 'STORM_BLOCKED') {
                statusValEl.style.color = '#ff4444';
            } else {
                statusValEl.style.color = '#80d0f5';
            }
        }
    }
    if (distValEl) {
        if (navSystem.state === 'ARRIVED') {
            if (distValEl.textContent !== 'ARRIVED') {
                distValEl.textContent = 'ARRIVED';
                distValEl.style.color = '#00ff66';
            }
        } else if (navSystem.state === 'SAFE_AT_COAST') {
            if (distValEl.textContent !== 'DOCKED') {
                distValEl.textContent = 'DOCKED';
                distValEl.style.color = '#00ff66';
            }
        } else if (navSystem.state === 'AUTONOMOUS_RETURN') {
            const dText = `${Math.round(navSystem.distanceToTarget)} M`;
            if (distValEl.textContent !== dText) {
                distValEl.textContent = dText;
                distValEl.style.color = '#ff9944';
            }
        } else if (navSystem.targetZone && (navSystem.state === 'NAVIGATING' || navSystem.state === 'ARRIVING')) {
            const dText = `${Math.round(navSystem.distanceToTarget)} M`;
            if (distValEl.textContent !== dText) {
                distValEl.textContent = dText;
                distValEl.style.color = '#00f0d0';
            }
        } else {
            if (distValEl.textContent !== '--') {
                distValEl.textContent = '--';
                distValEl.style.color = 'rgba(255, 255, 255, 0.4)';
            }
        }
    }
    if (commValEl) {
        const isCommActive = emergencyCommSystem && emergencyCommSystem.isActive;
        if (isCommActive) {
            if (commValEl.textContent !== 'ACTIVE') {
                commValEl.textContent = 'ACTIVE';
                commValEl.className = 'comm-active';
            }
        } else {
            if (commValEl.textContent !== 'STANDBY') {
                commValEl.textContent = 'STANDBY';
                commValEl.className = '';
                commValEl.style.color = '#80d0f5';
            }
        }
    }
    if (camModeEl && camModeEl.textContent !== cameraController.mode.toUpperCase()) {
        camModeEl.textContent = cameraController.mode.toUpperCase();
    }
    if (weatherValEl && weatherValEl.textContent !== weatherSystem.currentPresetKey.toUpperCase()) {
        weatherValEl.textContent = weatherSystem.currentPresetKey.toUpperCase();
    }
    if (depthValEl) {
        const waveY = getGerstnerWaveHeight(camera.position.x, camera.position.z, clock.elapsedTime, weatherSystem.currentWaveMultiplier);
        const depth = waveY - camera.position.y;
        if (depth > 0.4) {
            depthValEl.textContent = `-${depth.toFixed(1)} M`;
            depthValEl.style.color = '#00f0d0';
        } else {
            depthValEl.textContent = 'SURFACE';
            depthValEl.style.color = '#80d0f5';
        }
    }
}
window.updateHud = updateHud;

// ═══════════════════════════════════════════════════════════════
// RESIZE HANDLER
// ═══════════════════════════════════════════════════════════════
window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
});

// ═══════════════════════════════════════════════════════════════
// FPS COUNTER
// ═══════════════════════════════════════════════════════════════
const fpsEl = document.getElementById('fps');
let frameCount = 0;
let lastFpsTime = performance.now();

function updateFps() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        fpsEl.textContent = `${frameCount} fps`;
        frameCount = 0;
        lastFpsTime = now;
    }
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Ocean shader animation
    oceanMaterial.uniforms.uTime.value = elapsed;

    // Atmospheric multi-layered drifting clouds
    clouds.lowerTex.offset.x = elapsed * 0.0024;
    clouds.lowerTex.offset.y = elapsed * 0.0014;
    clouds.upperTex.offset.x = -elapsed * 0.0016;
    clouds.upperTex.offset.y = elapsed * 0.0009;

    // Active rotating marine radar scanner, flag cloth flutter & propeller rotation
    if (fishingBoat.update) {
        fishingBoat.update(elapsed, delta, weatherSystem.currentIsStorm, boatController.speed);
    } else if (fishingBoat.radarScanner) {
        fishingBoat.radarScanner.rotation.y += delta * 2.6;
    }

    // Dynamic weather interpolation & atmospheric systems
    weatherSystem.update(delta, boatController.position, camera.position);

    // Continuous underwater submersion & atmosphere engine
    underwaterSystem.update(
        elapsed, delta, camera,
        (x, z, t) => getGerstnerWaveHeight(x, z, t, weatherSystem.currentWaveMultiplier),
        { nightFactor: weatherSystem.currentNightFactor, isStorm: weatherSystem.currentIsStorm },
        lightningSystem.flashIntensity
    );

    // Atmospheric & underwater fog blending
    if (underwaterSystem.submersionFactor > 0.0) {
        const sub = underwaterSystem.submersionFactor;
        scene.fog.color.copy(weatherSystem.currentFogColor).lerp(underwaterSystem.currentUnderwaterColor, sub);
        scene.fog.density = THREE.MathUtils.lerp(weatherSystem.currentFogDensity, underwaterSystem.currentUnderwaterFogDensity, sub);
        oceanMaterial.uniforms.uFogColor.value.copy(scene.fog.color);
        oceanMaterial.uniforms.uFogDensity.value = scene.fog.density;
    }

    // Marine environment & life updates
    const underwaterFogCol = scene.fog.color;
    const underwaterFogDens = scene.fog.density;
    const curSunDir = oceanMaterial.uniforms.uSunDirection.value;
    const curSunCol = oceanMaterial.uniforms.uSunColor.value;

    seabedSystem.update(elapsed, underwaterFogCol, underwaterFogDens, curSunDir, curSunCol, weatherSystem.currentNightFactor);
    vegetationSystem.update(elapsed, underwaterFogCol, underwaterFogDens, curSunDir, curSunCol, weatherSystem.currentNightFactor);
    sharkSystem.update(elapsed, delta, boatController.position, underwaterFogCol, underwaterFogDens);
    fishSystem.update(elapsed, delta, camera.position, sharkSystem.position, underwaterFogCol, underwaterFogDens, curSunDir, curSunCol, weatherSystem.currentNightFactor);
    pfzSystem.update(delta, elapsed, camera.position, boatController.position);

    // Autonomous navigation autopilot & route tracking
    navSystem.update(delta);

    // Boat navigation, wave buoyancy & wake
    boatController.update(elapsed, delta);

    // Update ocean shader local boat exclusion uniforms
    if (oceanMaterial.uniforms.uBoatPos) {
        oceanMaterial.uniforms.uBoatPos.value.copy(boatController.position);
        oceanMaterial.uniforms.uBoatHeading.value = boatController.heading;
        oceanMaterial.uniforms.uBoatSpeed.value = boatController.speed;
    }

    // Emergency communication station beacon & airborne signal beam
    if (emergencyCommSystem) {
        emergencyCommSystem.update(elapsed, delta);
    }

    // Smooth cinematic camera
    cameraController.update(elapsed, delta);

    // Update HUD
    updateHud();

    composer.render();
    updateFps();
}

animate();
console.log('[Ocean] Interactive ocean simulation running — dynamic weather, multi-layer clouds, 3D rain, rotating radar, modern vessel');



