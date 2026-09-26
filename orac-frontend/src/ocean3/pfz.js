// ═══════════════════════════════════════════════════════════════
// POTENTIAL FISHING ZONE (PFZ) SYSTEM — MARINE INTELLIGENCE LAYER
// SIH Problem Statement 26176 — ORCA Marine Ecosystem Digital Twin
// Single Source of Truth for Geospatial & Underwater Analytics
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { PFZ_CONFIG } from './config.js';
import { getSeabedHeight } from './seabed.js';

// ─── Authoritative Spatial Query Function ──────────────────────
// Returns the active PFZ zone object if (x, z) falls within its radius,
// or null if the point is in open sea.
export function getPFZAtPosition(x, z) {
    let posX = x;
    let posZ = z;
    if (typeof x === 'object' && x !== null) {
        posX = x.x;
        posZ = x.z;
    }
    const zones = PFZ_CONFIG.zones;
    for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        const dx = posX - zone.center.x;
        const dz = posZ - zone.center.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist <= zone.radius) {
            return zone;
        }
    }
    return null;
}

// ─── Surface Analytical Overlay Shaders ────────────────────────
// Professional Marine GIS Visualization:
// Soft radial falloff, organic perturbed perimeter, subtle outward sonar radar pulse,
// fine geospatial grid pattern, glowing contour rim, and ZERO z-fighting.
const pfzSurfaceVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const pfzSurfaceFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform float uRadius;
uniform vec2 uCenter;
uniform float uGlobalOpacity;
uniform float uTargetHighlight;
uniform vec3 uBoatPos;

varying vec3 vWorldPosition;
varying vec2 vUv;

#define PI 3.14159265359

void main() {
    if (uGlobalOpacity <= 0.001) {
        discard;
    }

    // Vessel local exclusion (prevents analytical overlay from ever penetrating the vessel)
    if (length(vWorldPosition.xz - uBoatPos.xz) < 18.0) {
        discard;
    }

    vec2 localOffset = vWorldPosition.xz - uCenter;
    float dist = length(localOffset);
    float normR = dist / uRadius;

    if (normR > 1.25) {
        discard;
    }

    // 1. Organic coastline/boundary perturbation
    float angle = atan(localOffset.y, localOffset.x);
    float wave = sin(angle * 4.0 + uTime * 0.45) * 0.038
               + cos(angle * 7.0 - uTime * 0.28) * 0.024
               + sin(angle * 11.0 + 1.2) * 0.015;
    float effR = normR + wave;

    // 2. Glowing perimeter contour rim (clean analytical boundary)
    float perimeter = smoothstep(0.065, 0.0, abs(effR - 0.95)) * 0.82;

    // 3. Inner secondary GIS depth contour
    float innerContour = smoothstep(0.045, 0.0, abs(effR - 0.62)) * 0.38;

    // 4. Smooth pulsating outward sonar radar sweep
    float pulseSpeed = 0.32 + uTargetHighlight * 0.18;
    float pulsePhase = fract(uTime * pulseSpeed);
    float pulseRing = smoothstep(0.075, 0.0, abs(effR - pulsePhase)) * (1.0 - pulsePhase) * (0.42 + uTargetHighlight * 0.35);

    // 5. Target highlight pulse (clean, subtle pulse for destination PFZ)
    float targetPulse = uTargetHighlight * (sin(uTime * 3.5) * 0.15 + 0.15) * smoothstep(1.0, 0.85, effR);

    // Combine analytical contours (no interior solid sheet: allows ocean waves and water through 100%)
    float lineAlpha = perimeter + innerContour + pulseRing + targetPulse;
    if (lineAlpha <= 0.001) {
        discard;
    }

    // 6. Organic soft perimeter falloff
    float edgeFalloff = smoothstep(1.05, 0.95, effR);

    float totalAlpha = lineAlpha * (1.0 - edgeFalloff) * uGlobalOpacity;
    totalAlpha = clamp(totalAlpha, 0.0, 0.88);

    if (totalAlpha <= 0.001) {
        discard;
    }

    // Subtle edge luminescence
    vec3 outColor = mix(uColor, vec3(1.0, 1.0, 1.0), perimeter * 0.38 + pulseRing * 0.3 + targetPulse * 0.25);

    gl_FragColor = vec4(outColor, totalAlpha);
}
`;

// ─── Underwater Zone Column Boundary Shaders ───────────────────
// Faint vertical boundary mesh underwater for spatial orientation
const pfzColumnVertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const pfzColumnFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform float uGlobalOpacity;

varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
    if (uGlobalOpacity <= 0.001) {
        discard;
    }

    // Fades smoothly with depth (vUv.y = 0 at surface, 1 at seabed)
    float depthFade = (1.0 - vUv.y * 0.7);
    
    // Subtle vertical luminous scanlines
    float scan = sin(vWorldPosition.y * 0.35 - uTime * 1.5) * 0.5 + 0.5;
    float scanline = pow(scan, 3.0) * 0.4;

    float alpha = (0.12 + scanline) * depthFade * uGlobalOpacity;
    gl_FragColor = vec4(uColor, alpha);
}
`;

