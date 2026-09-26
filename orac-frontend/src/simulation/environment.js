import * as THREE from 'three';
import { getGerstnerWaveHeight } from './oceanShaders.js';
import {
    createVillageHouseTexture,
    createVillageNightEmissiveTexture,
    createRoofTexture,
    createNetTexture,
    createRaindropTexture
} from './textures.js';

export function createCloudSystem() {
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

export function createRainSystem() {
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
export function createLightningSystem() {
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
export function createCelestialSystem() {
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


// ===============================================================
// FEATURE A - PROFESSIONAL WATERTIGHT FISHING VESSEL & 3D FISHERMAN
// With Rugged Handheld ORCA Alert Receiver & Offshore Monitoring Buoy
// ===============================================================

export function createOffshoreBuoy() {
    const buoyGroup = new THREE.Group();
    buoyGroup.position.set(180, 0, 240);

    const matBuoyYellow = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.35, metalness: 0.15 });
    const matBuoyOrange = new THREE.MeshStandardMaterial({ color: 0xf5521e, roughness: 0.4 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x3a4248, roughness: 0.4, metalness: 0.7 });
    const matSolar = new THREE.MeshStandardMaterial({ color: 0x11253a, roughness: 0.15, metalness: 0.85 });
    const matStrobe = new THREE.MeshStandardMaterial({ color: 0xffe680, emissive: new THREE.Color(0xffaa00), emissiveIntensity: 1.5, roughness: 0.2 });

    const sparMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 3.2, 16), matBuoyYellow);
    sparMesh.position.y = 0.8;
    buoyGroup.add(sparMesh);

    const collarGeo = new THREE.TorusGeometry(1.7, 0.35, 12, 24);
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, matBuoyOrange);
    collar.position.y = 0.9;
    buoyGroup.add(collar);

    const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.8, 12), matMetal);
    keel.position.y = -1.8;
    buoyGroup.add(keel);

    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.3, 4.2, 6, 1, true), matMetal);
    tower.position.y = 3.6;
    buoyGroup.add(tower);

    for (let s = -1; s <= 1; s += 2) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.7), matSolar);
        panel.position.set(s * 0.9, 4.2, 0);
        panel.rotation.z = -s * 0.4;
        buoyGroup.add(panel);
    }

    const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), matMetal);
    mastPole.position.set(0, 6.4, 0);
    buoyGroup.add(mastPole);

    const strobeDome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), matStrobe);
    strobeDome.position.set(0, 7.6, 0);
    buoyGroup.add(strobeDome);

    const strobeLight = new THREE.PointLight(0xffaa00, 2.0, 55, 1.5);
    strobeLight.position.set(0, 7.7, 0);
    buoyGroup.add(strobeLight);

    return {
        group: buoyGroup,
        position: buoyGroup.position,
        update(time) {
            const waveY = getGerstnerWaveHeight(buoyGroup.position.x, buoyGroup.position.z, time, 1.0);
            buoyGroup.position.y = waveY + 0.1;
            buoyGroup.rotation.z = Math.sin(time * 1.6) * 0.06;
            buoyGroup.rotation.x = Math.cos(time * 1.4) * 0.05;
            const flash = (Math.sin(time * 6.0) > 0.6) ? 2.5 : 0.4;
            matStrobe.emissiveIntensity = flash;
            strobeLight.intensity = flash * 1.2;
        }
    };
}

