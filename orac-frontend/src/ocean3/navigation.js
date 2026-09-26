// ═══════════════════════════════════════════════════════════════
// WEATHER-AWARE AUTONOMOUS MARINE NAVIGATION SYSTEM
// SIH Problem Statement 26176 — ORCA Marine Digital Twin
// Single Source of Truth for Weather Decision & Vessel Routing
// Emergency Evacuation & Storm Safe-Return Autopilot
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { PFZ_CONFIG, NAV_CONFIG, EMERGENCY_COMM_CONFIG } from './config.js';

// ─── Centralized Weather Decision Engine ───────────────────────
// Maps the currently active weather condition to the appropriate
// Potential Fishing Zone target.
// SUNNY  → PFZ-1 (Green / High Productivity / Far offshore)
// CLOUDY → PFZ-2 (Yellow / Moderate Productivity / Medium distance)
// STORM  → null  (Dangerous navigation conditions / Vessel returns/stays safe)
export function getNavigationTarget(weatherPresetKey) {
    if (!weatherPresetKey) return null;
    const key = weatherPresetKey.toLowerCase();
    if (key === 'sunny') {
        return PFZ_CONFIG.zones.find(z => z.id === 'PFZ-1') || null;
    } else if (key === 'cloudy') {
        return PFZ_CONFIG.zones.find(z => z.id === 'PFZ-2') || null;
    } else if (key === 'storm') {
        return null;
    }
    return null;
}

// ─── Autonomous Navigation System Controller ───────────────────
export class AutonomousNavigationSystem {
    constructor(boatController, cameraController, pfzSystem, weatherSystem) {
        this.boat = boatController;
        this.camera = cameraController;
        this.pfz = pfzSystem;
        this.weather = weatherSystem;

        // Navigation State Machine:
        // 'IDLE' | 'MANUAL' | 'NAVIGATING' | 'ARRIVING' | 'ARRIVED' |
        // 'DECELERATING' | 'STOPPED' | 'STORM_BLOCKED' | 'AUTONOMOUS_RETURN' | 'SAFE_AT_COAST'
        this.state = 'IDLE';
        this.targetZone = null;
        this.waypoints = [];
        this.currentWaypointIndex = 0;
        this.distanceToTarget = 0.0;
        this.statusMessage = 'IDLE';

        this.setupUI();
    }

