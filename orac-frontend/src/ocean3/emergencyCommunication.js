// ═══════════════════════════════════════════════════════════════
// EMERGENCY MARITIME COMMUNICATION SYSTEM
// SIH Problem Statement 26176 — ORCA Marine Digital Twin
// Coastal Emergency Communication Station, Warning Beacon,
// and Airborne Signal Beam linking Shore to Vessel
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { EMERGENCY_COMM_CONFIG } from './config.js';

export class EmergencyCommunicationSystem {
    constructor(scene, boatController) {
        this.scene = scene;
        this.boat = boatController;

        this.isActive = false;
        this.pulseTime = 0.0;
        this.beaconTimer = 0.0;

        // Group container for all emergency comm elements
        this.group = new THREE.Group();
        this.group.name = 'EmergencyCommunicationSystem';
        this.scene.add(this.group);

        // Tower tip world position (fixed on coastal cliff/breakwater)
        this.towerTip = new THREE.Vector3(
            EMERGENCY_COMM_CONFIG.towerAntennaTip.x,
            EMERGENCY_COMM_CONFIG.towerAntennaTip.y,
            EMERGENCY_COMM_CONFIG.towerAntennaTip.z
        );

        // Reusable vectors
        this._boatTipWorld = new THREE.Vector3();
        this._midPoint = new THREE.Vector3();

        // 1. Build Coastal Communication Tower
        this.buildCoastalTower();

        // 2. Build Airborne Emergency Communication Beam
        this.buildCommunicationBeam();

        // Initially standby
        this.setActive(false);
    }