// ─── 3D Floating Zone Billboard Canvas Generator ───────────────
function createZoneLabelTexture(zone) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // High-DPI clear background
    ctx.clearRect(0, 0, 512, 256);

    // Rounded card container (Glassmorphic dark UI)
    const x = 16, y = 16, w = 480, h = 224, r = 24;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(8, 26, 38, 0.96)';
    ctx.fill();

    ctx.strokeStyle = zone.colorCss;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Glowing status dot
    ctx.beginPath();
    ctx.arc(58, 68, 14, 0, Math.PI * 2);
    ctx.fillStyle = zone.colorCss;
    ctx.fill();
    ctx.shadowColor = zone.colorCss;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();

    // Text: Zone ID & Level Header
    ctx.font = 'bold 44px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${zone.id} · ${zone.level}`, 88, 80);

    // Text: Subtitle
    ctx.font = '600 21px sans-serif';
    ctx.fillStyle = 'rgba(215, 240, 255, 0.9)';
    ctx.fillText('POTENTIAL FISHING ZONE', 46, 128);

    // Text: Scientific telemetry indicators (Simulated Digital Twin metrics)
    ctx.font = '22px monospace';
    ctx.fillStyle = zone.colorCss;
    ctx.fillText(`CHL: ${zone.chlorophyll} mg/m³  SST: ${zone.sst}°C`, 46, 168);

    ctx.font = '20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`FISH PROB: ${(zone.fishProbability * 100).toFixed(0)}%  BIOMASS: ${zone.level}`, 46, 204);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

