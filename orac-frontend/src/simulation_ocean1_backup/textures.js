import * as THREE from 'three';

export function createMarkingTexture(text) {
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
export function createDeckTexture() {
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
export function createNetTexture() {
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

// ---------------------------------------------------------------
// PROCEDURAL INDIAN COASTAL VILLAGE TEXTURES
// Realistic lime plaster, terracotta, weathered tin, thatched roofs
// ---------------------------------------------------------------

export function createVillageHouseTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (type === 'cottage_cream') {
        // Weathered lime-washed warm cream wall
        ctx.fillStyle = '#f0e6d2';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 400; i++) {
            const gx = Math.random() * 256;
            const gy = Math.random() * 256;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(215, 195, 170, 0.35)' : 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(gx, gy, Math.random() * 8 + 2, Math.random() * 6 + 2);
        }
        // Wooden door
        ctx.fillStyle = '#4a2f1c';
        ctx.fillRect(96, 120, 64, 136);
        ctx.fillStyle = '#341f12';
        ctx.fillRect(100, 124, 26, 128);
        ctx.fillRect(130, 124, 26, 128);
        // Small wooden shuttered window
        ctx.fillStyle = '#26333d';
        ctx.fillRect(28, 70, 48, 48);
        ctx.fillStyle = '#1b2229';
        ctx.fillRect(32, 74, 40, 40);
        ctx.strokeStyle = '#5a3d28';
        ctx.lineWidth = 4;
        ctx.strokeRect(28, 70, 48, 48);
    } else if (type === 'cottage_blue') {
        // Traditional coastal washed cerulean/teal wall
        ctx.fillStyle = '#5c9ea8';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 350; i++) {
            const gx = Math.random() * 256;
            const gy = Math.random() * 256;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(70, 130, 140, 0.4)' : 'rgba(120, 180, 190, 0.3)';
            ctx.fillRect(gx, gy, Math.random() * 10 + 3, Math.random() * 6 + 2);
        }
        ctx.fillStyle = '#3b6a72';
        ctx.fillRect(0, 220, 256, 36);
        ctx.fillStyle = '#3e2718';
        ctx.fillRect(104, 115, 48, 141);
        ctx.fillStyle = '#1e2d33';
        ctx.fillRect(36, 68, 44, 44);
        ctx.strokeStyle = '#2b1b11';
        ctx.lineWidth = 3;
        ctx.strokeRect(36, 68, 44, 44);
    } else {
        // Warm terracotta / earth tone wall
        ctx.fillStyle = '#c47853';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 350; i++) {
            const gx = Math.random() * 256;
            const gy = Math.random() * 256;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(165, 90, 60, 0.35)' : 'rgba(215, 140, 100, 0.25)';
            ctx.fillRect(gx, gy, Math.random() * 8 + 3, Math.random() * 6 + 2);
        }
        ctx.fillStyle = '#8f4f32';
        ctx.fillRect(0, 225, 256, 31);
        ctx.fillStyle = '#3a2012';
        ctx.fillRect(100, 120, 56, 136);
        ctx.fillStyle = '#1f1610';
        ctx.fillRect(180, 72, 46, 46);
        ctx.strokeStyle = '#5a341e';
        ctx.lineWidth = 3;
        ctx.strokeRect(180, 72, 46, 46);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Procedural village night emissive windows texture
export function createVillageNightEmissiveTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Pitch black base
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 256);

    // Warm, cozy glowing window
    if (type === 'cottage_cream') {
        const glow = ctx.createRadialGradient(52, 94, 2, 52, 94, 26);
        glow.addColorStop(0.0, 'rgb(255, 215, 120)');
        glow.addColorStop(0.7, 'rgb(255, 170, 50)');
        glow.addColorStop(1.0, '#000000');
        ctx.fillStyle = glow;
        ctx.fillRect(30, 72, 44, 44);
    } else if (type === 'cottage_blue') {
        const glow = ctx.createRadialGradient(58, 90, 2, 58, 90, 24);
        glow.addColorStop(0.0, 'rgb(255, 225, 140)');
        glow.addColorStop(0.7, 'rgb(255, 180, 60)');
        glow.addColorStop(1.0, '#000000');
        ctx.fillStyle = glow;
        ctx.fillRect(36, 68, 44, 44);
    } else {
        const glow = ctx.createRadialGradient(203, 95, 2, 203, 95, 24);
        glow.addColorStop(0.0, 'rgb(255, 200, 100)');
        glow.addColorStop(0.7, 'rgb(240, 150, 40)');
        glow.addColorStop(1.0, '#000000');
        ctx.fillStyle = glow;
        ctx.fillRect(180, 72, 46, 46);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Procedural roof textures (Terracotta tiles & Corrugated tin)
export function createRoofTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (type === 'tiles') {
        ctx.fillStyle = '#b85433';
        ctx.fillRect(0, 0, 256, 256);
        const rows = 16;
        const rowH = 256 / rows;
        for (let r = 0; r < rows; r++) {
            ctx.fillStyle = (r % 2 === 0) ? '#a04426' : '#cc613d';
            ctx.fillRect(0, r * rowH, 256, rowH - 2);
            ctx.fillStyle = '#6e2b15';
            ctx.fillRect(0, r * rowH + rowH - 2, 256, 2);
            for (let c = 0; c < 8; c++) {
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fillRect(c * 32 + (r % 2) * 16, r * rowH, 2, rowH);
            }
        }
    } else {
        ctx.fillStyle = '#7a858c';
        ctx.fillRect(0, 0, 256, 256);
        const ribs = 32;
        const ribW = 256 / ribs;
        for (let i = 0; i < ribs; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#8d99a0' : '#657077';
            ctx.fillRect(i * ribW, 0, ribW, 256);
        }
        for (let i = 0; i < 60; i++) {
            const rx = Math.random() * 256;
            const ry = Math.random() * 256;
            ctx.fillStyle = 'rgba(160, 80, 40, 0.35)';
            ctx.fillRect(rx, ry, Math.random() * 12 + 4, Math.random() * 8 + 3);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Hydrodynamic Boat Wake Texture (Twin wash crests and bubbly foam trail)
export function createWakeTexture() {
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
export function createBowSprayMesh() {
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
export function createRaindropTexture() {
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
