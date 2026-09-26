// ═══════════════════════════════════════════════════════════════
// DETAILED 3D COMMERCIAL FISHING / TRAWLER VESSEL
// SIH Problem Statement 26176 — ORCA Marine Digital Twin
// Production 3D Model with Watertight Closed Hull, Solid Deck,
// Detailed Wheelhouse, Lattice Mast, Rigging & Dual Championship Flags
// ("Umesh" & "SIH 2026 WINNERS")
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// ─── Centralized Master Vessel Dimensions ─────────────────────
// Scale derived strictly from L = 32.0m primary modeling standard
export const BOAT_CONFIG = {
    length: 32.0,      // Length overall (Z: -15.8m stern to +16.0m bow)
    beam: 9.0,         // Maximum hull beam (9.0m midship)
    depth: 5.5,        // Keel to main deck depth (~5.5m total vertical)
    draft: 2.8,        // Target operational draft (~2.8m - 3.2m underwater)
    deckHeight: 2.2,   // Main deck elevation above waterline (Y = +2.2m)
    cabinHeight: 3.4,  // Cabin superstructure height (Y = +2.2m to +5.6m)
    mastHeight: 15.6,  // Top antenna tip above waterline (Y = +15.6m)
    scale: 1.0,
};

// ─── Longitudinal Hull Stations (L = 32m) ─────────────────────
// Station 0 (Bow) to Station 8 (Stern)
const HULL_STATIONS = [
    { z:  16.0, halfW: 0.35, yKeel: -1.2, yDeck: 4.4 }, // 0: Raked stem bow post
    { z:  13.8, halfW: 2.30, yKeel: -2.2, yDeck: 3.8 }, // 1: Flared foredeck shoulder
    { z:  10.5, halfW: 3.60, yKeel: -2.8, yDeck: 3.1 }, // 2: Forward shoulder
    { z:   6.0, halfW: 4.30, yKeel: -3.2, yDeck: 2.5 }, // 3: Forward midship
    { z:   1.0, halfW: 4.50, yKeel: -3.3, yDeck: 2.2 }, // 4: Maximum beam midship (9.0m full beam)
    { z:  -4.0, halfW: 4.40, yKeel: -3.3, yDeck: 2.2 }, // 5: Aft midship
    { z:  -8.5, halfW: 4.10, yKeel: -3.1, yDeck: 2.2 }, // 6: Aft working deck
    { z: -12.5, halfW: 3.60, yKeel: -2.6, yDeck: 2.2 }, // 7: Quarter deck
    { z: -15.8, halfW: 3.00, yKeel: -1.8, yDeck: 2.3 }, // 8: Transom stern (6.0m full beam)
];

// ─── Procedural Canvas Texture Generators ─────────────────────

/**
 * Creates high-resolution championship cloth flag texture
 * @param {'umesh' | 'sih'} type
 */
function createChampionshipFlagTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const ctx = canvas.getContext('2d');

    // 1. Deep Royal Navy Blue Cloth Background with weave gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 576);
    bgGrad.addColorStop(0, '#0a1630');
    bgGrad.addColorStop(0.5, '#0e2044');
    bgGrad.addColorStop(1, '#081226');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 576);

    // Subtle cloth ripple vignette
    const vGrad = ctx.createRadialGradient(512, 288, 100, 512, 288, 600);
    vGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    vGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, 1024, 576);

    // 2. Ornate Golden Border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, 1024 - 36, 576 - 36);

    ctx.strokeStyle = '#f9e076';
    ctx.lineWidth = 4;
    ctx.strokeRect(28, 28, 1024 - 56, 576 - 56);

    // Corner decorative corner accents
    const corners = [[32, 32], [1024 - 32, 32], [32, 576 - 32], [1024 - 32, 576 - 32]];
    ctx.fillStyle = '#f9e076';
    corners.forEach(([cx, cy]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();
    });

    // 3. Gold Text and Emblem Gradients
    const goldGrad = ctx.createLinearGradient(0, 140, 0, 440);
    goldGrad.addColorStop(0, '#fff4b8');
    goldGrad.addColorStop(0.3, '#f3cb42');
    goldGrad.addColorStop(0.7, '#d4af37');
    goldGrad.addColorStop(1, '#9a7b1c');

    ctx.fillStyle = goldGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (type === 'umesh') {
        // ── FLAG 1: "Umesh" with Royal Crown & Wave Flourish ──
        ctx.beginPath();
        const crownBaseY = 175;
        ctx.moveTo(512 - 70, crownBaseY);
        ctx.lineTo(512 - 90, crownBaseY - 65);
        ctx.lineTo(512 - 40, crownBaseY - 35);
        ctx.lineTo(512, crownBaseY - 80);
        ctx.lineTo(512 + 40, crownBaseY - 35);
        ctx.lineTo(512 + 90, crownBaseY - 65);
        ctx.lineTo(512 + 70, crownBaseY);
        ctx.closePath();
        ctx.fill();

        // Crown jewels
        ctx.fillStyle = '#ffffff';
        [-90, -40, 0, 40, 90].forEach(ox => {
            ctx.beginPath();
            const py = ox === 0 ? crownBaseY - 84 : (Math.abs(ox) === 90 ? crownBaseY - 69 : crownBaseY - 39);
            ctx.arc(512 + ox, py, 4.5, 0, Math.PI * 2);
            ctx.fill();
        });

        // "Umesh" Typography
        ctx.fillStyle = goldGrad;
        ctx.font = 'bold 128px "Cinzel", "Georgia", "Times New Roman", serif';
        ctx.fillText('Umesh', 512, 325);

        // Golden Marine Wave Ripples
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#d4af37';
        for (let w = -1; w <= 1; w += 2) {
            ctx.beginPath();
            const wy = 430 + (w === 1 ? 22 : 0);
            ctx.moveTo(512 - 140, wy);
            ctx.bezierCurveTo(512 - 70, wy - 14, 512 - 35, wy + 14, 512, wy);
            ctx.bezierCurveTo(512 + 35, wy - 14, 512 + 70, wy + 14, 512 + 140, wy);
            ctx.stroke();
        }
    } else {
        // ── FLAG 2: "SIH 2026 WINNERS" with Championship Trophy & Laurel Wreath ──
        const ty = 145;
        ctx.beginPath();
        // Trophy cup body
        ctx.moveTo(512 - 38, ty - 50);
        ctx.lineTo(512 + 38, ty - 50);
        ctx.quadraticCurveTo(512 + 36, ty + 10, 512 + 12, ty + 28);
        ctx.lineTo(512 + 10, ty + 46);
        ctx.lineTo(512 + 32, ty + 50);
        ctx.lineTo(512 + 32, ty + 56);
        ctx.lineTo(512 - 32, ty + 56);
        ctx.lineTo(512 - 32, ty + 50);
        ctx.lineTo(512 - 10, ty + 46);
        ctx.lineTo(512 - 12, ty + 28);
        ctx.quadraticCurveTo(512 - 36, ty + 10, 512 - 38, ty - 50);
        ctx.closePath();
        ctx.fill();

        // Trophy handles
        ctx.lineWidth = 7;
        ctx.strokeStyle = goldGrad;
        ctx.beginPath();
        ctx.arc(512 - 42, ty - 22, 22, Math.PI * 0.45, Math.PI * 1.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(512 + 42, ty - 22, 22, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke();

        // Laurel wreath branches
        for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath();
            ctx.arc(512 + side * 62, ty - 12, 45, side === 1 ? -Math.PI * 0.45 : Math.PI * 0.55, side === 1 ? Math.PI * 0.45 : -Math.PI * 0.55);
            ctx.stroke();
        }

        // Two-Line Typography: "SIH 2026" / "WINNERS"
        ctx.fillStyle = goldGrad;
        ctx.font = 'bold 88px "Cinzel", "Georgia", "Times New Roman", serif';
        ctx.fillText('SIH 2026', 512, 290);

        ctx.font = 'bold 96px "Cinzel", "Georgia", "Times New Roman", serif';
        ctx.letterSpacing = '8px';
        ctx.fillText('WINNERS', 512, 420);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 8;
    return tex;
}

/**
 * Procedural weathered teak timber deck texture
 */
function createDeckWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Weathered maritime teak base
    ctx.fillStyle = '#8f6a42';
    ctx.fillRect(0, 0, 512, 512);

    // Planking lines & wood grain
    const plankW = 16;
    for (let x = 0; x < 512; x += plankW) {
        const lum = 0.88 + Math.random() * 0.24;
        ctx.fillStyle = `rgb(${Math.floor(143 * lum)}, ${Math.floor(106 * lum)}, ${Math.floor(66 * lum)})`;
        ctx.fillRect(x, 0, plankW - 2, 512);

        // Dark pitch caulking seam
        ctx.fillStyle = '#261b11';
        ctx.fillRect(x + plankW - 2, 0, 2, 512);
    }

    // Organic grain & weathering noise
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let i = 0; i < 750; i++) {
        const gx = Math.random() * 512;
        const gy = Math.random() * 512;
        const gw = Math.random() * 6 + 2;
        const gh = Math.random() * 60 + 15;
        ctx.fillRect(gx, gy, gw, gh);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 10);
    return tex;
}