    // ─── 1. Build Coastal Communication Station & Lattice Tower ──
    buildCoastalTower() {
        const towerGroup = new THREE.Group();
        towerGroup.name = 'CoastalCommunicationTower';
        const rootPos = EMERGENCY_COMM_CONFIG.towerPosition;
        towerGroup.position.set(rootPos.x, rootPos.y, rootPos.z);

        // Materials
        const matConcrete = new THREE.MeshStandardMaterial({
            color: 0x3d454d,
            roughness: 0.92,
            metalness: 0.08,
            flatShading: true
        });

        // Aviation / Maritime Red and White alternating bands
        const matSteelRed = new THREE.MeshStandardMaterial({
            color: 0x9e2424,
            roughness: 0.55,
            metalness: 0.45
        });

        const matSteelWhite = new THREE.MeshStandardMaterial({
            color: 0xdedede,
            roughness: 0.55,
            metalness: 0.45
        });

        const matDarkMetal = new THREE.MeshStandardMaterial({
            color: 0x222629,
            roughness: 0.4,
            metalness: 0.75
        });

        const matDish = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            roughness: 0.35,
            metalness: 0.2,
            side: THREE.DoubleSide
        });

        // A. Heavy Concrete Pedestal Base (Planted into coastal terrain)
        const baseGeo = new THREE.CylinderGeometry(8.5, 9.5, 5.0, 8);
        const baseMesh = new THREE.Mesh(baseGeo, matConcrete);
        baseMesh.position.y = 2.5;
        towerGroup.add(baseMesh);

        const subBaseGeo = new THREE.BoxGeometry(18.0, 2.5, 18.0);
        const subBaseMesh = new THREE.Mesh(subBaseGeo, matConcrete);
        subBaseMesh.position.y = 0.5;
        towerGroup.add(subBaseMesh);

        // B. 4-Legged Tapered Lattice Steel Truss Pylon
        // Height from Y = 5.0 to Y = 53.0 (48m tower body)
        const towerHeight = 48.0;
        const baseSpread = 6.2;
        const topSpread = 1.8;
        const stages = 5;

        // Four corner leg columns
        for (let corner = 0; corner < 4; corner++) {
            const angle = (corner * Math.PI) / 2 + Math.PI / 4;
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            const legPoints = [
                new THREE.Vector3(cosA * baseSpread * 1.3, 5.0, sinA * baseSpread * 1.3),
                new THREE.Vector3(cosA * topSpread * 1.3, 5.0 + towerHeight, sinA * topSpread * 1.3)
            ];
            const legGeo = new THREE.CylinderGeometry(0.32, 0.48, towerHeight, 8);
            const legMesh = new THREE.Mesh(legGeo, corner % 2 === 0 ? matSteelRed : matSteelWhite);
            legMesh.position.set(
                (legPoints[0].x + legPoints[1].x) * 0.5,
                5.0 + towerHeight * 0.5,
                (legPoints[0].z + legPoints[1].z) * 0.5
            );
            // Orient leg along slant
            const slantVec = new THREE.Vector3().subVectors(legPoints[1], legPoints[0]);
            legMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), slantVec.normalize());
            towerGroup.add(legMesh);
        }

        // Horizontal structural tiers & diagonal X-lattice cross braces
        for (let s = 1; s <= stages; s++) {
            const t0 = (s - 1) / stages;
            const t1 = s / stages;
            const y0 = 5.0 + t0 * towerHeight;
            const y1 = 5.0 + t1 * towerHeight;
            const r0 = baseSpread + (topSpread - baseSpread) * t0;
            const r1 = baseSpread + (topSpread - baseSpread) * t1;

            const ringMat = s % 2 === 1 ? matSteelRed : matSteelWhite;

            // Horizontal ring at tier top
            const hBarGeo = new THREE.CylinderGeometry(0.18, 0.18, r1 * 2, 8);
            for (let side = 0; side < 4; side++) {
                const hBar = new THREE.Mesh(hBarGeo, ringMat);
                hBar.position.y = y1;
                if (side % 2 === 0) {
                    hBar.rotation.z = Math.PI / 2;
                    hBar.position.x = 0;
                    hBar.position.z = (side === 0 ? 1 : -1) * r1;
                } else {
                    hBar.rotation.x = Math.PI / 2;
                    hBar.position.z = 0;
                    hBar.position.x = (side === 1 ? 1 : -1) * r1;
                }
                towerGroup.add(hBar);
            }

            // Diagonal cross-bracing struts on 4 faces
            for (let side = 0; side < 4; side++) {
                const diagLen = Math.hypot(y1 - y0, r0 + r1);
                const diagGeo = new THREE.CylinderGeometry(0.09, 0.09, diagLen, 6);

                const d1 = new THREE.Mesh(diagGeo, ringMat);
                d1.position.y = (y0 + y1) * 0.5;
                if (side % 2 === 0) {
                    d1.position.z = (side === 0 ? 1 : -1) * ((r0 + r1) * 0.5);
                    d1.rotation.z = Math.atan2(r0 - r1, y1 - y0) + 0.35;
                } else {
                    d1.position.x = (side === 1 ? 1 : -1) * ((r0 + r1) * 0.5);
                    d1.rotation.x = Math.atan2(r0 - r1, y1 - y0) + 0.35;
                }
                towerGroup.add(d1);
            }
        }

        // C. Upper Telecom Observation & Maintenance Platform (Y = 53.0)
        const platGeo = new THREE.CylinderGeometry(3.6, 3.8, 0.5, 8);
        const platform = new THREE.Mesh(platGeo, matDarkMetal);
        platform.position.y = 53.0;
        towerGroup.add(platform);

        // Safety perimeter railing
        const railTop = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.08, 8, 16), matDarkMetal);
        railTop.rotation.x = Math.PI / 2;
        railTop.position.y = 54.2;
        towerGroup.add(railTop);

        for (let post = 0; post < 8; post++) {
            const pAngle = (post * Math.PI) / 4;
            const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), matDarkMetal);
            postMesh.position.set(Math.cos(pAngle) * 3.5, 53.6, Math.sin(pAngle) * 3.5);
            towerGroup.add(postMesh);
        }

        // Equipment shelter cabinet on platform
        const shelterGeo = new THREE.BoxGeometry(2.0, 2.2, 1.8);
        const shelter = new THREE.Mesh(shelterGeo, matSteelWhite);
        shelter.position.set(-0.8, 54.1, -0.6);
        towerGroup.add(shelter);

        // D. Dual Parabolic Microwave Communication Dishes (Aimed at ocean fishing grounds)
        // Main primary dish (2.4m diameter)
        const dishGroup = new THREE.Group();
        dishGroup.position.set(1.4, 55.2, 1.4);
        dishGroup.rotation.y = 0.35; // oriented seaward

        const dishGeo = new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.38);
        const dishMesh = new THREE.Mesh(dishGeo, matDish);
        dishMesh.rotation.x = Math.PI * 0.45;
        dishGroup.add(dishMesh);

        // Feed horn & support tripod
        const hornGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.8, 8);
        const horn = new THREE.Mesh(hornGeo, matDarkMetal);
        horn.position.set(0, 0, 1.0);
        horn.rotation.x = Math.PI / 2;
        dishGroup.add(horn);

        towerGroup.add(dishGroup);

        // Secondary microwave link dish (1.5m diameter)
        const dish2Group = new THREE.Group();
        dish2Group.position.set(-1.4, 52.2, 1.6);
        dish2Group.rotation.y = -0.2;
        const dish2Geo = new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.38);
        const dish2Mesh = new THREE.Mesh(dish2Geo, matDish);
        dish2Mesh.rotation.x = Math.PI * 0.48;
        dish2Group.add(dish2Mesh);
        towerGroup.add(dish2Group);

        // E. Central Communications Spire / Top Mast (Y = 53.0 to Y = 68.0, 15m pole)
        const mastGeo = new THREE.CylinderGeometry(0.24, 0.42, 15.0, 10);
        const mastMesh = new THREE.Mesh(mastGeo, matSteelWhite);
        mastMesh.position.y = 60.5;
        towerGroup.add(mastMesh);

        // High-gain collinear dipole antennas branching off spire
        for (let da = 0; da < 3; da++) {
            const dAntGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6);
            const dAnt = new THREE.Mesh(dAntGeo, matDarkMetal);
            const aAng = (da * Math.PI * 2) / 3;
            dAnt.position.set(Math.cos(aAng) * 0.8, 59.0 + da * 2.2, Math.sin(aAng) * 0.8);
            towerGroup.add(dAnt);
        }

        // F. Emergency Warning Beacon at Tower Tip (Y = 68.0m)
        const beaconGroup = new THREE.Group();
        beaconGroup.position.y = 68.0 - rootPos.y; // Local Y relative to tower base
        beaconGroup.name = 'EmergencyTowerBeacon';

        // Red transparent beacon lens
        const beaconLensGeo = new THREE.SphereGeometry(1.2, 16, 16);
        this.beaconMat = new THREE.MeshStandardMaterial({
            color: 0xff2222,
            emissive: 0xff0000,
            emissiveIntensity: 2.8,
            roughness: 0.15,
            metalness: 0.1
        });
        const beaconLens = new THREE.Mesh(beaconLensGeo, this.beaconMat);
        beaconGroup.add(beaconLens);

        // Outer additive glow halo
        const haloGeo = new THREE.SphereGeometry(2.4, 12, 12);
        this.beaconHaloMat = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const beaconHalo = new THREE.Mesh(haloGeo, this.beaconHaloMat);
        beaconGroup.add(beaconHalo);

        // Pulsing PointLight
        this.beaconLight = new THREE.PointLight(0xff2222, 2.5, 240, 1.4);
        beaconGroup.add(this.beaconLight);

        towerGroup.add(beaconGroup);

        this.towerGroup = towerGroup;
        this.group.add(towerGroup);
    }

    // ─── 2. Build Airborne Emergency Communication Beam ─────────
    buildCommunicationBeam() {
        this.beamGroup = new THREE.Group();
        this.beamGroup.name = 'AirborneCommunicationBeam';

        // Curve resolution
        this.curvePointsCount = 64;
        const initialPositions = new Float32Array(this.curvePointsCount * 3);

        // A. Primary Core Signal Line
        this.beamLineGeo = new THREE.BufferGeometry();
        this.beamLineGeo.setAttribute('position', new THREE.BufferAttribute(initialPositions, 3));

        this.beamLineMat = new THREE.LineBasicMaterial({
            color: EMERGENCY_COMM_CONFIG.beamColorHex,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.beamLine = new THREE.Line(this.beamLineGeo, this.beamLineMat);
        this.beamGroup.add(this.beamLine);

        // B. Volumetric 3D Tube Beam Mesh for rich bloom & angular visibility
        this.tubeMesh = new THREE.Mesh(
            new THREE.BufferGeometry(),
            new THREE.MeshBasicMaterial({
                color: EMERGENCY_COMM_CONFIG.beamGlowColorHex,
                transparent: true,
                opacity: 0.72,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        this.beamGroup.add(this.tubeMesh);

        // C. Traveling Signal Pulse Packets (Conveys active digital stream from tower to boat)
        this.pulseCount = 7;
        this.pulseMeshes = [];
        const pulseGeo = new THREE.SphereGeometry(1.2, 12, 12);

        for (let i = 0; i < this.pulseCount; i++) {
            const pMat = new THREE.MeshBasicMaterial({
                color: 0xff6666,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const pulse = new THREE.Mesh(pulseGeo, pMat);
            pulse.visible = false;
            this.pulseMeshes.push(pulse);
            this.beamGroup.add(pulse);
        }

        // D. Vessel Antenna Receiving Beacon
        const rxGeo = new THREE.SphereGeometry(0.85, 12, 12);
        this.rxMat = new THREE.MeshBasicMaterial({
            color: 0xff3333,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.rxBeacon = new THREE.Mesh(rxGeo, this.rxMat);
        this.rxBeacon.visible = false;
        this.beamGroup.add(this.rxBeacon);

        this.group.add(this.beamGroup);
    }

    // ─── Set Active / Standby Mode ──────────────────────────────
    setActive(active) {
        this.isActive = !!active;
        if (this.beamGroup) {
            this.beamGroup.visible = this.isActive;
        }
        if (this.rxBeacon) {
            this.rxBeacon.visible = this.isActive;
        }
        this.pulseMeshes.forEach(p => {
            p.visible = this.isActive;
        });

        // Update HUD Comm link badge if present
        const commValEl = document.getElementById('comm-val');
        if (commValEl) {
            if (this.isActive) {
                commValEl.textContent = 'ACTIVE (ENCRYPTED)';
                commValEl.classList.add('comm-active');
            } else {
                commValEl.textContent = 'STANDBY';
                commValEl.classList.remove('comm-active');
            }
        }
    }

    // ─── Live Frame Update ──────────────────────────────────────
    update(time, delta) {
        const dt = Math.min(delta, 0.1);
        this.pulseTime += dt;
        this.beaconTimer += dt;

        // 1. Tower Beacon Strobe Animation
        if (this.isActive) {
            // High-urgency double-flash strobe pattern during storm
            const strobePhase = (this.beaconTimer * 3.5) % 1.0;
            const isFlash = (strobePhase < 0.15) || (strobePhase > 0.30 && strobePhase < 0.45);
            const intensity = isFlash ? 4.5 : 0.8;
            this.beaconMat.emissiveIntensity = intensity;
            this.beaconHaloMat.opacity = isFlash ? 0.85 : 0.2;
            this.beaconLight.intensity = isFlash ? 4.8 : 0.6;
        } else {
            // Calm slow beacon pulse in normal weather
            const pulse = (Math.sin(this.beaconTimer * 2.2) + 1.0) * 0.5;
            this.beaconMat.emissiveIntensity = 0.5 + pulse * 1.5;
            this.beaconHaloMat.opacity = 0.15 + pulse * 0.25;
            this.beaconLight.intensity = 0.4 + pulse * 1.2;
        }

        // 2. If Active, Update Airborne Communication Beam Geometry
        if (!this.isActive) return;

        // Resolve boat antenna world position dynamically
        if (this.boat && this.boat.antennaNode) {
            this.boat.antennaNode.getWorldPosition(this._boatTipWorld);
        } else if (this.boat && this.boat.position) {
            // Fallback: radar mast elevation above boat origin
            this._boatTipWorld.set(
                this.boat.position.x,
                this.boat.curY ? this.boat.curY + 18.6 : 18.6,
                this.boat.position.z
            );
        }

        const p0 = this.towerTip;
        const p2 = this._boatTipWorld;
        const dist = p0.distanceTo(p2);

        // ── STRICT AIRBORNE ELEVATION GUARANTEE ──
        // The midpoint of the parabolic transmission beam is elevated high into the sky.
        // Even at coastal anchorage, Y stays > 20m.
        // At far offshore PFZs, the microwave beam arches majestically across the sky (Y ~ 100m to 140m).
        // At NO point does the beam ever penetrate or reach sea level (Y = 0).
        const archHeight = Math.max(p0.y, p2.y) + 24.0 + Math.min(dist * 0.045, 50.0);
        this._midPoint.set(
            (p0.x + p2.x) * 0.5,
            archHeight,
            (p0.z + p2.z) * 0.5
        );

        const curve = new THREE.QuadraticBezierCurve3(p0, this._midPoint, p2);
        const points = curve.getPoints(this.curvePointsCount - 1);

        // Update core line geometry
        const posAttr = this.beamLineGeo.attributes.position;
        for (let i = 0; i < points.length; i++) {
            posAttr.setXYZ(i, points[i].x, points[i].y, points[i].z);
        }
        posAttr.needsUpdate = true;

        // Update volumetric 3D tube geometry
        if (this.tubeMesh.geometry) {
            this.tubeMesh.geometry.dispose();
        }
        this.tubeMesh.geometry = new THREE.TubeGeometry(curve, 32, 0.45, 6, false);

        // 3. Update Animated Traveling Data Pulse Packets
        const speed = 0.55; // cycle speed along curve
        for (let i = 0; i < this.pulseCount; i++) {
            const offset = i / this.pulseCount;
            const t = (this.pulseTime * speed + offset) % 1.0;
            const pos = curve.getPoint(t);
            const pulseMesh = this.pulseMeshes[i];
            pulseMesh.position.copy(pos);

            // Scale pulse with trajectory
            const sizeT = Math.sin(t * Math.PI);
            const s = (0.5 + sizeT * 0.9) * (0.85 + 0.3 * Math.sin(this.pulseTime * 8.0 + i));
            pulseMesh.scale.set(s, s, s);
            pulseMesh.visible = true;
        }

        // 4. Update Receiving Antenna Beacon at Vessel Mast
        if (this.rxBeacon) {
            this.rxBeacon.position.copy(p2);
            const rxPulse = 0.7 + 0.5 * Math.sin(this.pulseTime * 12.0);
            this.rxBeacon.scale.set(rxPulse, rxPulse, rxPulse);
            this.rxBeacon.visible = true;
        }
    }

    dispose() {
        if (this.group && this.group.parent) {
            this.group.parent.remove(this.group);
        }
    }
}

export function createEmergencyCommunicationSystem(scene, boatController) {
    return new EmergencyCommunicationSystem(scene, boatController);
}
