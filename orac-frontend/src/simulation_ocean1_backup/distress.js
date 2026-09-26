// ═══════════════════════════════════════════════════════════════
// ORCA DISTRESS SYSTEM & SCENARIO CONTROLLER
// Autonomous Coastal Vessel Safety & Return-to-Shore Guidance
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

export class DistressSystem {
    constructor() {
        this.state = 'SAFE'; // 'SAFE' | 'ALERT' | 'RETURNING' | 'SAFE_ARRIVED'
        this.scene = null;
        this.camera = null;
        this.boat = null;
        this.weatherSystem = null;
        this.coastalBeaconPos = new THREE.Vector3(0, 16, -650);
        this.offshoreBuoyPos = new THREE.Vector3(180, 0, 240);
        this.handheldDevice = null;

        // Audio System
        this.audioCtx = null;
        this.sirenGain = null;
        this.sirenOsc = null;
        this.sirenLfo = null;
        this.isSirenPlaying = false;

        // Visual Guidance Objects
        this.routeLine = null;
        this.routeGeo = null;
        this.routeMat = null;
        this.beaconRingGroup = null;
        this.beaconRings = [];
        this.buoySignalGroup = null;
        this.buoySignals = [];

        // Hysteresis & Navigation Tracking
        this.lastDistance = 9999;
        this.distDecreasingFrames = 0;
        this.lastDomUpdate = 0;
        this.dashOffset = 0;

        // Cached math vectors
        this._vBoat = new THREE.Vector3();
        this._vTarget = new THREE.Vector3();
        this._vDir = new THREE.Vector2();

        // UI Element References
        this.elAlert = null;
        this.elSuccess = null;
        this.elNavBadge = null;
        this.elNavArrow = null;
        this.elNavDist = null;
        this.elRadio = null;
        this.elRadarCanvas = null;
        this.radarCtx = null;

        // Setup user interaction listener for Web Audio autoplay policy
        this._unlockAudio = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        };
        window.addEventListener('click', this._unlockAudio, { passive: true });
        window.addEventListener('keydown', this._unlockAudio, { passive: true });
    }

    init({ scene, camera, boat, weatherSystem, coastalBeaconPos, offshoreBuoyPos, handheldDevice }) {
        this.scene = scene;
        this.camera = camera;
        this.boat = boat;
        this.weatherSystem = weatherSystem;
        if (coastalBeaconPos) this.coastalBeaconPos.copy(coastalBeaconPos);
        if (offshoreBuoyPos) this.offshoreBuoyPos.copy(offshoreBuoyPos);
        if (handheldDevice) this.handheldDevice = handheldDevice;

        this._initUI();
        this._initRouteLine();
        this._initBeaconRings();
        this._initBuoySignals();
        this._initRadar();
    }

    _initUI() {
        this.elAlert = document.getElementById('distress-alert');
        this.elSuccess = document.getElementById('distress-success');
        this.elNavBadge = document.getElementById('nav-badge');
        this.elNavArrow = document.getElementById('nav-arrow');
        this.elNavDist = document.getElementById('nav-dist-val');
        this.elRadio = document.getElementById('radio-indicator');
        this.elRadarCanvas = document.getElementById('radar-canvas');
        if (this.elRadarCanvas) {
            this.radarCtx = this.elRadarCanvas.getContext('2d');
        }
    }

    // ── 1. Glowing Navigation Route Line ─────────────────────────────
    _initRouteLine() {
        const points = [];
        for (let i = 0; i < 40; i++) {
            points.push(new THREE.Vector3(0, 0.4, 0));
        }
        this.routeGeo = new THREE.BufferGeometry().setFromPoints(points);

        this.routeMat = new THREE.LineDashedMaterial({
            color: 0x00f0ff,
            linewidth: 3,
            scale: 1,
            dashSize: 4.5,
            gapSize: 2.2,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this.routeLine = new THREE.Line(this.routeGeo, this.routeMat);
        this.routeLine.frustumCulled = false;
        this.scene.add(this.routeLine);
    }

    // ── 2. Coastal Warning Beacon Signal Pulse Rings ─────────────────
    _initBeaconRings() {
        this.beaconRingGroup = new THREE.Group();
        this.beaconRingGroup.position.copy(this.coastalBeaconPos);
        this.beaconRingGroup.position.y += 2.0;

        const ringCount = 5;
        this.beaconRings = [];

        for (let i = 0; i < ringCount; i++) {
            const geo = new THREE.RingGeometry(2.0, 3.8, 48);
            geo.rotateX(-Math.PI * 0.42); // tilt slightly toward ocean surface

            const mat = new THREE.MeshBasicMaterial({
                color: 0x00e6ff,
                transparent: true,
                opacity: 0.0,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = {
                phase: i / ringCount,
                maxRadius: 180,
            };
            this.beaconRingGroup.add(mesh);
            this.beaconRings.push(mesh);
        }

        this.scene.add(this.beaconRingGroup);
    }

    // ── 3. Offshore Buoy Wireless Signal Arcs ────────────────────────
    _initBuoySignals() {
        this.buoySignalGroup = new THREE.Group();
        this.buoySignalGroup.position.copy(this.offshoreBuoyPos);
        this.buoySignalGroup.position.y += 3.5;

        const arcCount = 4;
        this.buoySignals = [];

        for (let i = 0; i < arcCount; i++) {
            const curve = new THREE.EllipseCurve(
                0, 0,
                5.0, 5.0,
                -Math.PI * 0.35, Math.PI * 0.35,
                false,
                0
            );
            const points = curve.getPoints(24);
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            geo.rotateX(-Math.PI / 2);

            const mat = new THREE.LineBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0.0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            });

            const arcLine = new THREE.Line(geo, mat);
            arcLine.userData = {
                phase: i / arcCount,
                maxDist: 220,
            };
            this.buoySignalGroup.add(arcLine);
            this.buoySignals.push(arcLine);
        }

        this.scene.add(this.buoySignalGroup);
    }

    // ── 4. Web Audio API Procedural Siren ────────────────────────────
    _startSiren() {
        try {
            if (!this.audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                this.audioCtx = new AudioContextClass();
            }

            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            if (this.isSirenPlaying) return;

            const now = this.audioCtx.currentTime;

            // Master siren gain with soft envelope
            this.sirenGain = this.audioCtx.createGain();
            this.sirenGain.gain.setValueAtTime(0.0001, now);
            this.sirenGain.gain.linearRampToValueAtTime(0.18, now + 0.35); // moderate, non-deafening volume
            this.sirenGain.connect(this.audioCtx.destination);

            // Carrier Oscillator (Sweep 620 Hz to 920 Hz)
            this.sirenOsc = this.audioCtx.createOscillator();
            this.sirenOsc.type = 'sawtooth';
            this.sirenOsc.frequency.setValueAtTime(740, now);

            // Modulating Oscillator (Smooth FM wave sweep)
            this.sirenLfo = this.audioCtx.createOscillator();
            this.sirenLfo.type = 'sine';
            this.sirenLfo.frequency.setValueAtTime(0.65, now); // ~1.5 sec cycle

            const lfoGain = this.audioCtx.createGain();
            lfoGain.gain.setValueAtTime(160, now); // +/- 160 Hz sweep width

            this.sirenLfo.connect(lfoGain);
            lfoGain.connect(this.sirenOsc.frequency);

            // Low-pass filter for warmer maritime acoustic resonance
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, now);

            this.sirenOsc.connect(filter);
            filter.connect(this.sirenGain);

            this.sirenOsc.start(now);
            this.sirenLfo.start(now);
            this.isSirenPlaying = true;
        } catch (err) {
            console.warn('[ORCA Distress] Web Audio siren prevented or unsupported:', err);
        }
    }

    _stopSiren(immediate = false) {
        if (!this.isSirenPlaying) return;
        try {
            if (this.audioCtx && this.sirenGain) {
                const now = this.audioCtx.currentTime;
                this.sirenGain.gain.cancelScheduledValues(now);
                this.sirenGain.gain.setValueAtTime(this.sirenGain.gain.value, now);
                this.sirenGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);

                const oscToStop = this.sirenOsc;
                const lfoToStop = this.sirenLfo;
                const gainToDisconnect = this.sirenGain;

                if (immediate) {
                    try {
                        if (oscToStop) { oscToStop.stop(); oscToStop.disconnect(); }
                        if (lfoToStop) { lfoToStop.stop(); lfoToStop.disconnect(); }
                        if (gainToDisconnect) { gainToDisconnect.disconnect(); }
                    } catch (_) { }
                } else {
                    setTimeout(() => {
                        try {
                            if (oscToStop) { oscToStop.stop(); oscToStop.disconnect(); }
                            if (lfoToStop) { lfoToStop.stop(); lfoToStop.disconnect(); }
                            if (gainToDisconnect) { gainToDisconnect.disconnect(); }
                        } catch (_) { }
                    }, 300);
                }
            }
        } catch (err) {
            console.warn('[ORCA Distress] Error stopping siren:', err);
        }
        this.sirenOsc = null;
        this.sirenLfo = null;
        this.sirenGain = null;
        this.isSirenPlaying = false;
    }

    stopSiren() {
        this._stopSiren();
    }

    // ── 5. Trigger Scenario (Storm Activated) ────────────────────────
    trigger() {
        if (this.state === 'ALERT' || this.state === 'RETURNING') return;

        this.state = 'ALERT';
        this.distDecreasingFrames = 0;
        this.lastDistance = 9999;

        // UI Transitions
        if (this.elAlert) {
            this.elAlert.classList.remove('hidden', 'fade-out');
            this.elAlert.classList.add('visible', 'pulse');
        }
        if (this.elSuccess) {
            this.elSuccess.classList.remove('visible');
            this.elSuccess.classList.add('hidden');
        }
        if (this.elRadio) {
            this.elRadio.classList.remove('hidden');
            this.elRadio.classList.add('visible');
        }
        if (this.elNavBadge) {
            this.elNavBadge.classList.remove('hidden');
            this.elNavBadge.classList.add('visible');
        }
        const statusEl = document.getElementById('distress-status-text');
        if (statusEl) {
            statusEl.textContent = 'STORM DETECTED · RETURN TO SHORE';
            statusEl.style.color = '#ff4d4d';
        }

        // Visuals
        if (this.routeMat) {
            this.routeMat.opacity = 0.85;
        }

        // Handheld Device Alert
        if (this.handheldDevice && this.handheldDevice.setAlertState) {
            this.handheldDevice.setAlertState('ALERT');
        }

        this._startSiren();
    }

    // ── 6. Reset Scenario (Switch Away from Storm) ───────────────────
    reset() {
        this.state = 'SAFE';
        this._stopSiren();

        if (this.elAlert) {
            this.elAlert.classList.remove('visible', 'pulse');
            this.elAlert.classList.add('hidden');
        }
        if (this.elSuccess) {
            this.elSuccess.classList.remove('visible');
            this.elSuccess.classList.add('hidden');
        }
        if (this.elRadio) {
            this.elRadio.classList.remove('visible');
            this.elRadio.classList.add('hidden');
        }
        if (this.elNavBadge) {
            this.elNavBadge.classList.remove('visible');
            this.elNavBadge.classList.add('hidden');
        }

        if (this.routeMat) {
            this.routeMat.opacity = 0.0;
        }

        this.beaconRings.forEach(r => {
            r.material.opacity = 0.0;
        });
        this.buoySignals.forEach(s => {
            s.material.opacity = 0.0;
        });

        if (this.handheldDevice && this.handheldDevice.setAlertState) {
            this.handheldDevice.setAlertState('SAFE');
        }
    }

    // ── 7. Update Loop ───────────────────────────────────────────────
    update(elapsed, delta, boatController) {
        if (!boatController) return;

        const boatPos = boatController.position;
        const boatHeading = boatController.heading;
        const boatSpeed = boatController.speed;

        // Authoritative shoreline calculation matching ocean physics
        const shoreX = boatPos.x;
        const shoreZ = -610 + Math.sin(shoreX * 0.0035) * 42 + Math.cos(shoreX * 0.007) * 22;
        const safeShoreLimit = shoreZ + 42.0;

        const distToShore = Math.max(0, boatPos.z - safeShoreLimit);

        // State Machine Transitions
        if (this.state === 'ALERT') {
            // Check if heading towards shore with sustained speed
            // Direction to shore vector is along -Z (dz < 0)
            const forwardZ = Math.cos(boatHeading);
            if (distToShore < this.lastDistance - 0.4 && forwardZ < -0.15 && boatSpeed > 1.0) {
                this.distDecreasingFrames++;
                if (this.distDecreasingFrames > 12) {
                    this.state = 'RETURNING';
                    const statusEl = document.getElementById('distress-status-text');
                    if (statusEl) {
                        statusEl.textContent = 'RETURN GUIDANCE ACTIVE · PROCEED';
                        statusEl.style.color = '#00f0d0';
                    }
                    if (this.handheldDevice && this.handheldDevice.setAlertState) {
                        this.handheldDevice.setAlertState('RETURNING');
                    }
                }
            } else {
                this.distDecreasingFrames = Math.max(0, this.distDecreasingFrames - 1);
            }
            this.lastDistance = distToShore;
        } else if (this.state === 'RETURNING') {
            // Check if reached safe shore zone
            if (boatPos.z <= safeShoreLimit + 4.0) {
                this._onSafeArrival();
            }
        }

        // Animate Visuals if active
        if (this.state === 'ALERT' || this.state === 'RETURNING') {
            this._updateRouteLine(boatPos, shoreX, safeShoreLimit, delta);
            this._updateBeaconRings(elapsed, delta, boatPos);
            this._updateBuoySignals(elapsed, delta, boatPos);
            this._updateHUD(distToShore, boatPos, boatHeading, shoreX, safeShoreLimit);
        }

        // Always update 2D radar overlay
        this._renderRadar(boatPos, boatHeading, safeShoreLimit);
    }

    _updateRouteLine(boatPos, shoreX, safeShoreLimit, delta) {
        if (!this.routeLine || !this.routeMat) return;

        const posAttr = this.routeGeo.attributes.position;
        const count = posAttr.count;

        // Generate smooth Bezier curve from boat to safe shoreline
        const startX = boatPos.x;
        const startY = boatPos.y + 0.6;
        const startZ = boatPos.z;

        const endX = shoreX;
        const endY = 0.5;
        const endZ = safeShoreLimit;

        const midZ = (startZ + endZ) * 0.5;
        const midX = startX + (endX - startX) * 0.4;

        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            // Quadratic Bezier interpolation
            const oneMinusT = 1 - t;
            const x = oneMinusT * oneMinusT * startX + 2 * oneMinusT * t * midX + t * t * endX;
            const y = oneMinusT * oneMinusT * startY + 2 * oneMinusT * t * 1.5 + t * t * endY;
            const z = oneMinusT * oneMinusT * startZ + 2 * oneMinusT * t * midZ + t * t * endZ;

            posAttr.setXYZ(i, x, y, z);
        }
        posAttr.needsUpdate = true;
        this.routeLine.computeLineDistances();

        // Animate line dash glow
        this.dashOffset += delta * 6.0;
        this.routeMat.dashSize = 4.5 + Math.sin(this.dashOffset * 1.5) * 0.8;
    }

    _updateBeaconRings(elapsed, delta, boatPos) {
        if (!this.beaconRingGroup) return;

        // Orient beacon rings horizontally toward boat general direction
        const dx = boatPos.x - this.coastalBeaconPos.x;
        const dz = boatPos.z - this.coastalBeaconPos.z;
        const angle = Math.atan2(dx, dz);
        this.beaconRingGroup.rotation.y = angle;

        for (let i = 0; i < this.beaconRings.length; i++) {
            const ring = this.beaconRings[i];
            let phase = (ring.userData.phase + delta * 0.28) % 1.0;
            ring.userData.phase = phase;

            const radius = 2.0 + phase * ring.userData.maxRadius;
            ring.scale.set(radius, radius, 1.0);

            // Fade out as it expands
            const alpha = Math.sin(phase * Math.PI) * 0.65;
            ring.material.opacity = alpha;
        }
    }

    _updateBuoySignals(elapsed, delta, boatPos) {
        if (!this.buoySignalGroup) return;

        // Orient buoy wireless signal arcs directly toward boat position
        const dx = boatPos.x - this.offshoreBuoyPos.x;
        const dz = boatPos.z - this.offshoreBuoyPos.z;
        const angle = Math.atan2(dx, dz);
        this.buoySignalGroup.rotation.y = angle;

        for (let i = 0; i < this.buoySignals.length; i++) {
            const arc = this.buoySignals[i];
            let phase = (arc.userData.phase + delta * 0.45) % 1.0;
            arc.userData.phase = phase;

            const dist = 3.0 + phase * 75.0;
            arc.scale.set(dist * 0.15, dist * 0.15, dist * 0.15);
            arc.position.z = dist * 0.5;

            const alpha = Math.sin(phase * Math.PI) * 0.85;
            arc.material.opacity = alpha;
        }
    }

    _updateHUD(distToShore, boatPos, boatHeading, shoreX, safeShoreLimit) {
        const now = performance.now();
        if (now - this.lastDomUpdate < 80) return; // 12.5 fps throttle
        this.lastDomUpdate = now;

        if (this.elNavDist) {
            this.elNavDist.textContent = `${Math.round(distToShore)} M`;
        }

        if (this.elNavArrow) {
            // Direction from boat to safe shoreline waypoint
            const targetDx = shoreX - boatPos.x;
            const targetDz = safeShoreLimit - boatPos.z;
            const targetAngle = Math.atan2(targetDx, targetDz);

            // Relative angle = targetAngle - boatHeading
            let relativeAngle = targetAngle - boatHeading;
            // Normalize to [-PI, PI]
            while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
            while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

            const deg = relativeAngle * (180 / Math.PI);
            this.elNavArrow.style.transform = `rotate(${deg}deg)`;
        }
    }

    _onSafeArrival() {
        this.state = 'SAFE_ARRIVED';
        this._stopSiren();

        if (this.elAlert) {
            this.elAlert.classList.remove('pulse', 'visible');
            this.elAlert.classList.add('fade-out');
            setTimeout(() => {
                this.elAlert.classList.add('hidden');
            }, 600);
        }

        if (this.elSuccess) {
            this.elSuccess.classList.remove('hidden');
            this.elSuccess.classList.add('visible', 'pulse-green');
        }

        if (this.routeMat) {
            this.routeMat.opacity = 0.0;
        }

        const statusEl = document.getElementById('distress-status-text');
        if (statusEl) {
            statusEl.textContent = 'VESSEL SAFE · HARBOR REACHED';
            statusEl.style.color = '#00ffaa';
        }

        if (this.handheldDevice && this.handheldDevice.setAlertState) {
            this.handheldDevice.setAlertState('SAFE_ARRIVED');
        }

        // Gradual weather recovery transition: storm -> cloudy over ~6 seconds
        if (this.weatherSystem && this.weatherSystem.currentPresetKey === 'storm') {
            setTimeout(() => {
                if (this.state === 'SAFE_ARRIVED' && this.weatherSystem.currentPresetKey === 'storm') {
                    this.weatherSystem.setWeather('cloudy');
                }
            }, 3500);
        }
    }

    // ── 8. Tactical Mini Radar ───────────────────────────────────────
    _initRadar() {
        if (!this.elRadarCanvas) return;
        this.elRadarCanvas.width = 160;
        this.elRadarCanvas.height = 160;
    }

    _renderRadar(boatPos, boatHeading, safeShoreLimit) {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const w = 160;
        const h = 160;
        const cx = 80;
        const cy = 80;
        const scale = 0.085; // radar range scale

        ctx.clearRect(0, 0, w, h);

        // Circular background
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, 74, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 20, 28, 0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 240, 208, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Concentric distance rings
        ctx.strokeStyle = 'rgba(0, 240, 208, 0.12)';
        ctx.lineWidth = 1;
        [24, 48, 70].forEach(r => {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
        });

        // Shoreline curve (top of radar since North/shore is -Z)
        ctx.beginPath();
        for (let rx = -70; rx <= 70; rx += 4) {
            const worldX = boatPos.x + rx / scale;
            const worldZ = -610 + Math.sin(worldX * 0.0035) * 42 + Math.cos(worldX * 0.007) * 22 + 42.0;
            const radarY = cy + (worldZ - boatPos.z) * scale;
            const radarX = cx + rx;
            if (rx === -70) ctx.moveTo(radarX, radarY);
            else ctx.lineTo(radarX, radarY);
        }
        ctx.strokeStyle = '#38ef7d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Offshore Buoy Marker
        const buoyRelX = (this.offshoreBuoyPos.x - boatPos.x) * scale;
        const buoyRelZ = (this.offshoreBuoyPos.z - boatPos.z) * scale;
        if (Math.hypot(buoyRelX, buoyRelZ) < 72) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(cx + buoyRelX, cy + buoyRelZ, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Boat center icon (pointing in heading)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(boatHeading);
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 3);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Sweep line
        const sweepAngle = (performance.now() * 0.003) % (Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * 72, cy + Math.sin(sweepAngle) * 72);
        ctx.strokeStyle = 'rgba(0, 240, 208, 0.4)';
        ctx.stroke();

        ctx.restore();
    }

    dispose() {
        this._stopSiren(true);
        if (this._unlockAudio) {
            window.removeEventListener('click', this._unlockAudio);
            window.removeEventListener('keydown', this._unlockAudio);
        }
        if (this.audioCtx) {
            try {
                this.audioCtx.close();
            } catch (e) {}
            this.audioCtx = null;
        }
        if (this.routeLine && this.scene) {
            this.scene.remove(this.routeLine);
            if (this.routeGeo) this.routeGeo.dispose();
            if (this.routeMat) this.routeMat.dispose();
        }
        if (this.beaconRingGroup && this.scene) {
            this.scene.remove(this.beaconRingGroup);
        }
        if (this.buoySignalGroup && this.scene) {
            this.scene.remove(this.buoySignalGroup);
        }
    }
}
