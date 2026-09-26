import * as THREE from 'three';
import { getGerstnerWaveHeight, PI } from './oceanShaders.js';
import {
    createDeckTexture,
    createNetTexture,
    createWakeTexture,
    createBowSprayMesh
} from './textures.js';

export function createFishingBoat() {
    const boatGroup = new THREE.Group();

    const matLowerHull = new THREE.MeshStandardMaterial({ color: 0x092834, roughness: 0.38, metalness: 0.12, side: THREE.DoubleSide });
    const matMainHull = new THREE.MeshStandardMaterial({ color: 0x0c4d68, roughness: 0.28, metalness: 0.15, side: THREE.DoubleSide });
    const matWhiteGelcoat = new THREE.MeshStandardMaterial({ color: 0xf5f8fc, roughness: 0.24, metalness: 0.05 });
    const matWoodTrim = new THREE.MeshStandardMaterial({ color: 0x4a2c16, roughness: 0.68, metalness: 0.02 });
    const deckTex = createDeckTexture();
    const matDeck = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.75, metalness: 0.02 });
    const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.52, metalness: 0.72 });
    const matChrome = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.14, metalness: 0.92 });
    const matWindowGlass = new THREE.MeshPhysicalMaterial({ color: 0x07202c, roughness: 0.04, metalness: 0.1, transmission: 0.65, transparent: true, opacity: 0.90, ior: 1.52 });
    const netTex = createNetTexture();
    const matNet = new THREE.MeshStandardMaterial({ map: netTex, roughness: 0.85, transparent: true, side: THREE.DoubleSide });
    const matCrateBlue = new THREE.MeshStandardMaterial({ color: 0x1468a8, roughness: 0.45 });
    const matCrateYellow = new THREE.MeshStandardMaterial({ color: 0xf2b908, roughness: 0.45 });

    const matPortNav = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: new THREE.Color(0xff0000), emissiveIntensity: 0.0, roughness: 0.2 });
    const matStarNav = new THREE.MeshStandardMaterial({ color: 0x00e64d, emissive: new THREE.Color(0x00dd33), emissiveIntensity: 0.0, roughness: 0.2 });
    const matMastheadNav = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0xfff5e6), emissiveIntensity: 0.0, roughness: 0.2 });
    const matFloodlightLens = new THREE.MeshStandardMaterial({ color: 0xfffaed, emissive: new THREE.Color(0xffe8a0), emissiveIntensity: 0.0, roughness: 0.2 });

    const stations = [
        { z: -18.0, halfW: 5.0, yBottom: -1.6, yDeck: 2.2, yGunwale: 3.8 },
        { z: -11.5, halfW: 6.2, yBottom: -2.8, yDeck: 2.2, yGunwale: 3.8 },
        { z:  -3.5, halfW: 6.6, yBottom: -3.5, yDeck: 2.2, yGunwale: 3.9 },
        { z:   4.5, halfW: 6.3, yBottom: -3.5, yDeck: 2.3, yGunwale: 4.1 },
        { z:  11.5, halfW: 5.0, yBottom: -2.9, yDeck: 2.5, yGunwale: 4.5 },
        { z:  16.5, halfW: 3.2, yBottom: -2.1, yDeck: 2.7, yGunwale: 5.1 },
        { z:  20.5, halfW: 0.35, yBottom: -1.0, yDeck: 2.9, yGunwale: 5.9 },
    ];

    const lowerPos = [];
    const lowerIndices = [];
    let lowerVIdx = 0;

    for (let i = 0; i < stations.length - 1; i++) {
        const s0 = stations[i];
        const s1 = stations[i + 1];
        for (let side = -1; side <= 1; side += 2) {
            const p0_0 = [0, s0.yBottom, s0.z];
            const p0_1 = [side * s0.halfW * 0.62, s0.yBottom * 0.4, s0.z];
            const p0_2 = [side * s0.halfW * 0.90, 0.0, s0.z];
            const p1_0 = [0, s1.yBottom, s1.z];
            const p1_1 = [side * s1.halfW * 0.62, s1.yBottom * 0.4, s1.z];
            const p1_2 = [side * s1.halfW * 0.90, 0.0, s1.z];

            const b1 = lowerVIdx;
            lowerPos.push(...p0_0, ...p1_0, ...p1_1, ...p0_1);
            lowerVIdx += 4;
            if (side === 1) lowerIndices.push(b1, b1 + 1, b1 + 2, b1, b1 + 2, b1 + 3);
            else lowerIndices.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2);

            const b2 = lowerVIdx;
            lowerPos.push(...p0_1, ...p1_1, ...p1_2, ...p0_2);
            lowerVIdx += 4;
            if (side === 1) lowerIndices.push(b2, b2 + 1, b2 + 2, b2, b2 + 2, b2 + 3);
            else lowerIndices.push(b2, b2 + 2, b2 + 1, b2, b2 + 3, b2 + 2);
        }
    }

    const stT = stations[0];
    const tBase = lowerVIdx;
    lowerPos.push(0, stT.yBottom, stT.z, -stT.halfW * 0.90, 0.0, stT.z, stT.halfW * 0.90, 0.0, stT.z);
    lowerIndices.push(tBase, tBase + 2, tBase + 1);
    lowerVIdx += 3;

    const lowerHullGeo = new THREE.BufferGeometry();
    lowerHullGeo.setAttribute('position', new THREE.Float32BufferAttribute(lowerPos, 3));
    lowerHullGeo.setIndex(lowerIndices);
    lowerHullGeo.computeVertexNormals();
    const lowerHullMesh = new THREE.Mesh(lowerHullGeo, matLowerHull);
    boatGroup.add(lowerHullMesh);

    const bulbGeo = new THREE.SphereGeometry(1.2, 14, 14);
    bulbGeo.scale(1.1, 1.2, 2.3);
    const bulbMesh = new THREE.Mesh(bulbGeo, matLowerHull);
    bulbMesh.position.set(0, -1.1, 20.2);
    boatGroup.add(bulbMesh);

    const propHubGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.1, 12);
    propHubGeo.rotateX(Math.PI / 2);
    const propHub = new THREE.Mesh(propHubGeo, matChrome);
    propHub.position.set(0, -1.9, -17.0);
    boatGroup.add(propHub);

    for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 0.08), matChrome);
        blade.position.set(0, -1.9, -17.0);
        blade.rotation.z = (b / 4) * Math.PI * 2;
        blade.rotation.x = 0.35;
        boatGroup.add(blade);
    }

    const rudderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.7, 1.5), matDarkMetal);
    rudderMesh.position.set(0, -2.0, -18.6);
    boatGroup.add(rudderMesh);

    const upperPos = [];
    const upperIndices = [];
    let upperVIdx = 0;

    for (let i = 0; i < stations.length - 1; i++) {
        const s0 = stations[i];
        const s1 = stations[i + 1];
        for (let side = -1; side <= 1; side += 2) {
            const p0_2 = [side * s0.halfW * 0.90, 0.0, s0.z];
            const p0_3 = [side * s0.halfW, s0.yGunwale, s0.z];
            const p1_2 = [side * s1.halfW * 0.90, 0.0, s1.z];
            const p1_3 = [side * s1.halfW, s1.yGunwale, s1.z];

            const b1 = upperVIdx;
            upperPos.push(...p0_2, ...p1_2, ...p1_3, ...p0_3);
            upperVIdx += 4;
            if (side === 1) upperIndices.push(b1, b1 + 1, b1 + 2, b1, b1 + 2, b1 + 3);
            else upperIndices.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2);
        }
    }

    const utBase = upperVIdx;
    upperPos.push(-stT.halfW * 0.90, 0.0, stT.z, stT.halfW * 0.90, 0.0, stT.z, stT.halfW, stT.yGunwale, stT.z, -stT.halfW, stT.yGunwale, stT.z);
    upperIndices.push(utBase, utBase + 1, utBase + 2, utBase, utBase + 2, utBase + 3);
    upperVIdx += 4;

    const upperHullGeo = new THREE.BufferGeometry();
    upperHullGeo.setAttribute('position', new THREE.Float32BufferAttribute(upperPos, 3));
    upperHullGeo.setIndex(upperIndices);
    upperHullGeo.computeVertexNormals();
    const upperHullMesh = new THREE.Mesh(upperHullGeo, matMainHull);
    boatGroup.add(upperHullMesh);

    // Elevated Watertight Cockpit Floor (Y = 2.22)
    const deckPos = [];
    const deckUvs = [];
    const deckIndices = [];
    let deckVIdx = 0;

    for (let i = 0; i < stations.length - 1; i++) {
        const s0 = stations[i];
        const s1 = stations[i + 1];
        const w0 = Math.max(0.2, s0.halfW - 0.45);
        const w1 = Math.max(0.2, s1.halfW - 0.45);

        const p0_l = [-w0, s0.yDeck, s0.z];
        const p0_r = [ w0, s0.yDeck, s0.z];
        const p1_l = [-w1, s1.yDeck, s1.z];
        const p1_r = [ w1, s1.yDeck, s1.z];

        const b1 = deckVIdx;
        deckPos.push(...p0_l, ...p0_r, ...p1_r, ...p1_l);
        deckUvs.push(0, s0.z / 18, 1, s0.z / 18, 1, s1.z / 18, 0, s1.z / 18);
        deckIndices.push(b1, b1 + 1, b1 + 2, b1, b1 + 2, b1 + 3);
        deckVIdx += 4;
    }

    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
    deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(deckUvs, 2));
    deckGeo.setIndex(deckIndices);
    deckGeo.computeVertexNormals();
    const deckMesh = new THREE.Mesh(deckGeo, matDeck);
    boatGroup.add(deckMesh);

    // Solid Inner Bulwarks (From Y=2.2 up to Gunwale Y=3.8-5.2)
    const bulwarkPos = [];
    const bulwarkIndices = [];
    let bulwarkVIdx = 0;

    for (let i = 0; i < stations.length - 1; i++) {
        const s0 = stations[i];
        const s1 = stations[i + 1];

        for (let side = -1; side <= 1; side += 2) {
            const w0 = Math.max(0.2, s0.halfW - 0.45);
            const w1 = Math.max(0.2, s1.halfW - 0.45);

            const p0_fl = [side * w0, s0.yDeck, s0.z];
            const p0_top = [side * s0.halfW, s0.yGunwale, s0.z];
            const p1_fl = [side * w1, s1.yDeck, s1.z];
            const p1_top = [side * s1.halfW, s1.yGunwale, s1.z];

            const b1 = bulwarkVIdx;
            bulwarkPos.push(...p0_fl, ...p1_fl, ...p1_top, ...p0_top);
            bulwarkVIdx += 4;
            if (side === 1) bulwarkIndices.push(b1, b1 + 2, b1 + 1, b1, b1 + 3, b1 + 2);
            else bulwarkIndices.push(b1, b1 + 1, b1 + 2, b1, b1 + 2, b1 + 3);
        }
    }

    const bulwarkGeo = new THREE.BufferGeometry();
    bulwarkGeo.setAttribute('position', new THREE.Float32BufferAttribute(bulwarkPos, 3));
    bulwarkGeo.setIndex(bulwarkIndices);
    bulwarkGeo.computeVertexNormals();
    const bulwarkMesh = new THREE.Mesh(bulwarkGeo, matWhiteGelcoat);
    boatGroup.add(bulwarkMesh);

    // Gunwale Capping Rails
    for (let side = -1; side <= 1; side += 2) {
        const railCurvePts = [];
        for (let i = 0; i < stations.length; i++) {
            const s = stations[i];
            railCurvePts.push(new THREE.Vector3(side * (s.halfW + 0.05), s.yGunwale + 0.08, s.z));
        }
        const railCurve = new THREE.CatmullRomCurve3(railCurvePts);
        const railGeo = new THREE.TubeGeometry(railCurve, 32, 0.20, 8, false);
        const railMesh = new THREE.Mesh(railGeo, matWoodTrim);
        boatGroup.add(railMesh);
    }

    const sternRail = new THREE.Mesh(new THREE.BoxGeometry(stT.halfW * 2 + 0.2, 0.26, 0.45), matWoodTrim);
    sternRail.position.set(0, stT.yGunwale + 0.08, stT.z);
    boatGroup.add(sternRail);

    // Center Helm Console & Pilot Station
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(0, 2.22, 2.0);

    const consoleBody = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.75, 2.2), matWhiteGelcoat);
    consoleBody.position.set(0, 0.88, 0);
    consoleGroup.add(consoleBody);

    const helmWheel = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 8, 18), matChrome);
    helmWheel.position.set(0, 1.45, 1.12);
    helmWheel.rotation.x = -0.35;
    consoleGroup.add(helmWheel);

    const throttleBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.4), matDarkMetal);
    throttleBase.position.set(0.65, 1.35, 0.85);
    consoleGroup.add(throttleBase);

    for (let th = -1; th <= 1; th += 2) {
        const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 6), matChrome);
        lever.rotation.x = 0.25;
        lever.position.set(0.65 + th * 0.08, 1.52, 0.85);
        consoleGroup.add(lever);
    }

    const mfdScreenMat = new THREE.MeshStandardMaterial({
        color: 0x00f0d0,
        emissive: new THREE.Color(0x00c0a8),
        emissiveIntensity: 0.65,
        roughness: 0.1,
    });
    const mfdScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.65), mfdScreenMat);
    mfdScreen.position.set(-0.7, 1.42, 1.12);
    mfdScreen.rotation.x = -0.35;
    consoleGroup.add(mfdScreen);

    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), matWindowGlass);
    windshield.position.set(0, 2.05, 0.8);
    windshield.rotation.x = -0.18;
    consoleGroup.add(windshield);

    const ttopStanchions = [
        [-1.6, -0.8], [1.6, -0.8],
        [-1.6,  0.8], [1.6,  0.8],
    ];
    ttopStanchions.forEach(([sx, sz]) => {
        const stanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 3.8, 8), matChrome);
        stanchion.position.set(sx, 1.9, sz);
        consoleGroup.add(stanchion);
    });

    const hardtop = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 4.4), matWhiteGelcoat);
    hardtop.position.set(0, 3.8, 0);
    consoleGroup.add(hardtop);

    const scannerBarGroup = new THREE.Group();
    scannerBarGroup.position.set(0, 4.4, 0);

    const radarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.35, 12), matWhiteGelcoat);
    radarBase.position.set(0, 4.05, 0);
    consoleGroup.add(radarBase);

    const scannerBar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.20, 0.35), matWhiteGelcoat);
    scannerBarGroup.add(scannerBar);
    const scannerFace = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.18), matDarkMetal);
    scannerFace.position.set(0, 0, 0.18);
    scannerBarGroup.add(scannerFace);
    consoleGroup.add(scannerBarGroup);

    for (let a = -1; a <= 1; a += 2) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 7.0, 6), matChrome);
        ant.position.set(a * 1.8, 7.2, -0.8);
        ant.rotation.x = -0.15;
        consoleGroup.add(ant);
    }

    const portNav = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 8), matPortNav);
    portNav.position.set(-2.0, 3.8, 1.2);
    consoleGroup.add(portNav);

    const starNav = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 8), matStarNav);
    starNav.position.set(2.0, 3.8, 1.2);
    consoleGroup.add(starNav);

    const mastheadLight = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8), matMastheadNav);
    mastheadLight.position.set(0, 4.8, 0);
    consoleGroup.add(mastheadLight);

    const deckFloodLight = new THREE.SpotLight(0xfff2cc, 0.0, 45, Math.PI * 0.38, 0.45, 1.2);
    deckFloodLight.position.set(0, 3.7, -1.0);
    deckFloodLight.target.position.set(0, 0, -8.0);
    consoleGroup.add(deckFloodLight);
    consoleGroup.add(deckFloodLight.target);

    const consoleGlow = new THREE.PointLight(0xffd580, 0.0, 10, 1.2);
    consoleGlow.position.set(0, 1.4, 0.4);
    consoleGroup.add(consoleGlow);

    boatGroup.add(consoleGroup);

    // 3D Fisherman Model (Strictly Inspired by User Photo Reference)
    const fishermanGroup = new THREE.Group();
    fishermanGroup.position.set(0.75, 2.22, 1.8);

    const matSkin = new THREE.MeshStandardMaterial({ color: 0xd49b78, roughness: 0.7 });
    const matBeard = new THREE.MeshStandardMaterial({ color: 0x322218, roughness: 0.9 });
    const matShades = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
    const matHat = new THREE.MeshStandardMaterial({ color: 0x3d4e33, roughness: 0.85 });
    const matShirt = new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.85 });
    const matVest = new THREE.MeshStandardMaterial({ color: 0x4a5d38, roughness: 0.82 });
    const matPants = new THREE.MeshStandardMaterial({ color: 0xa89368, roughness: 0.88 });
    const matBoots = new THREE.MeshStandardMaterial({ color: 0x1f3b25, roughness: 0.55 });
    const matSole = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });

    for (let side = -1; side <= 1; side += 2) {
        const legX = side * 0.22;
        const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.65, 8), matBoots);
        boot.position.set(legX, 0.32, 0);
        fishermanGroup.add(boot);

        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.36), matBoots);
        foot.position.set(legX, 0.08, 0.08);
        fishermanGroup.add(foot);

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.75, 8), matPants);
        leg.position.set(legX, 0.95, 0);
        fishermanGroup.add(leg);
    }

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.32), matPants);
    pelvis.position.set(0, 1.38, 0);
    fishermanGroup.add(pelvis);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.65, 0.34), matShirt);
    torso.position.set(0, 1.75, 0);
    fishermanGroup.add(torso);

    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.64, 0.38), matVest);
    vest.position.set(0, 1.76, 0);
    fishermanGroup.add(vest);

    const vestPockets = [
        [-0.18, 1.90], [0.18, 1.90],
        [-0.18, 1.62], [0.18, 1.62],
    ];
    vestPockets.forEach(([px, py]) => {
        const vPock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.06), matVest);
        vPock.position.set(px, py, 0.21);
        fishermanGroup.add(vPock);
    });

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.16, 8), matSkin);
    neck.position.set(0, 2.12, 0);
    fishermanGroup.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 14), matSkin);
    head.position.set(0, 2.28, 0);
    fishermanGroup.add(head);

    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), matBeard);
    beard.position.set(0, 2.22, 0.08);
    beard.scale.set(0.9, 0.9, 0.9);
    fishermanGroup.add(beard);

    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.06), matShades);
    glasses.position.set(0, 2.30, 0.17);
    fishermanGroup.add(glasses);

    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.21, 0.18, 14), matHat);
    hatCrown.position.set(0, 2.40, 0);
    fishermanGroup.add(hatCrown);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.30, 0.04, 16), matHat);
    hatBrim.position.set(0, 2.33, 0);
    fishermanGroup.add(hatBrim);

    // Left arm resting on console
    const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.38, 8), matShirt);
    lUpperArm.position.set(-0.35, 1.85, 0.08);
    lUpperArm.rotation.z = 0.45;
    lUpperArm.rotation.x = -0.3;
    fishermanGroup.add(lUpperArm);

    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.38, 8), matSkin);
    lForearm.position.set(-0.48, 1.62, 0.24);
    lForearm.rotation.x = -0.7;
    fishermanGroup.add(lForearm);

    // Right arm raised holding rugged alert receiver
    const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.36, 8), matShirt);
    rUpperArm.position.set(0.34, 1.86, 0.06);
    rUpperArm.rotation.z = -0.55;
    rUpperArm.rotation.x = -0.55;
    fishermanGroup.add(rUpperArm);

    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.36, 8), matSkin);
    rForearm.position.set(0.28, 1.84, 0.34);
    rForearm.rotation.x = -1.35;
    rForearm.rotation.y = -0.4;
    fishermanGroup.add(rForearm);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.10, 0.11), matSkin);
    hand.position.set(0.22, 1.94, 0.48);
    fishermanGroup.add(hand);

    // Rugged Handheld ORCA Alert Receiver Device
    const deviceGroup = new THREE.Group();
    deviceGroup.position.set(0.22, 1.97, 0.52);
    deviceGroup.rotation.y = -0.35;
    deviceGroup.rotation.x = 0.25;

    const matDeviceCase = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.6 });
    const matDeviceBumper = new THREE.MeshStandardMaterial({ color: 0xf2b908, roughness: 0.4 });

    const deviceBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.07), matDeviceCase);
    deviceGroup.add(deviceBody);

    for (let cx = -1; cx <= 1; cx += 2) {
        for (let cy = -1; cy <= 1; cy += 2) {
            const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.08), matDeviceBumper);
            bumper.position.set(cx * 0.08, cy * 0.11, 0);
            deviceGroup.add(bumper);
        }
    }

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.18, 6), matDeviceCase);
    antenna.position.set(0.06, 0.22, 0);
    deviceGroup.add(antenna);

    const deviceScreenMat = new THREE.MeshStandardMaterial({
        color: 0x00d0aa,
        emissive: new THREE.Color(0x00d0aa),
        emissiveIntensity: 0.5,
        roughness: 0.1,
    });
    const deviceScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.11), deviceScreenMat);
    deviceScreen.position.set(0, 0.04, 0.038);
    deviceGroup.add(deviceScreen);

    const deviceLedMat = new THREE.MeshStandardMaterial({
        color: 0x00e0a0,
        emissive: new THREE.Color(0x00e0a0),
        emissiveIntensity: 0.3,
        roughness: 0.2,
    });
    const deviceLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), deviceLedMat);
    deviceLed.position.set(-0.05, 0.15, 0);
    deviceGroup.add(deviceLed);

    fishermanGroup.add(deviceGroup);

    const bucketMat = new THREE.MeshStandardMaterial({ color: 0x225530, roughness: 0.6 });
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.45, 12), bucketMat);
    bucket.position.set(-0.7, 0.22, -0.4);
    fishermanGroup.add(bucket);

    boatGroup.add(fishermanGroup);

    // Deck Fishing Equipment
    const rodCoords = [
        [-5.4, -4.0, -0.4], [5.4, -4.0, 0.4],
        [-5.0, -9.0, -0.4], [5.0, -9.0, 0.4],
    ];
    rodCoords.forEach(([rx, rz, lean]) => {
        const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.45, 8), matChrome);
        holder.position.set(rx, 3.8, rz);
        holder.rotation.z = lean * 0.4;
        holder.rotation.x = -0.3;
        boatGroup.add(holder);

        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 4.8, 6), matDarkMetal);
        rod.position.set(rx + lean * 0.8, 5.8, rz - 1.2);
        rod.rotation.z = lean * 0.4;
        rod.rotation.x = -0.45;
        boatGroup.add(rod);
    });

    const netReelGroup = new THREE.Group();
    netReelGroup.position.set(0, 3.2, -14.0);

    const reelCore = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 5.0, 16), matNet);
    reelCore.rotation.z = Math.PI / 2;
    netReelGroup.add(reelCore);

    for (let side = -1; side <= 1; side += 2) {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.2, 16), matDarkMetal);
        flange.rotation.z = Math.PI / 2;
        flange.position.set(side * 2.6, 0, 0);
        netReelGroup.add(flange);
    }

    const netDrapeGeo = new THREE.PlaneGeometry(4.8, 3.8, 6, 6);
    netDrapeGeo.rotateX(-Math.PI * 0.35);
    const netDrape = new THREE.Mesh(netDrapeGeo, matNet);
    netDrape.position.set(0, -0.6, -1.8);
    netReelGroup.add(netDrape);
    boatGroup.add(netReelGroup);

    const cr1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.4), matCrateBlue);
    cr1.position.set(3.8, 2.7, -6.5);
    boatGroup.add(cr1);

    const cr2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.4), matCrateYellow);
    cr2.position.set(-3.8, 2.7, -6.5);
    boatGroup.add(cr2);

    const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.22, 10, 24), matWoodTrim);
    ropeCoil.rotation.x = Math.PI / 2;
    ropeCoil.position.set(0, 2.55, 12.0);
    boatGroup.add(ropeCoil);

    const windlass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 1.4), matDarkMetal);
    windlass.position.set(0, 2.9, 15.0);
    boatGroup.add(windlass);

    // Wake & Spray
    const wakeGeo = new THREE.PlaneGeometry(32, 68, 16, 16);
    wakeGeo.rotateX(-Math.PI / 2);
    const wPos = wakeGeo.attributes.position;
    for (let i = 0; i < wPos.count; i++) {
        const origZ = wPos.getZ(i);
        const t = (34 - origZ) / 68;
        const newZ = -18.0 - t * 65.0;
        const origX = wPos.getX(i);
        const widthFactor = 0.28 + t * 0.72;
        wPos.setX(i, origX * widthFactor);
        wPos.setZ(i, newZ);
        wPos.setY(i, 0.08);
    }
    wakeGeo.computeVertexNormals();

    const wakeTex = createWakeTexture();
    const wakeMat = new THREE.MeshStandardMaterial({
        map: wakeTex,
        transparent: true,
        opacity: 0.0,
        roughness: 0.1,
        metalness: 0.05,
        depthWrite: false,
    });
    const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat);
    boatGroup.add(wakeMesh);

    const bowSprayMesh = createBowSprayMesh();
    boatGroup.add(bowSprayMesh);

    const nightLights = {
        portNavMat: matPortNav,
        starNavMat: matStarNav,
        mastheadNavMat: matMastheadNav,
        floodlightLensMat: matFloodlightLens,
        consoleGlow,
        deckFloodLight,
        setIntensity(val) {
            matPortNav.emissiveIntensity = val;
            matStarNav.emissiveIntensity = val;
            matMastheadNav.emissiveIntensity = val;
            matFloodlightLens.emissiveIntensity = val;
            consoleGlow.intensity = val * 1.8;
            deckFloodLight.intensity = val * 2.6;
        }
    };

    const handheldDevice = {
        setAlertState(state) {
            if (state === 'ALERT' || state === 'RETURNING') {
                deviceScreenMat.color.setHex(0xff2200);
                deviceScreenMat.emissive.setHex(0xff2200);
                deviceScreenMat.emissiveIntensity = 1.4;
                deviceLedMat.color.setHex(0xff0000);
                deviceLedMat.emissive.setHex(0xff0000);
                deviceLedMat.emissiveIntensity = 2.2;
            } else if (state === 'SAFE_ARRIVED') {
                deviceScreenMat.color.setHex(0x00ff88);
                deviceScreenMat.emissive.setHex(0x00ff88);
                deviceScreenMat.emissiveIntensity = 1.0;
                deviceLedMat.color.setHex(0x00ff88);
                deviceLedMat.emissive.setHex(0x00ff88);
                deviceLedMat.emissiveIntensity = 1.5;
            } else {
                deviceScreenMat.color.setHex(0x00d0aa);
                deviceScreenMat.emissive.setHex(0x00d0aa);
                deviceScreenMat.emissiveIntensity = 0.5;
                deviceLedMat.color.setHex(0x00e0a0);
                deviceLedMat.emissive.setHex(0x00e0a0);
                deviceLedMat.emissiveIntensity = 0.2;
            }
        }
    };

    return {
        group: boatGroup,
        wakeMesh,
        bowSprayMesh,
        radarScanner: scannerBarGroup,
        nightLights,
        handheldDevice,
        fisherman: fishermanGroup,
    };
}


