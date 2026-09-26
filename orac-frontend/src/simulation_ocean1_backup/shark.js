// ═══════════════════════════════════════════════════════════════
// GREAT WHITE SHARK — 3D APEX MARINE PREDATOR
// Reference Image 2 Anatomy + Articulated Spine Swimming +
// Surface Dorsal Fin Cruising + Trailing Wake + Breaching
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { SHARK_CONFIG } from './config.js';
import { getSeabedHeight } from './seabed.js';

// ─── Procedural Great White Shark Model Builder ───────────────
// Constructs a detailed 3D Great White Shark matching Reference Image 2:
// Conical snout, dark eyes, 5 gill slits, open jaw with serrated teeth,
// prominent triangular dorsal fin, long swept pectoral wings, caudal keels,
// heterocercal tail, and authentic counter-shading PBR materials.
function buildSharkModel() {
    const sharkRoot = new THREE.Group();

    // ── Counter-Shaded PBR Shark Skin Materials ──
    // Dorsal: deep slate charcoal / oceanic blue-grey
    const matDorsal = new THREE.MeshStandardMaterial({
        color: 0x222e38,
        roughness: 0.38,
        metalness: 0.15,
        flatShading: false,
    });
    // Ventral: clean crisp off-white / pale belly (Counter-shading)
    const matVentral = new THREE.MeshStandardMaterial({
        color: 0xe6edf2,
        roughness: 0.42,
        metalness: 0.1,
        flatShading: false,
    });
    // Menacing dark eyes
    const matEye = new THREE.MeshBasicMaterial({ color: 0x050505 });
    // Mouth interior & gums
    const matMouth = new THREE.MeshStandardMaterial({
        color: 0x5a1820,
        roughness: 0.6,
    });
    // Sharp serrated white teeth
    const matTeeth = new THREE.MeshStandardMaterial({
        color: 0xf5f8fa,
        roughness: 0.2,
    });

    // ── Segment 1: Main Torso & Head ──
    const torsoGroup = new THREE.Group();
    sharkRoot.add(torsoGroup);

    // Torso Upper Half (Dorsal)
    const torsoUpperGeo = new THREE.CylinderGeometry(1.4, 1.7, 4.2, 16, 4, false, 0, Math.PI);
    torsoUpperGeo.rotateX(Math.PI / 2);
    torsoUpperGeo.rotateZ(Math.PI);
    torsoUpperGeo.scale(1.0, 0.9, 1.0);
    const torsoUpper = new THREE.Mesh(torsoUpperGeo, matDorsal);
    torsoUpper.position.set(0, 0, 0);
    torsoGroup.add(torsoUpper);

    // Torso Lower Half (Ventral White Belly)
    const torsoLowerGeo = new THREE.CylinderGeometry(1.4, 1.7, 4.2, 16, 4, false, Math.PI, Math.PI);
    torsoLowerGeo.rotateX(Math.PI / 2);
    torsoLowerGeo.rotateZ(Math.PI);
    torsoLowerGeo.scale(1.0, 0.75, 1.0);
    const torsoLower = new THREE.Mesh(torsoLowerGeo, matVentral);
    torsoLower.position.set(0, 0, 0);
    torsoGroup.add(torsoLower);

    // ── Head & Snout (Upper) ──
    const snoutUpperGeo = new THREE.ConeGeometry(1.4, 3.2, 16, 3, false, 0, Math.PI);
    snoutUpperGeo.rotateX(-Math.PI / 2);
    snoutUpperGeo.rotateZ(Math.PI);
    snoutUpperGeo.scale(0.95, 0.8, 1.0);
    const snoutUpper = new THREE.Mesh(snoutUpperGeo, matDorsal);
    snoutUpper.position.set(0, 0, 3.7);
    torsoGroup.add(snoutUpper);

    // Head Under-jaw & Gills (Ventral)
    const snoutLowerGeo = new THREE.ConeGeometry(1.35, 2.7, 16, 3, false, Math.PI, Math.PI);
    snoutLowerGeo.rotateX(-Math.PI / 2);
    snoutLowerGeo.rotateZ(Math.PI);
    snoutLowerGeo.scale(0.9, 0.65, 1.0);
    const snoutLower = new THREE.Mesh(snoutLowerGeo, matVentral);
    snoutLower.position.set(0, -0.22, 3.45);
    torsoGroup.add(snoutLower);

    // Mouth Opening Cavity & Teeth
    const mouthCavityGeo = new THREE.BoxGeometry(1.4, 0.45, 1.2);
    const mouthCavity = new THREE.Mesh(mouthCavityGeo, matMouth);
    mouthCavity.position.set(0, -0.25, 3.5);
    torsoGroup.add(mouthCavity);

    // Rows of Teeth (Upper & Lower)
    const toothGeo = new THREE.ConeGeometry(0.08, 0.22, 4);
    toothGeo.rotateX(Math.PI);
    for (let t = -5; t <= 5; t++) {
        const angle = (t / 6) * 0.9;
        const tx = Math.sin(angle) * 0.65;
        const tz = 3.6 + Math.cos(angle) * 0.45;

        // Upper tooth
        const upperTooth = new THREE.Mesh(toothGeo, matTeeth);
        upperTooth.position.set(tx, -0.06, tz);
        upperTooth.rotation.z = angle * 0.4;
        torsoGroup.add(upperTooth);

        // Lower tooth
        const lowerTooth = new THREE.Mesh(toothGeo, matTeeth);
        lowerTooth.rotation.x = Math.PI;
        lowerTooth.position.set(tx * 0.92, -0.42, tz - 0.12);
        torsoGroup.add(lowerTooth);
    }

    // Eyes (Dark glossy predatory orbs)
    const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, matEye);
    leftEye.position.set(0.92, 0.28, 3.4);
    torsoGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, matEye);
    rightEye.position.set(-0.92, 0.28, 3.4);
    torsoGroup.add(rightEye);

    // 5 Gill Slits on each flank
    const gillMat = new THREE.MeshBasicMaterial({ color: 0x11161a });
    const gillGeo = new THREE.BoxGeometry(0.05, 0.55, 0.04);
    for (let g = 0; g < 5; g++) {
        const gz = 1.6 + g * 0.28;
        const gLeft = new THREE.Mesh(gillGeo, gillMat);
        gLeft.position.set(1.42, -0.05, gz);
        gLeft.rotation.z = -0.15;
        torsoGroup.add(gLeft);

        const gRight = new THREE.Mesh(gillGeo, gillMat);
        gRight.position.set(-1.42, -0.05, gz);
        gRight.rotation.z = 0.15;
        torsoGroup.add(gRight);
    }

    // ── Signature Triangular Dorsal Fin ──
    // Prominent triangular fin matching Reference Image 2
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.quadraticCurveTo(0.3, 1.8, -0.45, 2.75); // curved leading edge to sharp tip
    dorsalShape.quadraticCurveTo(-0.75, 1.4, -1.9, 0.45); // trailing edge with recurve notch
    dorsalShape.lineTo(-1.7, 0);
    dorsalShape.closePath();

    const dorsalExtrudeSettings = {
        depth: 0.22,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.08,
        bevelThickness: 0.08,
    };
    const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, dorsalExtrudeSettings);
    dorsalGeo.rotateY(Math.PI / 2);
    dorsalGeo.center();
    const dorsalFin = new THREE.Mesh(dorsalGeo, matDorsal);
    dorsalFin.position.set(0, 2.2, 0.1);
    dorsalFin.rotation.y = Math.PI;
    torsoGroup.add(dorsalFin);

    // ── Pectoral Wings (Left & Right) ──
    const pectShape = new THREE.Shape();
    pectShape.moveTo(0, 0);
    pectShape.quadraticCurveTo(1.6, -0.3, 3.4, -1.5); // long swept leading edge
    pectShape.quadraticCurveTo(2.2, -1.4, 0.8, -0.9);  // trailing edge
    pectShape.closePath();

    const pectExtrudeSettings = {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
    };

    // Right Pectoral Wing
    const pectRightGeo = new THREE.ExtrudeGeometry(pectShape, pectExtrudeSettings);
    pectRightGeo.center();
    const pectRight = new THREE.Mesh(pectRightGeo, matDorsal);
    pectRight.position.set(2.4, -0.5, 1.2);
    pectRight.rotation.set(0.15, -0.25, -0.35); // swept down and back
    torsoGroup.add(pectRight);

    // Left Pectoral Wing
    const pectLeftGeo = new THREE.ExtrudeGeometry(pectShape, pectExtrudeSettings);
    pectLeftGeo.center();
    const pectLeft = new THREE.Mesh(pectLeftGeo, matDorsal);
    pectLeft.position.set(-2.4, -0.5, 1.2);
    pectLeft.scale.set(-1, 1, 1);
    pectLeft.rotation.set(0.15, 0.25, 0.35);
    torsoGroup.add(pectLeft);

    // ── Segment 2: Articulated Mid-Body ──
    const midGroup = new THREE.Group();
    midGroup.position.set(0, 0, -2.1); // pivot at rear of torso
    torsoGroup.add(midGroup);

    const midUpperGeo = new THREE.CylinderGeometry(0.9, 1.4, 3.2, 14, 3, false, 0, Math.PI);
    midUpperGeo.rotateX(Math.PI / 2);
    midUpperGeo.rotateZ(Math.PI);
    midUpperGeo.scale(1.0, 0.85, 1.0);
    const midUpper = new THREE.Mesh(midUpperGeo, matDorsal);
    midUpper.position.set(0, 0, -1.6);
    midGroup.add(midUpper);

    const midLowerGeo = new THREE.CylinderGeometry(0.9, 1.4, 3.2, 14, 3, false, Math.PI, Math.PI);
    midLowerGeo.rotateX(Math.PI / 2);
    midLowerGeo.rotateZ(Math.PI);
    midLowerGeo.scale(1.0, 0.7, 1.0);
    const midLower = new THREE.Mesh(midLowerGeo, matVentral);
    midLower.position.set(0, 0, -1.6);
    midGroup.add(midLower);

    // Pelvic Fins
    const pelvicGeo = new THREE.ConeGeometry(0.45, 1.1, 4);
    pelvicGeo.rotateZ(Math.PI / 2);
    const pelvicLeft = new THREE.Mesh(pelvicGeo, matVentral);
    pelvicLeft.position.set(0.95, -0.65, -2.5);
    pelvicLeft.rotation.set(0.2, 0.1, -0.5);
    midGroup.add(pelvicLeft);

    const pelvicRight = new THREE.Mesh(pelvicGeo, matVentral);
    pelvicRight.position.set(-0.95, -0.65, -2.5);
    pelvicRight.rotation.set(0.2, -0.1, 0.5);
    midGroup.add(pelvicRight);

    // ── Segment 3: Caudal Peduncle with 2nd Dorsal & Keels ──
    const peduncleGroup = new THREE.Group();
    peduncleGroup.position.set(0, 0, -3.2); // pivot at rear of mid-body
    midGroup.add(peduncleGroup);

    const peduncleGeo = new THREE.CylinderGeometry(0.35, 0.9, 2.6, 12, 2);
    peduncleGeo.rotateX(Math.PI / 2);
    peduncleGeo.scale(0.7, 0.85, 1.0);
    const peduncle = new THREE.Mesh(peduncleGeo, matDorsal);
    peduncle.position.set(0, 0, -1.3);
    peduncleGroup.add(peduncle);

    // Small 2nd dorsal fin
    const dorsal2Geo = new THREE.ConeGeometry(0.28, 0.65, 3);
    dorsal2Geo.rotateX(-0.5);
    const dorsal2 = new THREE.Mesh(dorsal2Geo, matDorsal);
    dorsal2.position.set(0, 0.65, -1.1);
    peduncleGroup.add(dorsal2);

    // Anal fin
    const analFin = new THREE.Mesh(dorsal2Geo, matVentral);
    analFin.position.set(0, -0.62, -1.4);
    analFin.rotation.x = Math.PI;
    peduncleGroup.add(analFin);

    // Lateral keels on caudal peduncle (stabilizers)
    const keelGeo = new THREE.BoxGeometry(1.1, 0.08, 1.6);
    const keel = new THREE.Mesh(keelGeo, matDorsal);
    keel.position.set(0, 0, -1.7);
    peduncleGroup.add(keel);

    // ── Segment 4: Heterocercal Caudal (Tail) Fin ──
    const tailFinGroup = new THREE.Group();
    tailFinGroup.position.set(0, 0, -2.6); // pivot at peduncle
    peduncleGroup.add(tailFinGroup);

    // Tail fin shape (large upper lobe, distinct lower lobe - Reference 2)
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.quadraticCurveTo(-0.8, 1.8, -2.4, 2.85); // upper lobe leading edge
    tailShape.quadraticCurveTo(-2.1, 1.6, -1.3, 0.45);  // upper lobe trailing notch
    tailShape.quadraticCurveTo(-1.8, -0.6, -2.0, -1.95); // lower lobe tip
    tailShape.quadraticCurveTo(-1.1, -1.2, 0, 0);       // lower return
    tailShape.closePath();

    const tailExtrudeSettings = {
        depth: 0.16,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
    };
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, tailExtrudeSettings);
    tailGeo.rotateY(Math.PI / 2);
    tailGeo.center();
    const tailFin = new THREE.Mesh(tailGeo, matDorsal);
    tailFin.position.set(0, 0.35, -1.2);
    tailFin.rotation.y = Math.PI;
    tailFinGroup.add(tailFin);

    return {
        root: sharkRoot,
        torso: torsoGroup,
        midBody: midGroup,
        peduncle: peduncleGroup,
        tailFin: tailFinGroup,
        dorsalFin,
        materials: [matDorsal, matVentral, matEye, matMouth, matTeeth],
    };
}