    setupUI() {
        const startBtn = document.getElementById('nav-start-btn');
        const stopBtn = document.getElementById('nav-stop-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.start();
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stop();
            });
        }

        // Global shortcut [Space] to Start/Stop navigation
        window.addEventListener('keydown', (e) => {
            const isInput = e.target && e.target.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if (e.code === 'Space' && !isInput) {
                e.preventDefault();
                if (this.state === 'NAVIGATING' || this.state === 'ARRIVING' || this.state === 'AUTONOMOUS_RETURN') {
                    this.stop();
                } else {
                    this.start();
                }
            }
        });
    }

    // ─── Seamless Transition to Full Manual Control ─────────────
    // Called when user presses Arrow keys or WASD after arrival or when stopped
    setManualMode() {
        // Do not interrupt automated emergency storm return via accidental key press
        if (this.state === 'AUTONOMOUS_RETURN') return;

        // If in storm and at coast, vessel remains stationary for safety
        const currentWeather = this.weather ? this.weather.currentPresetKey : 'sunny';
        if (currentWeather === 'storm' && (this.state === 'SAFE_AT_COAST' || this.state === 'STORM_BLOCKED')) {
            return;
        }

        if (this.state !== 'MANUAL') {
            this.state = 'MANUAL';
            this.statusMessage = 'MANUAL CONTROL';
            this.updateButtonStates();
        }
    }

    start() {
        const currentWeather = this.weather ? this.weather.currentPresetKey : 'sunny';
        const target = getNavigationTarget(currentWeather);

        // 1. Storm Safety Check
        if (currentWeather === 'storm' || target === null) {
            const coastPos = EMERGENCY_COMM_CONFIG.coastalSafePort;
            const distToCoast = Math.hypot(coastPos.x - this.boat.position.x, coastPos.z - this.boat.position.z);

            if (distToCoast > EMERGENCY_COMM_CONFIG.coastalArrivalRadius) {
                // Out at sea in storm: execute emergency return to coast
                this.startEmergencyReturn();
                return false;
            } else {
                // Already safe at coastal harbor
                this.state = 'STORM_BLOCKED';
                this.targetZone = null;
                this.statusMessage = 'NAVIGATION DISABLED';
                this.boat.speed = 0.0;
                this.boat.velocity.set(0, 0);
                this.showStormWarning(true, 'AUTONOMOUS NAVIGATION DISABLED — VESSEL REMAINS SAFELY AT COAST');
                if (this.pfz && this.pfz.setActiveTarget) {
                    this.pfz.setActiveTarget(null);
                }
                this.updateButtonStates();
                return false;
            }
        }

        // 2. Safe Weather: Begin Autonomous Navigation to Designated PFZ
        this.showStormWarning(false);
        this.targetZone = target;
        this.state = 'NAVIGATING';
        this.statusMessage = 'NAVIGATING';

        // Ensure surface PFZ overlay is visible during autonomous voyage
        if (this.pfz) {
            this.pfz.setEnabled(true);
            this.pfz.setActiveTarget(target.id);
        }

        // Ensure smooth camera follow mode
        if (this.camera && this.camera.mode !== 'underwater') {
            this.camera.setMode('follow');
        }

        // 3. Build Smooth Navigation Waypoint Corridor
        this.buildRoute(target);

        this.updateButtonStates();
        return true;
    }

    stop() {
        if (this.state === 'NAVIGATING' || this.state === 'ARRIVING' || this.state === 'AUTONOMOUS_RETURN') {
            this.state = 'DECELERATING';
            this.statusMessage = 'DECELERATING';
        } else {
            this.state = 'STOPPED';
            this.statusMessage = 'STOPPED';
            this.boat.speed = 0.0;
            this.boat.velocity.set(0, 0);
        }
        this.updateButtonStates();
    }

    buildRoute(target) {
        this.waypoints = [];

        // Waypoint 1: Current position
        const currentPos = { x: this.boat.position.x, z: this.boat.position.z };

        // Intermediate corridor waypoints for designated PFZ
        const corridor = NAV_CONFIG.corridors[target.id] || [];
        for (let i = 0; i < corridor.length; i++) {
            // Only add corridor points that are ahead of our current Z
            if (corridor[i].z > currentPos.z + 20.0) {
                this.waypoints.push({ x: corridor[i].x, z: corridor[i].z });
            }
        }

        // Final destination waypoint inside the target PFZ
        this.waypoints.push({ x: target.center.x, z: target.center.z });
        this.currentWaypointIndex = 0;
    }

    // ─── Emergency Evacuation & Storm Safe-Return Routing ───────
    startEmergencyReturn() {
        const coastPos = EMERGENCY_COMM_CONFIG.coastalSafePort;
        const dxCoast = coastPos.x - this.boat.position.x;
        const dzCoast = coastPos.z - this.boat.position.z;
        const distToCoast = Math.hypot(dxCoast, dzCoast);

        // Check if vessel is already docked at coast
        if (distToCoast <= EMERGENCY_COMM_CONFIG.coastalArrivalRadius) {
            this.state = 'SAFE_AT_COAST';
            this.statusMessage = 'SAFE AT COAST';
            this.boat.speed = 0.0;
            this.boat.velocity.set(0, 0);
            this.targetZone = null;
            this.showStormWarning(true, 'STORM CONDITIONS · VESSEL RESTING SAFELY AT COASTAL ANCHORAGE');
            this.updateButtonStates();
            return;
        }

        // Vessel is out at sea: calculate return route from ACTUAL current position
        this.state = 'AUTONOMOUS_RETURN';
        this.statusMessage = 'RETURNING TO COAST';
        this.targetZone = null;
        this.waypoints = [];

        const curX = this.boat.position.x;
        const curZ = this.boat.position.z;

        // Route through deep water maritime channel before entering harbor
        if (curZ > -340.0) {
            // Deep water approach corridor
            this.waypoints.push({ x: curX * 0.45, z: -360.0 });
            // Harbor channel alignment
            this.waypoints.push({ x: 0.0, z: -440.0 });
        } else if (curZ > -460.0) {
            this.waypoints.push({ x: 0.0, z: -460.0 });
        }

        // Final coastal safe port anchorage
        this.waypoints.push({ x: coastPos.x, z: coastPos.z });
        this.currentWaypointIndex = 0;

        this.showStormWarning(true, 'EMERGENCY COMM ACTIVE — AUTOPILOT RETURNING VESSEL TO COASTAL SAFE HARBOR');

        if (this.camera && this.camera.mode !== 'underwater') {
            this.camera.setMode('follow');
        }

        this.updateButtonStates();
    }

    onWeatherChange(newWeatherKey) {
        if (!newWeatherKey) return;
        const key = newWeatherKey.toLowerCase();

        // 1. Sudden Storm: Emergency Navigation Abort & Safe-Return
        if (key === 'storm') {
            if (this.pfz && this.pfz.setActiveTarget) {
                this.pfz.setActiveTarget(null);
            }
            if (this.pfz && this.pfz.setEnabled) {
                this.pfz.setEnabled(false);
            }

            const coastPos = EMERGENCY_COMM_CONFIG.coastalSafePort;
            const distToCoast = Math.hypot(coastPos.x - this.boat.position.x, coastPos.z - this.boat.position.z);

            if (distToCoast > EMERGENCY_COMM_CONFIG.coastalArrivalRadius) {
                // Out at sea: trigger automated return from actual position
                this.startEmergencyReturn();
            } else {
                // Already at coastal anchorage
                this.state = 'SAFE_AT_COAST';
                this.statusMessage = 'SAFE AT COAST';
                this.boat.speed = 0.0;
                this.boat.velocity.set(0, 0);
                this.showStormWarning(true, 'STORM CONDITIONS · VESSEL RESTING SAFELY AT COASTAL ANCHORAGE');
                this.updateButtonStates();
            }
        } else {
            // Weather cleared from storm (Sunny, Cloudy, Night)
            this.showStormWarning(false);
            if (this.state === 'STORM_BLOCKED' || this.state === 'SAFE_AT_COAST' || this.state === 'AUTONOMOUS_RETURN') {
                this.state = 'IDLE';
                this.statusMessage = 'IDLE';
                this.boat.speed = 0.0;
                this.boat.velocity.set(0, 0);
                this.updateButtonStates();
            } else if (this.state === 'NAVIGATING' || this.state === 'ARRIVING') {
                // Weather shifted mid-voyage (Sunny <-> Cloudy): safely stop
                this.stop();
            }
        }
    }

    showStormWarning(visible, customMsg) {
        const banner = document.getElementById('storm-warning');
        const msgEl = document.getElementById('storm-warning-msg');
        if (banner) {
            if (visible) {
                if (customMsg && msgEl) {
                    msgEl.textContent = customMsg;
                }
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        }
    }

    updateButtonStates() {
        const startBtn = document.getElementById('nav-start-btn');
        const stopBtn = document.getElementById('nav-stop-btn');

        if (startBtn && stopBtn) {
            if (this.state === 'NAVIGATING' || this.state === 'ARRIVING' || this.state === 'AUTONOMOUS_RETURN') {
                startBtn.classList.add('active');
                stopBtn.classList.remove('disabled');
            } else {
                startBtn.classList.remove('active');
                if (['STOPPED', 'ARRIVED', 'IDLE', 'SAFE_AT_COAST', 'MANUAL'].includes(this.state)) {
                    stopBtn.classList.add('disabled');
                }
            }
        }
    }

    update(delta) {
        const dt = Math.min(delta, 0.1);

        // ── A. Active Outward Navigation to PFZ ──
        if (this.state === 'NAVIGATING' || this.state === 'ARRIVING') {
            if (!this.targetZone || this.waypoints.length === 0) return;

            const dxDest = this.targetZone.center.x - this.boat.position.x;
            const dzDest = this.targetZone.center.z - this.boat.position.z;
            this.distanceToTarget = Math.hypot(dxDest, dzDest);

            // Automatic Arrival Condition inside designated PFZ
            if (this.distanceToTarget <= NAV_CONFIG.arrivalRadius) {
                this.state = 'ARRIVED';
                this.statusMessage = 'ARRIVED';
                this.boat.speed = 0.0;
                this.boat.velocity.set(0, 0);
                this.updateButtonStates();
                return;
            }

            // Waypoint progression
            let activeWp = this.waypoints[this.currentWaypointIndex];
            let dxWp = activeWp.x - this.boat.position.x;
            let dzWp = activeWp.z - this.boat.position.z;
            let distWp = Math.hypot(dxWp, dzWp);

            if (distWp < 60.0 && this.currentWaypointIndex < this.waypoints.length - 1) {
                this.currentWaypointIndex++;
                activeWp = this.waypoints[this.currentWaypointIndex];
                dxWp = activeWp.x - this.boat.position.x;
                dzWp = activeWp.z - this.boat.position.z;
                distWp = Math.hypot(dxWp, dzWp);
            }

            // Autonomous heading control
            const targetHeading = Math.atan2(dxWp, dzWp);
            let angleDiff = ((targetHeading - this.boat.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const turnStep = THREE.MathUtils.clamp(angleDiff * 1.6, -1.0, 1.0) * NAV_CONFIG.turnRate * dt;
            this.boat.targetHeading += turnStep;

            // Autonomous speed governor
            if (this.distanceToTarget <= NAV_CONFIG.slowDownRadius) {
                this.state = 'ARRIVING';
                this.statusMessage = 'ARRIVING';
                const t = Math.max(0.0, (this.distanceToTarget - NAV_CONFIG.arrivalRadius) / (NAV_CONFIG.slowDownRadius - NAV_CONFIG.arrivalRadius));
                const targetSpeed = Math.max(10.0, NAV_CONFIG.cruisingSpeed * Math.pow(t, 0.85));
                this.boat.speed = THREE.MathUtils.damp(this.boat.speed, targetSpeed, 3.5, dt);
            } else {
                this.state = 'NAVIGATING';
                this.statusMessage = 'NAVIGATING';
                this.boat.speed = THREE.MathUtils.damp(this.boat.speed, NAV_CONFIG.cruisingSpeed, 2.2, dt);
            }
        }
        // ── B. Autonomous Storm Safe-Return Navigation ──
        else if (this.state === 'AUTONOMOUS_RETURN') {
            if (this.waypoints.length === 0) return;

            const coastPos = EMERGENCY_COMM_CONFIG.coastalSafePort;
            const dxCoast = coastPos.x - this.boat.position.x;
            const dzCoast = coastPos.z - this.boat.position.z;
            this.distanceToTarget = Math.hypot(dxCoast, dzCoast);

            // Automatic Arrival at Coastal Safe Port
            if (this.distanceToTarget <= EMERGENCY_COMM_CONFIG.coastalArrivalRadius) {
                this.state = 'SAFE_AT_COAST';
                this.statusMessage = 'SAFE AT COAST';
                this.boat.speed = 0.0;
                this.boat.velocity.set(0, 0);
                this.showStormWarning(true, 'STORM CONDITIONS · VESSEL RESTING SAFELY AT COASTAL ANCHORAGE');
                this.updateButtonStates();
                return;
            }

            // Waypoint progression
            let activeWp = this.waypoints[this.currentWaypointIndex];
            let dxWp = activeWp.x - this.boat.position.x;
            let dzWp = activeWp.z - this.boat.position.z;
            let distWp = Math.hypot(dxWp, dzWp);

            if (distWp < 55.0 && this.currentWaypointIndex < this.waypoints.length - 1) {
                this.currentWaypointIndex++;
                activeWp = this.waypoints[this.currentWaypointIndex];
                dxWp = activeWp.x - this.boat.position.x;
                dzWp = activeWp.z - this.boat.position.z;
                distWp = Math.hypot(dxWp, dzWp);
            }

            // Autonomous heading control toward coast
            const targetHeading = Math.atan2(dxWp, dzWp);
            let angleDiff = ((targetHeading - this.boat.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            const turnStep = THREE.MathUtils.clamp(angleDiff * 1.8, -1.0, 1.0) * NAV_CONFIG.turnRate * dt;
            this.boat.targetHeading += turnStep;

            // Safe return speed governor
            if (this.distanceToTarget <= EMERGENCY_COMM_CONFIG.coastalSlowDownRadius) {
                const t = Math.max(0.0, (this.distanceToTarget - EMERGENCY_COMM_CONFIG.coastalArrivalRadius) /
                    (EMERGENCY_COMM_CONFIG.coastalSlowDownRadius - EMERGENCY_COMM_CONFIG.coastalArrivalRadius));
                const targetSpeed = Math.max(6.0, EMERGENCY_COMM_CONFIG.returnCruisingSpeed * Math.pow(t, 0.85));
                this.boat.speed = THREE.MathUtils.damp(this.boat.speed, targetSpeed, 3.2, dt);
            } else {
                this.boat.speed = THREE.MathUtils.damp(this.boat.speed, EMERGENCY_COMM_CONFIG.returnCruisingSpeed, 2.5, dt);
            }
        }
        // ── C. Deceleration to Stop ──
        else if (this.state === 'DECELERATING') {
            const brakeRate = Math.max(NAV_CONFIG.deceleration, 18.0);
            this.boat.speed = Math.max(0.0, this.boat.speed - brakeRate * dt);
            if (this.boat.speed <= 0.4) {
                this.boat.speed = 0.0;
                this.boat.velocity.set(0, 0);
                this.state = 'STOPPED';
                this.statusMessage = 'STOPPED';
                this.updateButtonStates();
            }
        }
        // ── D. Storm Safety Clamp ──
        else if (this.state === 'STORM_BLOCKED' || this.state === 'SAFE_AT_COAST') {
            this.boat.speed = 0.0;
            this.boat.velocity.set(0, 0);
        }
        // NOTE: In 'ARRIVED', 'STOPPED', 'IDLE', and 'MANUAL', this.boat.speed is NOT clamped!
        // The user has full authoritative manual throttle and steering.
    }
}