/**
 * Procedural upper hull cream planking / steel plate texture
 */
function createUpperHullTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Warm cream / off-white base
    ctx.fillStyle = '#f0ece1';
    ctx.fillRect(0, 0, 512, 256);

    // Horizontal plate strakes
    const strakeH = 28;
    for (let y = 0; y < 256; y += strakeH) {
        const v = (Math.random() - 0.5) * 8;
        ctx.fillStyle = `rgb(${Math.floor(240 + v)}, ${Math.floor(236 + v)}, ${Math.floor(225 + v)})`;
        ctx.fillRect(0, y, 512, strakeH - 2);

        // Seam shadow
        ctx.fillStyle = 'rgba(70, 65, 55, 0.35)';
        ctx.fillRect(0, y + strakeH - 2, 512, 2);

        // Top highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(0, y, 512, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 2);
    return tex;
}

/**
 * Hydrodynamic Stern Wake & Divergent Wash Foam Texture
 * Feather-soft alpha gradient, 100% transparent background, realistic Kelvin wake crests
 */
function createWakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. 100% Transparent Background (zero dark pixels)
    ctx.clearRect(0, 0, 512, 1024);

    // 2. Symmetrical divergent Kelvin wash crests + center propeller wash
    for (let y = 0; y < 1024; y += 4) {
        const v = y / 1024; // 0 at stern, 1 at tail
        // Wash spreads gradually down the wake
        const spread = 24 + Math.pow(v, 0.72) * 185;
        // Length fade: smooth entry at stern, fades to 0.0 at v = 0.88
        const lengthFade = Math.sin(Math.min(1.0, v / 0.12) * Math.PI * 0.5) * Math.pow(Math.max(0, 1.0 - v), 1.25);

        if (lengthFade <= 0.001) continue;

        const trackAlpha = 0.75 * lengthFade;
        const trackWidth = 22 + v * 34;

        // Port wash crest
        const gradL = ctx.createRadialGradient(256 - spread, y, 2, 256 - spread, y, trackWidth);
        gradL.addColorStop(0.0, `rgba(255, 255, 255, ${trackAlpha})`);
        gradL.addColorStop(0.45, `rgba(225, 245, 255, ${trackAlpha * 0.5})`);
        gradL.addColorStop(1.0, 'rgba(200, 235, 255, 0.0)');
        ctx.fillStyle = gradL;
        ctx.beginPath();
        ctx.arc(256 - spread, y, trackWidth, 0, Math.PI * 2);
        ctx.fill();

        // Starboard wash crest
        const gradR = ctx.createRadialGradient(256 + spread, y, 2, 256 + spread, y, trackWidth);
        gradR.addColorStop(0.0, `rgba(255, 255, 255, ${trackAlpha})`);
        gradR.addColorStop(0.45, `rgba(225, 245, 255, ${trackAlpha * 0.5})`);
        gradR.addColorStop(1.0, 'rgba(200, 235, 255, 0.0)');
        ctx.fillStyle = gradR;
        ctx.beginPath();
        ctx.arc(256 + spread, y, trackWidth, 0, Math.PI * 2);
        ctx.fill();

        // Center propeller boil (intense near stern, dissipates by v = 0.42)
        if (v < 0.42) {
            const centerFade = Math.pow(1.0 - v / 0.42, 1.5) * lengthFade * 0.85;
            const cWidth = 16 + v * 28;
            const gradC = ctx.createRadialGradient(256, y, 1, 256, y, cWidth);
            gradC.addColorStop(0.0, `rgba(255, 255, 255, ${centerFade})`);
            gradC.addColorStop(0.5, `rgba(235, 250, 255, ${centerFade * 0.42})`);
            gradC.addColorStop(1.0, 'rgba(200, 240, 255, 0.0)');
            ctx.fillStyle = gradC;
            ctx.beginPath();
            ctx.arc(256, y, cWidth, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 3. Stippled bubbly foam clusters
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let i = 0; i < 400; i++) {
        const v = Math.random();
        const lengthFade = Math.pow(Math.max(0, 1.0 - v), 1.4);
        if (lengthFade < 0.05) continue;

        const spread = 24 + Math.pow(v, 0.72) * 185;
        const side = Math.random() < 0.5 ? -1 : 1;
        const distFromTrack = (Math.random() - 0.5) * (32 + v * 38);
        const bx = 256 + side * spread + distFromTrack;
        const by = v * 1024;
        const br = 1.0 + Math.random() * 3.0;

        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/**
 * Soft radial mist spray texture for bow wave spray
 */
function createBowSprayTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    const radGrad = ctx.createRadialGradient(128, 128, 6, 128, 128, 120);
    radGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.75)');
    radGrad.addColorStop(0.3, 'rgba(235, 248, 255, 0.45)');
    radGrad.addColorStop(0.65, 'rgba(200, 235, 255, 0.15)');
    radGrad.addColorStop(1.0, 'rgba(180, 220, 245, 0.0)');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    // Fine spray flecks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 100;
        ctx.beginPath();
        ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1.2 + Math.random() * 2.0, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

// ─── Main Factory Function ─────────────────────────────────────
export function createDetailedTrawlerVessel() {
    const boatRoot = new THREE.Group();
    boatRoot.name = 'OrcaFishingTrawler';

    // ═══════════════════════════════════════════════════════════
    // 1. PBR MATERIALS HIERARCHY
    // ═══════════════════════════════════════════════════════════
    const deckWoodTex = createDeckWoodTexture();
    const upperHullTex = createUpperHullTexture();

    // 1. Keel: Dark marine steel / anti-fouling black
    const matKeel = new THREE.MeshStandardMaterial({
        color: 0x181c20,
        roughness: 0.75,
        metalness: 0.35,
    });

    // 2. Lower Hull: Deep Ocean Teal / Turquoise Anti-Fouling (Underwater section, Y < 0)
    const matLowerHull = new THREE.MeshStandardMaterial({
        color: 0x145866,
        roughness: 0.45,
        metalness: 0.20,
    });

    // 3. Waterline Stripe: Dark Navy Blue / Black Boot-topping stripe (Y = -0.25 to +0.25)
    const matWaterlineStripe = new THREE.MeshStandardMaterial({
        color: 0x0c1e28,
        roughness: 0.55,
        metalness: 0.25,
    });

    // 4. Upper Hull: Warm Cream / Off-White Topside
    const matUpperHull = new THREE.MeshStandardMaterial({
        map: upperHullTex,
        color: 0xf5f0e6,
        roughness: 0.48,
        metalness: 0.12,
    });

    // 5. Wood Trim & Gunwales: Warm Orange-Brown Marine Timber
    const matWoodTrim = new THREE.MeshStandardMaterial({
        color: 0xc2722b,
        roughness: 0.52,
        metalness: 0.08,
    });

    // 6. Deck Floor: Weathered Timber Planks
    const matDeck = new THREE.MeshStandardMaterial({
        map: deckWoodTex,
        roughness: 0.72,
        metalness: 0.05,
    });

    // 7. Cabin Body: Cream / Off-White Walls with subtle warmth
    const matCabinWalls = new THREE.MeshStandardMaterial({
        color: 0xf7f4ec,
        roughness: 0.42,
        metalness: 0.10,
    });

    // 8. Canopy Roof / Brow Visor: Warm Terracotta Orange-Red
    const matRoof = new THREE.MeshStandardMaterial({
        color: 0xba4118,
        roughness: 0.45,
        metalness: 0.15,
    });

    // 9. Window Glass: Dark Reflective Blue-Gray (Opaque to prevent ocean see-through)
    const matWindowGlass = new THREE.MeshStandardMaterial({
        color: 0x0e1c28,
        roughness: 0.08,
        metalness: 0.90,
    });

    // 10. Heavy Marine Steel / Winches / Cranes
    const matSteel = new THREE.MeshStandardMaterial({
        color: 0x2e353d,
        roughness: 0.45,
        metalness: 0.78,
    });

    // 11. Polished Brass / Bronze (Propeller, Portholes, Windlass Drum)
    const matBrass = new THREE.MeshStandardMaterial({
        color: 0xd9a443,
        roughness: 0.30,
        metalness: 0.85,
    });

    // 12. Rubber Fenders
    const matRubber = new THREE.MeshStandardMaterial({
        color: 0x141618,
        roughness: 0.92,
        metalness: 0.04,
    });

    // 13. SOLAS Lifebuoy Orange & White
    const matLifebuoyOrange = new THREE.MeshStandardMaterial({ color: 0xf75916, roughness: 0.35 });
    const matLifebuoyWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });

    // 14. Steel Wire Rigging Cables
    const matCable = new THREE.LineBasicMaterial({ color: 0x22262a, linewidth: 1 });

    // 15. Emissive Navigation Lights
    const matPortNav = new THREE.MeshStandardMaterial({
        color: 0xff1515,
        emissive: new THREE.Color(0xff0505),
        emissiveIntensity: 0.0,
        roughness: 0.2,
    });
    const matStarNav = new THREE.MeshStandardMaterial({
        color: 0x00f040,
        emissive: new THREE.Color(0x00d030),
        emissiveIntensity: 0.0,
        roughness: 0.2,
    });
    const matMastNav = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xfff6ea),
        emissiveIntensity: 0.0,
        roughness: 0.2,
    });

    // ═══════════════════════════════════════════════════════════
    // 2. WATERTIGHT PARAMETRIC HULL ASSEMBLY
    // ═══════════════════════════════════════════════════════════
    const hullAssembly = new THREE.Group();
    hullAssembly.name = 'HullAssembly';

    const st = HULL_STATIONS;
    const numSt = st.length;

    const lowerPos = [];
    const lowerIdx = [];
    let lowerVIdx = 0;

    const stripePos = [];
    const stripeIdx = [];
    let stripeVIdx = 0;

    const upperPos = [];
    const upperUvs = [];
    const upperIdx = [];
    let upperVIdx = 0;

    const bulwarkPos = [];
    const bulwarkIdx = [];
    let bulwarkVIdx = 0;

    for (let i = 0; i < numSt - 1; i++) {
        const s0 = st[i];
        const s1 = st[i + 1];

        for (let side = -1; side <= 1; side += 2) {
            // Station 0 profile points
            const p0_keel = [0, s0.yKeel, s0.z];
            const p0_garboard = [side * 0.22, s0.yKeel + 0.12, s0.z];
            const p0_chine1 = [side * s0.halfW * 0.52, s0.yKeel * 0.55, s0.z];
            const p0_chine2 = [side * s0.halfW * 0.88, -0.25, s0.z];
            const p0_stripeTop = [side * s0.halfW * 0.95, 0.25, s0.z];
            const p0_deck = [side * s0.halfW, s0.yDeck, s0.z];
            const p0_caprail = [side * (s0.halfW + 0.06), s0.yDeck + 0.85, s0.z];

            // Station 1 profile points
            const p1_keel = [0, s1.yKeel, s1.z];
            const p1_garboard = [side * 0.22, s1.yKeel + 0.12, s1.z];
            const p1_chine1 = [side * s1.halfW * 0.52, s1.yKeel * 0.55, s1.z];
            const p1_chine2 = [side * s1.halfW * 0.88, -0.25, s1.z];
            const p1_stripeTop = [side * s1.halfW * 0.95, 0.25, s1.z];
            const p1_deck = [side * s1.halfW, s1.yDeck, s1.z];
            const p1_caprail = [side * (s1.halfW + 0.06), s1.yDeck + 0.85, s1.z];

            function addQuad(posArr, idxArr, pA, pB, pC, pD, currIdxRef) {
                const base = currIdxRef.val;
                posArr.push(...pA, ...pB, ...pC, ...pD);
                currIdxRef.val += 4;
                if (side === 1) {
                    idxArr.push(base, base + 1, base + 2, base, base + 2, base + 3);
                } else {
                    idxArr.push(base, base + 2, base + 1, base, base + 3, base + 2);
                }
            }

            // Lower Hull Quads (Keel -> Garboard -> Chine1 -> Chine2)
            const lRef = { val: lowerVIdx };
            addQuad(lowerPos, lowerIdx, p0_keel, p1_keel, p1_garboard, p0_garboard, lRef);
            addQuad(lowerPos, lowerIdx, p0_garboard, p1_garboard, p1_chine1, p0_chine1, lRef);
            addQuad(lowerPos, lowerIdx, p0_chine1, p1_chine1, p1_chine2, p0_chine2, lRef);
            lowerVIdx = lRef.val;

            // Waterline Stripe Quad (Chine2 -> StripeTop)
            const sRef = { val: stripeVIdx };
            addQuad(stripePos, stripeIdx, p0_chine2, p1_chine2, p1_stripeTop, p0_stripeTop, sRef);
            stripeVIdx = sRef.val;

            // Upper Hull Topside Quad (StripeTop -> Deck)
            const uBase = upperVIdx;
            upperPos.push(...p0_stripeTop, ...p1_stripeTop, ...p1_deck, ...p0_deck);
            upperUvs.push(
                s0.z / 32.0, 0.0,
                s1.z / 32.0, 0.0,
                s1.z / 32.0, 1.0,
                s0.z / 32.0, 1.0
            );
            upperVIdx += 4;
            if (side === 1) {
                upperIdx.push(uBase, uBase + 1, uBase + 2, uBase, uBase + 2, uBase + 3);
            } else {
                upperIdx.push(uBase, uBase + 2, uBase + 1, uBase, uBase + 3, uBase + 2);
            }

            // Bulwark Topside Quad (Deck -> Caprail)
            const bRef = { val: bulwarkVIdx };
            addQuad(bulwarkPos, bulwarkIdx, p0_deck, p1_deck, p1_caprail, p0_caprail, bRef);
            bulwarkVIdx = bRef.val;
        }
    }

    // ── Transom Stern Closure (Station 8 at Z = -15.8m) ──
    const sStern = st[numSt - 1];
    const tLBase = lowerVIdx;
    lowerPos.push(
        0, sStern.yKeel, sStern.z,
        -sStern.halfW * 0.88, -0.25, sStern.z,
        sStern.halfW * 0.88, -0.25, sStern.z
    );
    lowerIdx.push(tLBase, tLBase + 2, tLBase + 1);
    lowerVIdx += 3;

    const tSBase = stripeVIdx;
    stripePos.push(
        -sStern.halfW * 0.88, -0.25, sStern.z,
        sStern.halfW * 0.88, -0.25, sStern.z,
        sStern.halfW * 0.95, 0.25, sStern.z,
        -sStern.halfW * 0.95, 0.25, sStern.z
    );
    stripeIdx.push(tSBase, tSBase + 2, tSBase + 1, tSBase, tSBase + 3, tSBase + 2);
    stripeVIdx += 4;

    const tUBase = upperVIdx;
    upperPos.push(
        -sStern.halfW * 0.95, 0.25, sStern.z,
        sStern.halfW * 0.95, 0.25, sStern.z,
        sStern.halfW, sStern.yDeck, sStern.z,
        -sStern.halfW, sStern.yDeck, sStern.z
    );
    upperUvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    upperIdx.push(tUBase, tUBase + 2, tUBase + 1, tUBase, tUBase + 3, tUBase + 2);
    upperVIdx += 4;

    const tBBase = bulwarkVIdx;
    bulwarkPos.push(
        -sStern.halfW, sStern.yDeck, sStern.z,
        sStern.halfW, sStern.yDeck, sStern.z,
        sStern.halfW + 0.06, sStern.yDeck + 0.85, sStern.z,
        -(sStern.halfW + 0.06), sStern.yDeck + 0.85, sStern.z
    );
    bulwarkIdx.push(tBBase, tBBase + 2, tBBase + 1, tBBase, tBBase + 3, tBBase + 2);
    bulwarkVIdx += 4;

    function buildMesh(pos, idx, uvs, mat) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        if (uvs && uvs.length > 0) {
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        }
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return new THREE.Mesh(geo, mat);
    }

    hullAssembly.add(buildMesh(lowerPos, lowerIdx, null, matLowerHull));
    hullAssembly.add(buildMesh(stripePos, stripeIdx, null, matWaterlineStripe));
    hullAssembly.add(buildMesh(upperPos, upperIdx, upperUvs, matUpperHull));
    hullAssembly.add(buildMesh(bulwarkPos, bulwarkIdx, null, matUpperHull));

    // ── Heavy Steel Keel Spine (Continuous bottom rail) ──
    const keelPts = st.map(s => new THREE.Vector3(0, s.yKeel - 0.12, s.z));
    const keelCurve = new THREE.CatmullRomCurve3(keelPts);
    const keelGeo = new THREE.TubeGeometry(keelCurve, 32, 0.22, 6, false);
    hullAssembly.add(new THREE.Mesh(keelGeo, matKeel));

    // ── Pointed Raked Bow Stem & Beakhead Extension ──
    const stemPts = [
        new THREE.Vector3(0, st[0].yKeel - 0.12, 16.0),
        new THREE.Vector3(0, 0.0, 16.2),
        new THREE.Vector3(0, 2.2, 16.2),
        new THREE.Vector3(0, 4.4, 16.4),
        new THREE.Vector3(0, 5.5, 16.6)
    ];
    const stemCurve = new THREE.CatmullRomCurve3(stemPts);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 20, 0.26, 8, false);
    hullAssembly.add(new THREE.Mesh(stemGeo, matWoodTrim));

    const beakheadGeo = new THREE.BoxGeometry(0.48, 1.2, 0.75);
    const beakhead = new THREE.Mesh(beakheadGeo, matWoodTrim);
    beakhead.position.set(0, 5.2, 16.45);
    hullAssembly.add(beakhead);

    // ── Wooden Bulwark Caprails & Rubbing Strakes ──
    for (let side = -1; side <= 1; side += 2) {
        const capPts = st.map(s => new THREE.Vector3(side * (s.halfW + 0.06), s.yDeck + 0.88, s.z));
        const capCurve = new THREE.CatmullRomCurve3(capPts);
        const capGeo = new THREE.TubeGeometry(capCurve, 32, 0.14, 8, false);
        hullAssembly.add(new THREE.Mesh(capGeo, matWoodTrim));

        const rubPts = st.map(s => new THREE.Vector3(side * (s.halfW * 0.98 + 0.08), s.yDeck * 0.5 + 0.15, s.z));
        const rubCurve = new THREE.CatmullRomCurve3(rubPts);
        const rubGeo = new THREE.TubeGeometry(rubCurve, 32, 0.12, 6, false);
        hullAssembly.add(new THREE.Mesh(rubGeo, matWoodTrim));

        const fenderZs = [-9.5, -4.5, 1.5, 7.5];
        fenderZs.forEach(fz => {
            const matchS = st.find(s => Math.abs(s.z - fz) < 3.0) || st[4];
            const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 12), matRubber);
            fender.position.set(side * (matchS.halfW + 0.34), matchS.yDeck - 0.55, fz);
            fender.rotation.z = side * 0.12;
            hullAssembly.add(fender);

            const lPts = [
                new THREE.Vector3(side * (matchS.halfW + 0.06), matchS.yDeck + 0.85, fz),
                new THREE.Vector3(side * (matchS.halfW + 0.34), matchS.yDeck - 0.1, fz)
            ];
            hullAssembly.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lPts), matCable));
        });
    }

    const sternCap = new THREE.Mesh(new THREE.BoxGeometry(sStern.halfW * 2 + 0.2, 0.22, 0.42), matWoodTrim);
    sternCap.position.set(0, sStern.yDeck + 0.88, sStern.z);
    hullAssembly.add(sternCap);

    // ── Propulsion: Underwater 4-Blade Propeller & Deep Rudder ──
    const propGroup = new THREE.Group();
    propGroup.name = 'PropellerAssembly';
    propGroup.position.set(0, -1.8, -14.6);

    const propHubGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.95, 12);
    propHubGeo.rotateX(Math.PI / 2);
    const propHub = new THREE.Mesh(propHubGeo, matBrass);
    propGroup.add(propHub);

    for (let b = 0; b < 4; b++) {
        const bladeGeo = new THREE.BoxGeometry(0.16, 1.25, 0.08);
        const blade = new THREE.Mesh(bladeGeo, matBrass);
        blade.rotation.z = (b / 4) * Math.PI * 2;
        blade.rotation.x = 0.35;
        propGroup.add(blade);
    }
    hullAssembly.add(propGroup);

    const rudderGeo = new THREE.BoxGeometry(0.18, 1.8, 1.5);
    const rudder = new THREE.Mesh(rudderGeo, matSteel);
    rudder.position.set(0, -1.9, -16.2);
    hullAssembly.add(rudder);

    boatRoot.add(hullAssembly);

    // ═══════════════════════════════════════════════════════════
    // 3. SOLID WATERTIGHT WORKING DECK ASSEMBLY
    // ═══════════════════════════════════════════════════════════
    const deckAssembly = new THREE.Group();
    deckAssembly.name = 'DeckAssembly';

    const deckPos = [];
    const deckUvs = [];
    const deckIdx = [];
    let deckVIdx = 0;

    for (let i = 0; i < numSt - 1; i++) {
        const s0 = st[i];
        const s1 = st[i + 1];

        const w0 = Math.max(0.15, s0.halfW - 0.12);
        const w1 = Math.max(0.15, s1.halfW - 0.12);

        const p0_l = [-w0, s0.yDeck - 0.05, s0.z];
        const p0_r = [ w0, s0.yDeck - 0.05, s0.z];
        const p1_l = [-w1, s1.yDeck - 0.05, s1.z];
        const p1_r = [ w1, s1.yDeck - 0.05, s1.z];

        const base = deckVIdx;
        deckPos.push(...p0_l, ...p0_r, ...p1_r, ...p1_l);
        deckUvs.push(0, s0.z / 32, 1, s0.z / 32, 1, s1.z / 32, 0, s1.z / 32);
        deckIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        deckVIdx += 4;
    }

    const mainDeckMesh = buildMesh(deckPos, deckIdx, deckUvs, matDeck);
    deckAssembly.add(mainDeckMesh);

    // ── Raised Anchor Windlass Foundation Pad ──
    const anchorPadGeo = new THREE.BoxGeometry(2.4, 0.25, 2.2);
    const anchorPad = new THREE.Mesh(anchorPadGeo, matWoodTrim);
    anchorPad.position.set(0, 3.85, 13.2);
    deckAssembly.add(anchorPad);

    // Heavy Anchor Windlass Winch
    const windlassGroup = new THREE.Group();
    windlassGroup.position.set(0, 4.25, 13.2);
    const wBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 1.4), matSteel);
    windlassGroup.add(wBase);
    const wDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.6, 16), matBrass);
    wDrum.rotation.z = Math.PI / 2;
    wDrum.position.y = 0.42;
    windlassGroup.add(wDrum);
    deckAssembly.add(windlassGroup);

    // Foredeck Mooring Bollards / Bitts
    const bittGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.95, 12);
    for (let side = -1; side <= 1; side += 2) {
        const bitt = new THREE.Mesh(bittGeo, matSteel);
        bitt.position.set(side * 1.35, 4.25, 14.0);
        deckAssembly.add(bitt);

        const bittAft = new THREE.Mesh(bittGeo, matSteel);
        bittAft.position.set(side * 2.2, 2.7, -14.8);
        deckAssembly.add(bittAft);
    }

    // ── Working Deck Perimeter Safety Railings (Height 1.1m) ──
    for (let side = -1; side <= 1; side += 2) {
        const railPts = st.slice(3).map(s => new THREE.Vector3(side * (s.halfW - 0.08), s.yDeck + 1.15, s.z));
        const railCurve = new THREE.CatmullRomCurve3(railPts);
        const railGeo = new THREE.TubeGeometry(railCurve, 24, 0.04, 6, false);
        deckAssembly.add(new THREE.Mesh(railGeo, matSteel));

        for (let idx = 3; idx < numSt; idx++) {
            const s = st[idx];
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.15, 6), matSteel);
            post.position.set(side * (s.halfW - 0.08), s.yDeck + 0.58, s.z);
            deckAssembly.add(post);
        }
    }

    boatRoot.add(deckAssembly);

    // ═══════════════════════════════════════════════════════════
    // 4. DETAILED CABIN / WHEELHOUSE ASSEMBLY
    // ═══════════════════════════════════════════════════════════
    const cabinAssembly = new THREE.Group();
    cabinAssembly.name = 'CabinAssembly';
    cabinAssembly.position.set(0, 2.2, 4.5); // Forward-midship placement

    // Main Wheelhouse Body (Solid cream wood panels)
    const cabinBodyGeo = new THREE.BoxGeometry(5.8, 3.4, 7.8);
    const cabinBody = new THREE.Mesh(cabinBodyGeo, matCabinWalls);
    cabinBody.position.set(0, 1.7, 0);
    cabinAssembly.add(cabinBody);

    // Base Weathering Coaming Trim
    const coaming = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.35, 8.0), matWoodTrim);
    coaming.position.set(0, 0.18, 0);
    cabinAssembly.add(coaming);

    // Terracotta-Red Canopy Roof Slab
    const roofGeo = new THREE.BoxGeometry(6.2, 0.45, 8.4);
    const roof = new THREE.Mesh(roofGeo, matRoof);
    roof.position.set(0, 3.55, 0.15);
    cabinAssembly.add(roof);

    // Forward Brow Visor (Distinctive angled trawler sun/spray shade)
    const visorGeo = new THREE.BoxGeometry(6.2, 0.28, 1.1);
    const visor = new THREE.Mesh(visorGeo, matRoof);
    visor.position.set(0, 3.35, 4.3);
    visor.rotation.x = -0.18;
    cabinAssembly.add(visor);

    // ── Five Forward-Facing Wheelhouse Windows ──
    for (let w = -2; w <= 2; w++) {
        const wx = w * 1.05;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.30, 0.12), matWoodTrim);
        frame.position.set(wx, 2.35, 3.92);
        frame.rotation.x = -0.06;
        cabinAssembly.add(frame);

        const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.14), matWindowGlass);
        glass.position.set(wx, 2.35, 3.99);
        glass.rotation.x = -0.06;
        cabinAssembly.add(glass);
    }

    // ── Four Side Windows on Port & Starboard ──
    for (let side = -1; side <= 1; side += 2) {
        for (let s = 0; s < 4; s++) {
            const sz = 2.4 - s * 1.5;
            const fSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.10, 1.15), matWoodTrim);
            fSide.position.set(side * 2.92, 2.35, sz);
            cabinAssembly.add(fSide);

            const gSide = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.96), matWindowGlass);
            gSide.position.set(side * 2.99, 2.35, sz);
            gSide.rotation.y = side * Math.PI / 2;
            cabinAssembly.add(gSide);
        }

        // Bridge Wing Doors with Brass Portholes
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.2, 1.1), matWoodTrim);
        door.position.set(side * 2.92, 1.1, -2.4);
        cabinAssembly.add(door);

        const porthole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16), matBrass);
        porthole.rotation.z = Math.PI / 2;
        porthole.position.set(side * 2.98, 1.5, -2.4);
        cabinAssembly.add(porthole);

        // SOLAS Lifebuoy Ring (Mounted to cabin exterior wall)
        const buoyGroup = new THREE.Group();
        buoyGroup.position.set(side * 3.02, 2.2, -3.2);
        buoyGroup.rotation.y = side * Math.PI / 2;

        const buoyTorus = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.12, 12, 24), matLifebuoyOrange);
        buoyGroup.add(buoyTorus);
        for (let q = 0; q < 4; q++) {
            const qMesh = new THREE.Mesh(new THREE.TorusGeometry(0.445, 0.125, 8, 8, Math.PI * 0.22), matLifebuoyWhite);
            qMesh.rotation.z = q * Math.PI * 0.5;
            buoyGroup.add(qMesh);
        }
        cabinAssembly.add(buoyGroup);
    }

    // Two Rear Observation Windows
    for (let r = -1; r <= 1; r += 2) {
        const fRear = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.1, 0.12), matWoodTrim);
        fRear.position.set(r * 1.6, 2.35, -3.92);
        cabinAssembly.add(fRear);

        const gRear = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.96), matWindowGlass);
        gRear.position.set(r * 1.6, 2.35, -3.99);
        gRear.rotation.y = Math.PI;
        cabinAssembly.add(gRear);
    }

    // Engine Exhaust Stack Funnel (Behind wheelhouse)
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.50, 4.4, 16), matSteel);
    funnel.position.set(0, 3.8, -3.5);
    funnel.rotation.x = -0.06;
    cabinAssembly.add(funnel);

    const funnelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.40, 0.35, 16), matBrass);
    funnelCap.position.set(0, 6.0, -3.6);
    cabinAssembly.add(funnelCap);

    // Warm Incandescent Interior Cabin Glow Light
    const cabinGlowLight = new THREE.PointLight(0xffb84d, 0.0, 16, 1.2);
    cabinGlowLight.position.set(0, 2.2, 1.0);
    cabinAssembly.add(cabinGlowLight);

    boatRoot.add(cabinAssembly);

    // ═══════════════════════════════════════════════════════════
    // 5. LATTICE MAST, RADAR & DUAL FLAGS ASSEMBLY
    // ═══════════════════════════════════════════════════════════
    const mastAssembly = new THREE.Group();
    mastAssembly.name = 'MastAssembly';
    mastAssembly.position.set(0, 2.2 + 3.55, 4.5 + 0.6); // Mounted atop wheelhouse roof

    // Heavy Main Mast Pole
    const mainMast = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.38, 9.5, 12), matWoodTrim);
    mainMast.position.y = 4.75;
    mastAssembly.add(mainMast);

    // Upper Spire
    const topSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.22, 5.6, 10), matSteel);
    topSpire.position.y = 11.5;
    mastAssembly.add(topSpire);

    // Cross-Spar Yardarm (Width: 14.0m)
    const yardarmGeo = new THREE.CylinderGeometry(0.12, 0.16, 14.0, 10);
    yardarmGeo.rotateZ(Math.PI / 2);
    const yardarm = new THREE.Mesh(yardarmGeo, matWoodTrim);
    yardarm.position.set(0, 8.8, 0);
    mastAssembly.add(yardarm);

    // Rotating Marine Radar Scanner Bar
    const radarPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 0.6, 12), matCabinWalls);
    radarPedestal.position.set(0, 2.8, 1.5);
    mastAssembly.add(radarPedestal);

    const radarScanner = new THREE.Group();
    radarScanner.position.set(0, 3.2, 1.5);
    const scannerBar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.35), matCabinWalls);
    radarScanner.add(scannerBar);
    const scannerFace = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.2), matSteel);
    scannerFace.position.set(0, 0, 0.18);
    radarScanner.add(scannerFace);
    mastAssembly.add(radarScanner);

    // White Enclosed Radome Satellite Dome
    const radomeGeo = new THREE.SphereGeometry(0.85, 16, 14);
    radomeGeo.scale(1.0, 1.15, 1.0);
    const radome = new THREE.Mesh(radomeGeo, matCabinWalls);
    radome.position.set(0, 10.2, 0.5);
    mastAssembly.add(radome);

    // Emergency Radio Communication Antenna Node (Live coordinate anchor at tip)
    const antennaNode = new THREE.Object3D();
    antennaNode.name = 'BoatEmergencyAntenna';
    antennaNode.position.set(0, 14.3, 0);
    mastAssembly.add(antennaNode);

    // Masthead 360° All-Round Navigation Light
    const mastHeadLight = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.28, 10), matMastNav);
    mastHeadLight.position.set(0, 14.2, 0);
    mastAssembly.add(mastHeadLight);

    // ── Dual Championship Cloth Flags ("Umesh" & "SIH 2026 WINNERS") ──
    const flagTexUmesh = createChampionshipFlagTexture('umesh');
    const flagTexSIH = createChampionshipFlagTexture('sih');

    const flagW = 6.2;
    const flagH = 3.5;
    const segW = 24;
    const segH = 14;

    const flagGeoUmeshAft = new THREE.PlaneGeometry(flagW, flagH, segW, segH);
    flagGeoUmeshAft.translate(flagW / 2, -flagH / 2, 0);
    const flagGeoUmeshFore = new THREE.PlaneGeometry(flagW, flagH, segW, segH);
    flagGeoUmeshFore.translate(flagW / 2, -flagH / 2, 0);

    const flagGeoSIHAft = new THREE.PlaneGeometry(flagW, flagH, segW, segH);
    flagGeoSIHAft.translate(flagW / 2, -flagH / 2, 0);
    const flagGeoSIHFore = new THREE.PlaneGeometry(flagW, flagH, segW, segH);
    flagGeoSIHFore.translate(flagW / 2, -flagH / 2, 0);

    const matFlagUmesh = new THREE.MeshStandardMaterial({
        map: flagTexUmesh,
        roughness: 0.55,
        metalness: 0.08,
        side: THREE.FrontSide,
        depthWrite: true,
    });

    const matFlagSIH = new THREE.MeshStandardMaterial({
        map: flagTexSIH,
        roughness: 0.55,
        metalness: 0.08,
        side: THREE.FrontSide,
        depthWrite: true,
    });

    // Port Flag: "Umesh" (X from -6.6 to -0.4)
    const flagMeshUmeshAft = new THREE.Mesh(flagGeoUmeshAft, matFlagUmesh);
    flagMeshUmeshAft.position.set(-0.4, 8.8, -0.015);
    flagMeshUmeshAft.rotation.y = Math.PI;
    mastAssembly.add(flagMeshUmeshAft);

    const flagMeshUmeshFore = new THREE.Mesh(flagGeoUmeshFore, matFlagUmesh);
    flagMeshUmeshFore.position.set(-6.6, 8.8, 0.015);
    mastAssembly.add(flagMeshUmeshFore);

    // Starboard Flag: "SIH 2026 WINNERS" (X from +0.4 to +6.6)
    const flagMeshSIHAft = new THREE.Mesh(flagGeoSIHAft, matFlagSIH);
    flagMeshSIHAft.position.set(6.6, 8.8, -0.015);
    flagMeshSIHAft.rotation.y = Math.PI;
    mastAssembly.add(flagMeshSIHAft);

    const flagMeshSIHFore = new THREE.Mesh(flagGeoSIHFore, matFlagSIH);
    flagMeshSIHFore.position.set(0.4, 8.8, 0.015);
    mastAssembly.add(flagMeshSIHFore);

    // Structural Wire Shrouds & Stays
    const rigPoints = [
        [new THREE.Vector3(0, 8.8, 0), new THREE.Vector3(-2.8, -4.5, -2.5)],
        [new THREE.Vector3(0, 8.8, 0), new THREE.Vector3(-2.8, -4.5, 2.5)],
        [new THREE.Vector3(0, 8.8, 0), new THREE.Vector3(2.8, -4.5, -2.5)],
        [new THREE.Vector3(0, 8.8, 0), new THREE.Vector3(2.8, -4.5, 2.5)],
        [new THREE.Vector3(0, 11.0, 0), new THREE.Vector3(0, -2.0, 10.5)], // Forestay to bow
    ];
    rigPoints.forEach(([pA, pB]) => {
        mastAssembly.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([pA, pB]), matCable));
    });

    boatRoot.add(mastAssembly);

    // ═══════════════════════════════════════════════════════════
    // 6. FISHING GEAR & WORKING RIG ASSEMBLY
    // ═══════════════════════════════════════════════════════════
    const gearAssembly = new THREE.Group();
    gearAssembly.name = 'FishingGearAssembly';

    // ── Port & Starboard Trawl Booms ──
    for (let side = -1; side <= 1; side += 2) {
        const boomGroup = new THREE.Group();
        boomGroup.position.set(side * 3.6, 2.4, -5.5);

        const boomBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.75, 12), matSteel);
        boomGroup.add(boomBase);

        const boomLen = 9.8;
        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, boomLen, 8), matWoodTrim);
        boom.position.set(0, boomLen * 0.42, -boomLen * 0.35);
        boom.rotation.x = -Math.PI * 0.26;
        boom.rotation.z = side * 0.16;
        boomGroup.add(boom);

        // Snatch block sheave pulley at boom tip
        const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), matSteel);
        pulley.position.set(0, boomLen * 0.82, -boomLen * 0.7);
        boomGroup.add(pulley);

        // Hoisting cable
        const hoistPts = [
            new THREE.Vector3(0, boomLen * 0.82, -boomLen * 0.7),
            new THREE.Vector3(0, 0.6, -boomLen * 0.7)
        ];
        boomGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hoistPts), matCable));

        gearAssembly.add(boomGroup);
    }

    // ── Stern A-Frame Gallows Arch ──
    const gallowsGroup = new THREE.Group();
    gallowsGroup.position.set(0, 2.3, -15.2);

    for (let side = -1; side <= 1; side += 2) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6.4, 8), matSteel);
        leg.position.set(side * 3.2, 3.2, 0);
        gallowsGroup.add(leg);
    }
    const gallowsCross = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.35, 0.35), matSteel);
    gallowsCross.position.set(0, 6.4, 0);
    gallowsGroup.add(gallowsCross);
    gearAssembly.add(gallowsGroup);

    // ── Hydraulic Net Drum Reel with Wrapped Netting ──
    const netReelGroup = new THREE.Group();
    netReelGroup.position.set(0, 3.2, -11.5);

    for (let s = -1; s <= 1; s += 2) {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.15, 20), matSteel);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(s * 2.6, 0, 0);
        netReelGroup.add(flange);
    }

    const matNetRoll = new THREE.MeshStandardMaterial({ color: 0x223c28, roughness: 0.95 });
    const netRoll = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 5.0, 20), matNetRoll);
    netRoll.rotation.z = Math.PI / 2;
    netReelGroup.add(netRoll);
    gearAssembly.add(netReelGroup);

    // ── Palletized Fish Storage Crates & Totes ──
    const matCrateBlue = new THREE.MeshStandardMaterial({ color: 0x1a629b, roughness: 0.4 });
    const matCrateYellow = new THREE.MeshStandardMaterial({ color: 0xe6aa05, roughness: 0.4 });

    function createCrate(x, y, z, mat) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.52, 0.75), mat);
        c.position.set(x, y, z);
        gearAssembly.add(c);
    }
    createCrate(-2.8, 2.6, -3.8, matCrateBlue);
    createCrate(-2.8, 3.12, -3.8, matCrateYellow);
    createCrate( 2.8, 2.6, -3.8, matCrateYellow);
    createCrate( 2.8, 3.12, -3.8, matCrateBlue);

    boatRoot.add(gearAssembly);

    // ═══════════════════════════════════════════════════════════
    // 7. WAKE MESH & BOW SPRAY FOAM
    // ═══════════════════════════════════════════════════════════
    // Wake begins at the actual stern transom Z = -15.8m and trails backwards
    const wakeGeo = new THREE.PlaneGeometry(24, 52, 16, 28);
    wakeGeo.rotateX(-Math.PI / 2);
    const wPos = wakeGeo.attributes.position;
    for (let i = 0; i < wPos.count; i++) {
        const origZ = wPos.getZ(i);
        const t = (26 - origZ) / 52; // 0 at stern, 1 at tail
        const newZ = -16.0 - t * 48.0; // Starts at stern Z = -16.0m, extends to -64.0m
        const origX = wPos.getX(i);
        // Tapers: narrow at transom (width ~5.5m), expands naturally to 18m
        const widthFactor = 0.24 + Math.pow(t, 0.65) * 0.76;
        wPos.setX(i, origX * widthFactor);
        wPos.setZ(i, newZ);
        wPos.setY(i, 0.04);
    }
    wakeGeo.computeVertexNormals();

    const wakeTex = createWakeTexture();
    const wakeMat = new THREE.MeshBasicMaterial({
        map: wakeTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    wakeMesh.visible = false; // Natively rendered on ocean surface via oceanFragmentShader for seamless wave integration
    boatRoot.add(wakeMesh);

    // Bow spray foam mesh at pointed bow stem Z = +16.0m
    const bowSprayTex = createBowSprayTexture();
    const bowSprayGeo = new THREE.PlaneGeometry(6.5, 4.2);
    bowSprayGeo.rotateX(-Math.PI * 0.42);
    const bowSprayMat = new THREE.MeshBasicMaterial({
        map: bowSprayTex,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const bowSprayMesh = new THREE.Mesh(bowSprayGeo, bowSprayMat);
    bowSprayMesh.position.set(0, 0.35, 15.8);
    bowSprayMesh.visible = false; // Natively rendered on ocean surface via oceanFragmentShader
    boatRoot.add(bowSprayMesh);

    // ═══════════════════════════════════════════════════════════
    // 8. NAVIGATION LIGHTS CONTROLLER
    // ═══════════════════════════════════════════════════════════
    const portNavLight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.18), matPortNav);
    portNavLight.position.set(-3.0, 3.8, 3.8);
    cabinAssembly.add(portNavLight);

    const starNavLight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 0.18), matStarNav);
    starNavLight.position.set(3.0, 3.8, 3.8);
    cabinAssembly.add(starNavLight);

    const nightLights = {
        setIntensity(val) {
            matPortNav.emissiveIntensity = val * 2.2;
            matStarNav.emissiveIntensity = val * 2.2;
            matMastNav.emissiveIntensity = val * 2.5;
            cabinGlowLight.intensity = val * 2.2;
        }
    };

    // ═══════════════════════════════════════════════════════════
    // 9. ANIMATION & PROPULSION CONTROLLER
    // ═══════════════════════════════════════════════════════════
    const flagVertsUmeshAft = flagGeoUmeshAft.attributes.position;
    const flagVertsUmeshFore = flagGeoUmeshFore.attributes.position;
    const origPosUmesh = flagVertsUmeshAft.array.slice();

    const flagVertsSIHAft = flagGeoSIHAft.attributes.position;
    const flagVertsSIHFore = flagGeoSIHFore.attributes.position;
    const origPosSIH = flagVertsSIHAft.array.slice();

    function update(elapsed, delta, isStorm = false, speed = 0.0) {
        // A. Rotate Radar Scanner
        if (radarScanner) {
            radarScanner.rotation.y += delta * 2.8;
        }

        // B. Rotate Underwater Propeller when moving
        if (propGroup) {
            if (Math.abs(speed) > 0.1) {
                propGroup.rotation.z += delta * speed * 1.8;
            }
        }

        // C. Realistic Cloth Flag Flutter Animation
        const waveSpeed = isStorm ? 9.5 : 4.8;
        const waveAmp = isStorm ? 0.38 : 0.18;
        const t = elapsed * waveSpeed;

        // Flag 1 (Umesh)
        for (let i = 0; i < flagVertsUmeshAft.count; i++) {
            const ox = origPosUmesh[i * 3];
            const oy = origPosUmesh[i * 3 + 1];
            const edgeWeight = Math.min(1.0, Math.max(0.0, ox / flagW));
            const flutter = Math.sin(t + ox * 1.8) * Math.cos(t * 0.7 + oy * 1.2) * waveAmp * edgeWeight;
            const ripple = Math.sin(t * 2.2 + ox * 3.5) * (waveAmp * 0.35) * edgeWeight;
            const dz = flutter + ripple;
            flagVertsUmeshAft.setZ(i, dz);
            flagVertsUmeshFore.setZ(i, dz);
        }
        flagVertsUmeshAft.needsUpdate = true;
        flagVertsUmeshFore.needsUpdate = true;

        // Flag 2 (SIH 2026 WINNERS)
        for (let i = 0; i < flagVertsSIHAft.count; i++) {
            const ox = origPosSIH[i * 3];
            const oy = origPosSIH[i * 3 + 1];
            const edgeWeight = Math.min(1.0, Math.max(0.0, ox / flagW));
            const flutter = Math.sin(t + 1.2 + ox * 1.8) * Math.cos(t * 0.7 + 0.8 + oy * 1.2) * waveAmp * edgeWeight;
            const ripple = Math.sin(t * 2.2 + 1.5 + ox * 3.5) * (waveAmp * 0.35) * edgeWeight;
            const dz = flutter + ripple;
            flagVertsSIHAft.setZ(i, dz);
            flagVertsSIHFore.setZ(i, dz);
        }
        flagVertsSIHAft.needsUpdate = true;
        flagVertsSIHFore.needsUpdate = true;
    }

    return {
        group: boatRoot,
        wakeMesh,
        bowSprayMesh,
        radarScanner,
        antennaNode,
        nightLights,
        propeller: propGroup,
        update,
    };
}
