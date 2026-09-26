// Ocean Shaders and Wave Parameters
import * as THREE from 'three';

export const oceanVertexShader = /* glsl */ `
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

export const oceanFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform samplerCube uEnvMap;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFogColor;
uniform float uFogDensity;

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

    // Scattered thin whitecaps
    float scatterBase = smoothstep(0.65, 0.92, snoise(vec3(worldXZ * 0.06 + uTime * 0.02, 0.5)));
    foamBase += scatterBase * streak * cellular * 0.1;

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

export const WAVE_CONFIG = [
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
export const SUN_CONFIG = {
    elevation: 26,      // bright, warm sunny tropical daylight
    azimuth: 155,       // side-front illumination for sparkling sun glints
    turbidity: 2.2,     // crisp, clean tropical air
    rayleigh: 1.2,      // vibrant azure blue sky
    mieCoefficient: 0.003,
    mieDirectionalG: 0.85,
};

// ─── Color Palette (Clear Tropical Ocean & Sky) ────────────────
export const COLORS = {
    deep: new THREE.Color(0.005, 0.045, 0.12),
    shallow: new THREE.Color(0.04, 0.35, 0.44),
    fog: new THREE.Color(0.68, 0.78, 0.88),  // soft atmospheric sky tint, NOT dull gray
    sun: new THREE.Color(1.0, 0.97, 0.90),   // warm radiant sunlight
};


export const GRAVITY = 9.81;
export const PI = Math.PI;

export function getGerstnerWaveHeight(x, z, time, waveMult = 1.0) {
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