// ─── Surface Wake & Splash Effects ─────────────────────────────
function createSharkWake() {
    const wakeGroup = new THREE.Group();

    // Trailing V-shaped foam wake behind dorsal fin on surface
    const wakeGeo = new THREE.PlaneGeometry(8, 22, 16, 24);
    wakeGeo.rotateX(-Math.PI / 2);

    const wakeTexCanvas = document.createElement('canvas');
    wakeTexCanvas.width = 256;
    wakeTexCanvas.height = 512;
    const ctx = wakeTexCanvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.25, 'rgba(235,248,255,0.6)');
    grad.addColorStop(0.7, 'rgba(200,235,255,0.25)');
    grad.addColorStop(1.0, 'rgba(200,235,255,0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(128, 20);
    ctx.lineTo(240, 500);
    ctx.lineTo(16, 500);
    ctx.closePath();
    ctx.fill();

    const wakeTex = new THREE.CanvasTexture(wakeTexCanvas);

    const wakeMat = new THREE.MeshBasicMaterial({
        map: wakeTex,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    wakeMesh.position.set(0, 0.08, -10.0);
    wakeGroup.add(wakeMesh);

    // Splash spray particles for breaching
    const splashCount = 90;
    const splashGeo = new THREE.BufferGeometry();
    const splashPos = new Float32Array(splashCount * 3);
    const splashVel = new Float32Array(splashCount * 3);

    for (let i = 0; i < splashCount; i++) {
        splashPos[i * 3 + 0] = 0;
        splashPos[i * 3 + 1] = 0;
        splashPos[i * 3 + 2] = 0;

        splashVel[i * 3 + 0] = (Math.random() - 0.5) * 8.0;
        splashVel[i * 3 + 1] = 4.0 + Math.random() * 8.0;
        splashVel[i * 3 + 2] = (Math.random() - 0.5) * 8.0;
    }

    splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
    const splashMat = new THREE.PointsMaterial({
        color: 0xe6f5ff,
        size: 1.4,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
    const splashPoints = new THREE.Points(splashGeo, splashMat);
    wakeGroup.add(splashPoints);

    return {
        group: wakeGroup,
        wakeMesh,
        wakeMat,
        splashPoints,
        splashMat,
        splashVel,
        splashPos,
    };
}

// ─── Main Shark System Factory ─────────────────────────────────
export function createSharkSystem() {
    const shark = buildSharkModel();
    const wake = createSharkWake();

    const sharkContainer = new THREE.Group();
    sharkContainer.add(shark.root);
    sharkContainer.add(wake.group);

    // World state
    const patrolPoints = SHARK_CONFIG.patrolPoints;
    let currentPatrolIdx = 0;
    const position = new THREE.Vector3(patrolPoints[0].x, patrolPoints[0].y, patrolPoints[0].z);
    const velocity = new THREE.Vector3(1, 0, 0).multiplyScalar(SHARK_CONFIG.speed);
    let heading = 0.0;
    let pitch = 0.0;
    let roll = 0.0;

    // AI Behavioral State Machine
    // 'CRUISING' (deep ocean patrol), 'SURFACING' (cruising surface with dorsal fin out), 'BREACHING' (dynamic leap)
    let state = 'CRUISING';
    let stateTimer = 35.0 + Math.random() * 20.0;
    let breachProgress = 0.0;

    // Reusable math objects
    const targetDir = new THREE.Vector3();
    const forward = new THREE.Vector3();

    return {
        group: sharkContainer,
        position,
        materials: shark.materials,
        update(elapsed, delta, boatPos, fogColor, fogDensity) {
            const dt = Math.min(delta, 0.1);

            // 1. State Machine Transitions
            stateTimer -= dt;
            if (stateTimer <= 0) {
                if (state === 'CRUISING') {
                    // Decide whether to cruise surface or perform breach
                    const rand = Math.random();
                    if (rand < 0.28) {
                        state = 'BREACHING';
                        breachProgress = 0.0;
                        stateTimer = 5.5; // duration of breach arc
                    } else {
                        state = 'SURFACING';
                        stateTimer = 22.0 + Math.random() * 15.0; // surface cruise time
                    }
                } else if (state === 'SURFACING') {
                    state = 'CRUISING';
                    stateTimer = 45.0 + Math.random() * 30.0;
                } else if (state === 'BREACHING') {
                    state = 'CRUISING';
                    stateTimer = 45.0 + Math.random() * 30.0;
                }
            }

            // 2. Target Waypoint Navigation
            const currentWaypoint = patrolPoints[currentPatrolIdx];
            targetDir.set(currentWaypoint.x - position.x, 0, currentWaypoint.z - position.z);
            const distToWaypoint = targetDir.length();

            if (distToWaypoint < 45.0) {
                currentPatrolIdx = (currentPatrolIdx + 1) % patrolPoints.length;
            }
            targetDir.normalize();

            // Calculate desired depth based on AI state
            let desiredY = SHARK_CONFIG.cruisingDepth;
            let currentSpeed = SHARK_CONFIG.speed;

            if (state === 'SURFACING') {
                // Dorsal fin breaks through waterline (tip of dorsal fin is Y > 0 while body is Y ≈ -0.7)
                desiredY = SHARK_CONFIG.surfaceDepth;
                currentSpeed = SHARK_CONFIG.speed * 1.15;
            } else if (state === 'BREACHING') {
                // Dynamic parabolic arc: surge up from depth, clear water, dive back
                breachProgress += dt * 0.28;
                const sinArc = Math.sin(breachProgress * Math.PI);
                // Parabolic breach height: leaps up to +3.8 above surface
                desiredY = -25.0 + sinArc * 29.0;
                currentSpeed = SHARK_CONFIG.sprintSpeed;
            }

            // Seabed collision protection
            const seabedY = getSeabedHeight(position.x, position.z);
            if (desiredY < seabedY + 5.0) {
                desiredY = seabedY + 5.0;
            }

            // 3. Smooth Steering & Orientation
            const targetHeading = Math.atan2(targetDir.x, targetDir.z);
            // Angular lerp
            let diffHeading = targetHeading - heading;
            while (diffHeading < -Math.PI) diffHeading += Math.PI * 2;
            while (diffHeading > Math.PI) diffHeading -= Math.PI * 2;
            heading += diffHeading * THREE.MathUtils.clamp(SHARK_CONFIG.turnRate * dt, 0, 1);

            // Pitch toward target depth
            const diffY = desiredY - position.y;
            const targetPitch = THREE.MathUtils.clamp(diffY * 0.08, -0.65, 0.65);
            pitch = THREE.MathUtils.damp(pitch, targetPitch, 3.0, dt);

            // Roll smoothly into turns (like a real shark)
            const targetRoll = -diffHeading * 0.45;
            roll = THREE.MathUtils.damp(roll, targetRoll, 2.5, dt);

            // 4. Update Position
            forward.set(
                Math.sin(heading) * Math.cos(pitch),
                Math.sin(pitch),
                Math.cos(heading) * Math.cos(pitch)
            ).normalize();

            position.addScaledVector(forward, currentSpeed * dt);
            sharkContainer.position.copy(position);
            sharkContainer.rotation.set(pitch, heading, roll);

            // 5. Realistic Articulated Spine Swimming Animation
            // Undulation frequency scales with swim speed
            const swimFreq = currentSpeed * 0.45;
            const wavePhase = elapsed * swimFreq;

            // Torso slight yaw counter-sway
            shark.torso.rotation.y = Math.sin(wavePhase) * 0.07;
            // Mid-body flexes with lag
            shark.midBody.rotation.y = Math.sin(wavePhase - 0.75) * 0.18;
            // Caudal peduncle deepens the curve
            shark.peduncle.rotation.y = Math.sin(wavePhase - 1.5) * 0.32;
            // Heterocercal tail fin delivers powerful sweep
            shark.tailFin.rotation.y = Math.sin(wavePhase - 2.25) * 0.46;

            // 6. Surface Wake & Breaching Splash Effects
            const isNearSurface = position.y >= -1.4;
            const isDorsalPiercing = position.y >= -1.0;

            if (isNearSurface && state !== 'CRUISING') {
                wake.wakeMesh.visible = true;
                const targetOpacity = isDorsalPiercing ? 0.75 : 0.3;
                wake.wakeMat.opacity = THREE.MathUtils.damp(wake.wakeMat.opacity, targetOpacity, 4.0, dt);

                // Orient wake horizontally at surface Y = 0.05
                wake.group.position.set(0, -position.y + 0.05, 0);
                wake.group.rotation.set(-pitch, 0, -roll); // counter-pitch to stay flat on surface
            } else {
                wake.wakeMat.opacity = THREE.MathUtils.damp(wake.wakeMat.opacity, 0.0, 5.0, dt);
                if (wake.wakeMat.opacity < 0.02) wake.wakeMesh.visible = false;
            }

            // Breaching Splash Burst
            if (state === 'BREACHING' && position.y > -0.5 && position.y < 2.5) {
                wake.splashMat.opacity = 0.85;
                const sPos = wake.splashPos;
                const sVel = wake.splashVel;
                for (let i = 0; i < sPos.length / 3; i++) {
                    sPos[i * 3 + 0] += sVel[i * 3 + 0] * dt;
                    sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt - 9.8 * dt * dt;
                    sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt;
                }
                wake.splashPoints.geometry.attributes.position.needsUpdate = true;
            } else {
                wake.splashMat.opacity = THREE.MathUtils.damp(wake.splashMat.opacity, 0.0, 4.0, dt);
            }
        }
    };
}
