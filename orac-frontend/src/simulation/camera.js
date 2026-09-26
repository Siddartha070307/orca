import * as THREE from 'three';
import { getSeabedHeight } from './seabed.js';

export class CameraController {
    constructor(camera, controls, boatController) {
        this.camera = camera;
        this.controls = controls;
        this.boat = boatController;

        this.mode = 'follow'; // 'follow', 'orbit', or 'underwater'

        // Smooth zoom target & damping
        this.followDistance = 65.0;
        this.targetFollowDistance = 65.0;
        this.minDistance = 6.0;     // close inspection
        this.maxDistance = 3200.0;  // panoramic coastal view

        // Smooth follow configuration
        this.heightRatio = 0.40;
        this.lookAheadBase = 6.0;
        this.lookAheadSpeedFactor = 0.45;
        this.smoothness = 4.0;

        this.currentCamPos = camera.position.clone();
        this.currentTarget = controls.target.clone();

        this.setupControls();
    }

    setupControls() {
        this._onKeyDown = (e) => {
            if (e.code === 'KeyC') {
                this.cycleMode();
            } else if (e.code === 'KeyU') {
                this.toggleDive();
            }
        };
        this._onWheel = (e) => {
            if (this.mode === 'follow' || this.mode === 'underwater') {
                const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
                this.targetFollowDistance = THREE.MathUtils.clamp(
                    this.targetFollowDistance * zoomFactor,
                    this.minDistance,
                    this.maxDistance
                );
            }
        };
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('wheel', this._onWheel, { passive: true });
    }

    dispose() {
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
        if (this._onWheel) window.removeEventListener('wheel', this._onWheel);
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
            this.controls.target.set(boatPos.x, boatPos.y + 3.5, boatPos.z);
        } else if (this.mode === 'underwater') {
            // Position camera submerged beneath vessel looking up at hull & into the reef
            this.controls.enabled = true;
            this.controls.minDistance = this.minDistance;
            this.controls.maxDistance = 600.0;
            this.controls.target.set(boatPos.x, -2.0, boatPos.z);
            this.currentCamPos.set(boatPos.x - 22, -16.0, boatPos.z - 26);
            this.camera.position.copy(this.currentCamPos);
        } else if (this.mode === 'follow') {
            this.controls.enabled = false;
        }
    }

    update(time, delta) {
        const dt = Math.min(delta, 0.1);
        const boatPos = this.boat.position;
        const heading = this.boat.heading;
        const speed = this.boat.speed;

        this.followDistance = THREE.MathUtils.damp(this.followDistance, this.targetFollowDistance, 5.0, dt);

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
            this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, boatPos.y + 3.5, 4.0, dt);
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