// ─── Main PFZ System Factory ───────────────────────────────────
export function createPFZSystem(scene) {
    const group = new THREE.Group();
    group.name = 'PFZ_System_Root';
    scene.add(group);

    const zones = PFZ_CONFIG.zones;
    const surfaceMeshes = [];
    const surfaceMaterials = [];
    const underwaterColumns = [];
    const labelSprites = [];
    const materials = [];

    // Global toggle state and smooth fade engine
    let isEnabled = false;
    let currentOpacity = 0.0;
    let targetOpacity = 0.0;
    let activeTargetZoneId = null;

    zones.forEach((zone) => {
        const colorVec = new THREE.Color(zone.colorHex);

        // 1. Surface Analytical Plane Geometry & Shader
        // Sits slightly above sea level (y = +0.22) with polygonOffset to guarantee ZERO z-fighting
        const planeSize = zone.radius * 2.5;
        const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize, 32, 32);
        planeGeo.rotateX(-Math.PI / 2);

        const surfaceMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uColor: { value: colorVec },
                uRadius: { value: zone.radius },
                uCenter: { value: new THREE.Vector2(zone.center.x, zone.center.z) },
                uGlobalOpacity: { value: 0.0 },
                uTargetHighlight: { value: 0.0 },
                uBoatPos: { value: new THREE.Vector3() },
            },
            vertexShader: pfzSurfaceVertexShader,
            fragmentShader: pfzSurfaceFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
            polygonOffsetUnits: -2,
            side: THREE.DoubleSide,
        });
        materials.push(surfaceMat);
        surfaceMaterials.push(surfaceMat);

        const surfaceMesh = new THREE.Mesh(planeGeo, surfaceMat);
        surfaceMesh.position.set(zone.center.x, 0.22, zone.center.z);
        surfaceMesh.renderOrder = 2;
        group.add(surfaceMesh);
        surfaceMeshes.push(surfaceMesh);

        // 2. Underwater Faint Volumetric Boundary Cylinder
        // Gives 3D spatial presence underwater without recoloring water globally
        const seabedY = getSeabedHeight(zone.center.x, zone.center.z);
        const colHeight = Math.max(15.0, Math.abs(seabedY) + 2.0);
        const colGeo = new THREE.CylinderGeometry(zone.radius, zone.radius * 1.05, colHeight, 36, 1, true);
        colGeo.translate(0, -colHeight * 0.5, 0);

        const colMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0.0 },
                uColor: { value: colorVec },
                uGlobalOpacity: { value: 0.0 },
            },
            vertexShader: pfzColumnVertexShader,
            fragmentShader: pfzColumnFragmentShader,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        materials.push(colMat);

        const colMesh = new THREE.Mesh(colGeo, colMat);
        colMesh.position.set(zone.center.x, 0.0, zone.center.z);
        colMesh.renderOrder = 1;
        group.add(colMesh);
        underwaterColumns.push(colMesh);

        // 3. Floating 3D Zone Label Billboard Sprite
        // Anchored at y = +18.0 above wave crests, perfectly stable, no depth clipping
        const labelTex = createZoneLabelTexture(zone);
        const spriteMat = new THREE.SpriteMaterial({
            map: labelTex,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            depthTest: false,
        });

        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.set(zone.center.x, 18.0, zone.center.z);
        sprite.scale.set(52.0, 26.0, 1.0);
        sprite.renderOrder = 10;
        group.add(sprite);
        labelSprites.push(sprite);
    });

    // ─── External Controls ─────────────────────────────────────
    function setEnabled(val) {
        isEnabled = !!val;
        targetOpacity = isEnabled ? 1.0 : 0.0;

        // Sync UI Button and Legend elements
        const btn = document.getElementById('pfz-btn');
        if (btn) {
            if (isEnabled) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        const legend = document.getElementById('pfz-legend');
        if (legend) {
            if (isEnabled) {
                legend.classList.remove('hidden');
            } else {
                legend.classList.add('hidden');
            }
        }
    }

    function toggle() {
        setEnabled(!isEnabled);
        return isEnabled;
    }

    function setActiveTarget(zoneId) {
        activeTargetZoneId = zoneId || null;
        zones.forEach((zone, idx) => {
            const mat = surfaceMaterials[idx];
            if (mat && mat.uniforms.uTargetHighlight) {
                mat.uniforms.uTargetHighlight.value = (zoneId && zone.id === zoneId) ? 1.0 : 0.0;
            }
        });
    }

    return {
        group,
        get enabled() {
            return isEnabled;
        },
        get activeTarget() {
            return activeTargetZoneId;
        },
        setEnabled,
        toggle,
        setActiveTarget,
        update(delta, elapsed, cameraPos, boatPos) {
            const dt = Math.min(delta, 0.1);

            // Smooth opacity interpolation (0 -> 1 when ON, 1 -> 0 when OFF)
            currentOpacity = THREE.MathUtils.damp(currentOpacity, targetOpacity, 4.5, dt);

            // If completely faded out and disabled, hide group from rendering
            if (currentOpacity < 0.001 && !isEnabled) {
                group.visible = false;
                return;
            }
            group.visible = true;

            // Update shader materials
            materials.forEach((mat) => {
                mat.uniforms.uTime.value = elapsed;
                mat.uniforms.uGlobalOpacity.value = currentOpacity;
                if (boatPos && mat.uniforms.uBoatPos) {
                    mat.uniforms.uBoatPos.value.copy(boatPos);
                }
            });

            // Update floating 3D labels
            labelSprites.forEach((sprite) => {
                sprite.material.opacity = currentOpacity;
            });
        },
    };
}
