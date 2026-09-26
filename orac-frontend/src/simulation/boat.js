// ═══════════════════════════════════════════════════════════════
// ORCA 3D VESSEL & CONTROLLER — OCEAN3 INTEGRATION
// Drives the 32m OrcaFishingTrawler from ocean3
// Watertight hull, rotating radar, propeller, animated cloth flags
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { createDetailedTrawlerVessel, BOAT_CONFIG } from '../ocean3/boat.js';
import { NAV_CONFIG } from '../ocean3/config.js';
import { getGerstnerWaveHeight } from './oceanShaders.js';

export { BOAT_CONFIG };

export function createFishingBoat() {
    return createDetailedTrawlerVessel();
}

export class BoatController {
    constructor(boatGroup, wakeMesh, bowSprayMesh, antennaNode = null) {
        this.group = boatGroup;
        this.wakeMesh = wakeMesh;
        this.bowSprayMesh = bowSprayMesh;
        this.antennaNode = antennaNode;

        // World coordinates & Heading (radians) — Stationary coastal resting position
        const startX = NAV_CONFIG.coastalStart ? NAV_CONFIG.coastalStart.x : 0.0;
        const startZ = NAV_CONFIG.coastalStart ? NAV_CONFIG.coastalStart.z : -500.0;
        const startH = NAV_CONFIG.coastalStart ? NAV_CONFIG.coastalStart.heading : 0.0;

        this.position = new THREE.Vector3(startX, 0, startZ);
        this.heading = startH;
        this.targetHeading = this.heading;

        // Hydrodynamic Physics calibrated for 32m commercial trawler
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

        this._keydownListener = null;
        this._keyupListener = null;
        this._blurListener = null;

        this.setupInputs();
    }

    setupInputs() {
        this._keydownListener = (e) => {
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
        };

        this._keyupListener = (e) => {
            if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
            if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
            if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
            if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
        };

        this._blurListener = () => {
            this.keys.forward = false;
            this.keys.backward = false;
            this.keys.left = false;
            this.keys.right = false;
            this.mouseSteer = 0.0;
        };

        window.addEventListener('keydown', this._keydownListener);
        window.addEventListener('keyup', this._keyupListener);
        window.addEventListener('blur', this._blurListener);
    }

    dispose() {
        if (this._keydownListener) window.removeEventListener('keydown', this._keydownListener);
        if (this._keyupListener) window.removeEventListener('keyup', this._keyupListener);
        if (this._blurListener) window.removeEventListener('blur', this._blurListener);
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

        // 5. Dynamic 5-Probe Gerstner Wave Buoyancy (Scaled for ~32m vessel)
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