// ═══════════════════════════════════════════════════════════════
// FEATURE B — COASTAL ENVIRONMENT & SHORELINE
// ═══════════════════════════════════════════════════════════════

export class BoatController {
    constructor(boatGroup, wakeMesh, bowSprayMesh) {
        this.group = boatGroup;
        this.wakeMesh = wakeMesh;
        this.bowSprayMesh = bowSprayMesh;

        // World coordinates & Heading (radians)
        this.position = new THREE.Vector3(-8.0, 0, 22.0);
        this.heading = Math.PI * 0.72; // local +Z faces in direction (sin(heading), 0, cos(heading))
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
        this._onKeyDown = (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
        };
        this._onKeyUp = (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
        };
        this._onBlur = () => {
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            this.mouseSteer = 0.0;
        };
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
    }

    dispose() {
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
        if (this._onBlur) window.removeEventListener('blur', this._onBlur);
    }

    update(time, delta) {
        const dt = Math.min(delta, 0.1);

        // 1. Throttle / Acceleration / Deceleration
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
        const bowX = this.position.x + forwardX * 17.5;
        const bowZ = this.position.z + forwardZ * 17.5;

        const sternX = this.position.x - forwardX * 17.5;
        const sternZ = this.position.z - forwardZ * 17.5;

        const rightX = cosH;
        const rightZ = -sinH;

        const portX = this.position.x - rightX * 6.5;
        const portZ = this.position.z - rightZ * 6.5;

        const starX = this.position.x + rightX * 6.5;
        const starZ = this.position.z + rightZ * 6.5;

        const waveMult = (this.weatherSystem && this.weatherSystem.currentWaveMultiplier) ? this.weatherSystem.currentWaveMultiplier : 1.0;

        const hBow = getGerstnerWaveHeight(bowX, bowZ, time, waveMult);
        const hStern = getGerstnerWaveHeight(sternX, sternZ, time, waveMult);
        const hPort = getGerstnerWaveHeight(portX, portZ, time, waveMult);
        const hStar = getGerstnerWaveHeight(starX, starZ, time, waveMult);
        const hCenter = getGerstnerWaveHeight(this.position.x, this.position.z, time, waveMult);

        const targetY = (hBow + hStern + hPort + hStar + 2.0 * hCenter) / 6.0;

        // Wave slopes + dynamic bow lift under forward throttle
        const wavePitch = Math.atan2(hBow - hStern, 35.0);
        const speedPitch = (this.speed / this.maxForwardSpeed) * 0.055;
        const targetPitch = wavePitch + speedPitch;

        // Wave roll + centrifugal heel into turns
        const waveRoll = Math.atan2(hStar - hPort, 13.0);
        const turnRoll = -steerInput * speedRatio * 0.045;
        const targetRoll = waveRoll + turnRoll;

        // Engine idle pulsation
        const idleBob = Math.sin(time * 2.0) * 0.05 * (1.0 - speedRatio * 0.7);

        this.curY = THREE.MathUtils.damp(this.curY, targetY, 4.5, dt);
        this.curPitch = THREE.MathUtils.damp(this.curPitch, targetPitch, 4.0, dt);
        this.curRoll = THREE.MathUtils.damp(this.curRoll, targetRoll, 4.0, dt);

        this.group.position.set(this.position.x, this.curY + idleBob, this.position.z);
        this.group.rotation.set(this.curPitch, this.heading, this.curRoll);

        // 6. Hydrodynamic Wake & Bow Spray Animations
        if (this.wakeMesh) {
            const wakeAlpha = Math.min(0.85, speedRatio * 1.05);
            this.wakeMesh.material.opacity = THREE.MathUtils.damp(this.wakeMesh.material.opacity, wakeAlpha, 3.5, dt);
            if (this.wakeMesh.material.map) {
                this.wakeMesh.material.map.offset.y = -time * this.speed * 0.06;
            }
        }
        if (this.bowSprayMesh) {
            const sprayAlpha = Math.max(0, (this.speed / this.maxForwardSpeed) * 0.8);
            this.bowSprayMesh.material.opacity = THREE.MathUtils.damp(this.bowSprayMesh.material.opacity, sprayAlpha, 4.0, dt);
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// SMOOTH CINEMATIC CAMERA SYSTEM
// ═══════════════════════════════════════════════════════════════