export function createCoastalEnvironment() {
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

    // 5. Authentic Indian Coastal Fishing Village
    // Inspired by South Indian / Bay of Bengal tropical fishing coast (Kovalam/Kerala)
    // Low-rise single-story cottages, traditional wooden beach boats, net drying racks,
    // utility poles, rocky coastal boulders, and the ORCA Coastal Warning Beacon.

    const wallCreamTex = createVillageHouseTexture('cottage_cream');
    const wallBlueTex = createVillageHouseTexture('cottage_blue');
    const wallTerraTex = createVillageHouseTexture('cottage_terra');

    const wallCreamEmissive = createVillageNightEmissiveTexture('cottage_cream');
    const wallBlueEmissive = createVillageNightEmissiveTexture('cottage_blue');
    const wallTerraEmissive = createVillageNightEmissiveTexture('cottage_terra');

    const roofTilesTex = createRoofTexture('tiles');
    const roofTinTex = createRoofTexture('tin');

    const matWallCream = new THREE.MeshStandardMaterial({
        map: wallCreamTex,
        emissiveMap: wallCreamEmissive,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.88,
        metalness: 0.02,
    });

    const matWallBlue = new THREE.MeshStandardMaterial({
        map: wallBlueTex,
        emissiveMap: wallBlueEmissive,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.85,
        metalness: 0.02,
    });

    const matWallTerra = new THREE.MeshStandardMaterial({
        map: wallTerraTex,
        emissiveMap: wallTerraEmissive,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.0,
        roughness: 0.90,
        metalness: 0.02,
    });

    const matRoofTiles = new THREE.MeshStandardMaterial({
        map: roofTilesTex,
        roughness: 0.75,
        metalness: 0.05,
    });

    const matRoofTin = new THREE.MeshStandardMaterial({
        map: roofTinTex,
        roughness: 0.55,
        metalness: 0.35,
    });

    const matDarkWood = new THREE.MeshStandardMaterial({
        color: 0x3d2719,
        roughness: 0.85,
    });

    const matRockBoulders = new THREE.MeshStandardMaterial({
        color: 0x5a554c,
        roughness: 0.95,
        flatShading: true,
    });

    const matWarningLantern = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(0xffaa00),
        emissiveIntensity: 0.0,
        roughness: 0.2,
    });

    const matNet = new THREE.MeshStandardMaterial({
        map: createNetTexture(),
        roughness: 0.85,
        transparent: true,
        side: THREE.DoubleSide,
    });

    // -- A. Low-Rise Village Fishing Houses --
    const villageXs = [];
    for (let vx = -760; vx <= 760; vx += 36) {
        if (Math.abs(vx) > 30 || Math.random() > 0.4) {
            villageXs.push(vx);
        }
    }

    villageXs.forEach(vx => {
        const curveOffset = Math.sin(vx * 0.0035) * 42 + Math.cos(vx * 0.007) * 22;
        const rows = [0, 1];
        rows.forEach(r => {
            if (r === 1 && Math.random() < 0.25) return; // Natural organic gaps

            const rowZ = -775 - r * 50 + curveOffset - (Math.random() - 0.5) * 16;
            const rowY = 5.2 + r * 4.5;

            const houseW = 8.5 + (Math.random() - 0.5) * 3.0;
            const houseD = 9.5 + (Math.random() - 0.5) * 3.0;
            const houseH = 3.6 + Math.random() * 1.0;

            const houseGroup = new THREE.Group();
            houseGroup.position.set(vx + (Math.random() - 0.5) * 10, rowY, rowZ);
            houseGroup.rotation.y = (Math.random() - 0.5) * 0.35;

            // Main Walls
            const rType = Math.random();
            const wallMat = rType < 0.45 ? matWallCream : (rType < 0.75 ? matWallBlue : matWallTerra);
            const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(houseW, houseH, houseD), wallMat);
            wallMesh.position.set(0, houseH / 2, 0);
            houseGroup.add(wallMesh);

            // Sloped Gabled Roof
            const roofMat = Math.random() > 0.4 ? matRoofTiles : matRoofTin;
            const roofH = 2.4 + Math.random() * 0.6;
            const roofGeo = new THREE.ConeGeometry(Math.max(houseW, houseD) * 0.75, roofH, 4);
            roofGeo.rotateY(Math.PI / 4);
            const roofMesh = new THREE.Mesh(roofGeo, roofMat);
            roofMesh.position.set(0, houseH + roofH / 2, 0);
            roofMesh.scale.set(houseW / Math.max(houseW, houseD) * 1.12, 1.0, houseD / Math.max(houseW, houseD) * 1.12);
            houseGroup.add(roofMesh);

            // Wooden Front Veranda / Porch
            const porchW = houseW * 0.7;
            const porchD = 2.2;
            const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(porchW, 0.2, porchD), roofMat);
            porchRoof.position.set(0, houseH * 0.78, houseD / 2 + porchD / 2);
            porchRoof.rotation.x = 0.14;
            houseGroup.add(porchRoof);

            for (let side = -1; side <= 1; side += 2) {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, houseH * 0.8, 6), matDarkWood);
                post.position.set(side * (porchW / 2 - 0.2), houseH * 0.4, houseD / 2 + porchD - 0.2);
                houseGroup.add(post);
            }

            coastalGroup.add(houseGroup);
        });
    });

    // -- B. Traditional Wooden Beach Fishing Boats (Vallams) --
    const boatFolkPaints = [
        { hull: 0x1877f2, trim: 0xd32f2f, x: -140, zOff: -658, rot: 0.12 },
        { hull: 0xc62828, trim: 0xfbc02d, x: -45,  zOff: -666, rot: -0.18 },
        { hull: 0xf9a825, trim: 0x00b4d8, x: 65,   zOff: -662, rot: 0.24 },
        { hull: 0xf0f4f8, trim: 0xff6f00, x: 175,  zOff: -670, rot: -0.10 },
    ];

    boatFolkPaints.forEach(bp => {
        const curveOffset = Math.sin(bp.x * 0.0035) * 42 + Math.cos(bp.x * 0.007) * 22;
        const bGroup = new THREE.Group();
        bGroup.position.set(bp.x, 1.4, bp.zOff + curveOffset);
        bGroup.rotation.y = bp.rot;
        bGroup.rotation.z = -0.08;

        const matHullPaint = new THREE.MeshStandardMaterial({ color: bp.hull, roughness: 0.55 });
        const matTrimPaint = new THREE.MeshStandardMaterial({ color: bp.trim, roughness: 0.45 });

        const canoeHullGeo = new THREE.CylinderGeometry(1.3, 0.4, 8.5, 12, 1, false);
        canoeHullGeo.rotateZ(Math.PI / 2);
        canoeHullGeo.scale(1.0, 0.7, 1.0);
        const canoeHull = new THREE.Mesh(canoeHullGeo, matHullPaint);
        bGroup.add(canoeHull);

        const trimGeo = new THREE.TorusGeometry(3.8, 0.12, 8, 24, Math.PI);
        trimGeo.rotateX(Math.PI / 2);
        const trimMesh = new THREE.Mesh(trimGeo, matTrimPaint);
        trimMesh.position.set(0, 0.55, 0);
        trimMesh.scale.set(1.1, 0.35, 1.0);
        bGroup.add(trimMesh);

        for (let t = -2.2; t <= 2.2; t += 2.2) {
            const bench = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 1.9), matDarkWood);
            bench.position.set(t, 0.35, 0);
            bGroup.add(bench);
        }

        const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 5.2, 6), matDarkWood);
        oar.rotation.z = 0.28;
        oar.rotation.y = 0.15;
        oar.position.set(0.5, 0.6, 0.2);
        bGroup.add(oar);

        coastalGroup.add(bGroup);
    });

    // -- C. Fishing Net Drying Racks --
    const rackXs = [-220, -110, 20, 130, 240];
    rackXs.forEach(rx => {
        const curveOffset = Math.sin(rx * 0.0035) * 42 + Math.cos(rx * 0.007) * 22;
        const rackGroup = new THREE.Group();
        rackGroup.position.set(rx, 2.2, -675 + curveOffset);
        rackGroup.rotation.y = (Math.random() - 0.5) * 0.4;

        for (let p = -3.2; p <= 3.2; p += 6.4) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 3.4, 6), matDarkWood);
            pole.position.set(p, 1.7, 0);
            rackGroup.add(pole);
        }
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.2, 6), matDarkWood);
        beam.rotateZ(Math.PI / 2);
        beam.position.set(0, 3.2, 0);
        rackGroup.add(beam);

        const netDrapeGeo = new THREE.PlaneGeometry(6.4, 2.6, 6, 6);
        netDrapeGeo.rotateX(-0.15);
        const netDrape = new THREE.Mesh(netDrapeGeo, matNet);
        netDrape.position.set(0, 1.8, 0.1);
        rackGroup.add(netDrape);

        coastalGroup.add(rackGroup);
    });

    // -- D. Coastal Utility Poles --
    for (let ux = -680; ux <= 680; ux += 160) {
        const curveOffset = Math.sin(ux * 0.0035) * 42 + Math.cos(ux * 0.007) * 22;
        const poleGroup = new THREE.Group();
        poleGroup.position.set(ux, 5.0, -745 + curveOffset);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 9.0, 8), matDarkWood);
        pole.position.set(0, 4.5, 0);
        poleGroup.add(pole);

        const crossarm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), matDarkWood);
        crossarm.position.set(0, 8.2, 0);
        poleGroup.add(crossarm);

        coastalGroup.add(poleGroup);
    }

    // -- E. Weathered Coastal Rock Boulders (Matching Photo Reference) --
    const rockClusters = [
        { cx: -260, cz: -648, count: 6 },
        { cx: -180, cz: -642, count: 5 },
        { cx: 210,  cz: -645, count: 7 },
        { cx: 320,  cz: -652, count: 6 },
    ];

    rockClusters.forEach(cluster => {
        for (let i = 0; i < cluster.count; i++) {
            const curveOffset = Math.sin(cluster.cx * 0.0035) * 42 + Math.cos(cluster.cx * 0.007) * 22;
            const rSize = 2.0 + Math.random() * 3.5;
            const rockGeo = new THREE.DodecahedronGeometry(rSize, 1);
            const rock = new THREE.Mesh(rockGeo, matRockBoulders);
            rock.scale.set(1.0 + Math.random() * 0.6, 0.65 + Math.random() * 0.4, 1.0 + Math.random() * 0.6);
            rock.position.set(
                cluster.cx + (Math.random() - 0.5) * 24,
                rSize * 0.35,
                cluster.cz + curveOffset + (Math.random() - 0.5) * 16
            );
            rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            coastalGroup.add(rock);
        }
    });

    // -- F. ORCA Coastal Warning Tower / Loudspeaker Mast & Beacon --
    const beaconX = 0;
    const beaconZ = -646 + Math.sin(beaconX * 0.0035) * 42 + Math.cos(beaconX * 0.007) * 22;
    const beaconY = 4.8;

    const beaconMastGroup = new THREE.Group();
    beaconMastGroup.position.set(beaconX, beaconY, beaconZ);

    const mastGeo = new THREE.CylinderGeometry(0.25, 0.45, 16.0, 8);
    const mastMesh = new THREE.Mesh(mastGeo, matRoofTin);
    mastMesh.position.set(0, 8.0, 0);
    beaconMastGroup.add(mastMesh);

    const equipBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 1.2), matRoofTin);
    equipBox.position.set(0, 1.2, 0);
    beaconMastGroup.add(equipBox);

    const platGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.25, 8);
    const platMesh = new THREE.Mesh(platGeo, matRoofTin);
    platMesh.position.set(0, 12.5, 0);
    beaconMastGroup.add(platMesh);

    const railGeo = new THREE.CylinderGeometry(1.85, 1.85, 1.0, 8, 1, true);
    const railMesh = new THREE.Mesh(railGeo, matRoofTin);
    railMesh.position.set(0, 13.0, 0);
    beaconMastGroup.add(railMesh);

    for (let h = -1; h <= 1; h += 2) {
        const hornGeo = new THREE.ConeGeometry(0.45, 1.1, 8);
        hornGeo.rotateX(Math.PI / 2);
        const horn = new THREE.Mesh(hornGeo, matRoofTin);
        horn.position.set(h * 0.7, 13.5, 0.6);
        beaconMastGroup.add(horn);
    }

    const beaconDomeGeo = new THREE.SphereGeometry(0.7, 12, 12);
    const beaconDome = new THREE.Mesh(beaconDomeGeo, matWarningLantern);
    beaconDome.position.set(0, 16.2, 0);
    beaconMastGroup.add(beaconDome);

    const beaconLight = new THREE.PointLight(0xffaa00, 2.5, 90, 1.2);
    beaconLight.position.set(0, 16.5, 0);
    beaconMastGroup.add(beaconLight);

    coastalGroup.add(beaconMastGroup);

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
        cityMaterials: [matWallCream, matWallBlue, matWallTerra, matRoofTiles, matRoofTin],
        streetLightMat: matWarningLantern,
        beaconPos: new THREE.Vector3(0, 20.8, -645),
    };

    return coastalGroup;
}

// ═══════════════════════════════════════════════════════════════
// BOAT NAVIGATION CONTROLLER
// ═══════════════════════════════════════════════════════════════

