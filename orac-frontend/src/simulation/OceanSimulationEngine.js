/**
 * ORCA 3D Ocean Simulation Engine â€” ocean3 Integration
 * High-performance procedural Three.js ocean system with Gerstner waves,
 * dynamic weather/atmospheric engine, 32m commercial fishing trawler with
 * rotating radar & animated championship flags, dedicated PFZ GIS system,
 * autonomous marine navigation autopilot, and coastal emergency communication station.
 * 
 * Life-cycle managed: mount(), resize(), updateContext(), destroy()
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import {
    oceanVertexShader,
    oceanFragmentShader,
    WAVE_CONFIG,
    SUN_CONFIG,
    COLORS,
    GRAVITY,
    PI,
    getGerstnerWaveHeight
} from './oceanShaders.js';

import {
    createCloudSystem,
    createRainSystem,
    createLightningSystem,
    createCelestialSystem,
    createOffshoreBuoy,
    createCoastalEnvironment
} from './environment.js';

import {
    createDetailedTrawlerVessel,
    BOAT_CONFIG
} from '../ocean3/boat.js';

import {
    OCEAN_CONFIG,
    UNDERWATER_CONFIG,
    VEGETATION_CONFIG,
    FISH_CONFIG,
    SHARK_CONFIG,
    PFZ_CONFIG,
    NAV_CONFIG,
    EMERGENCY_COMM_CONFIG
} from '../ocean3/config.js';

import { createPFZSystem, getPFZAtPosition } from '../ocean3/pfz.js';
import { AutonomousNavigationSystem, getNavigationTarget } from '../ocean3/navigation.js';
import { createEmergencyCommunicationSystem } from '../ocean3/emergencyCommunication.js';

import { createSeabedSystem, getSeabedHeight } from '../ocean3/seabed.js';
import { createVegetationSystem } from '../ocean3/vegetation.js';
import { createFishSystem } from '../ocean3/fish.js';
import { createSharkSystem } from '../ocean3/shark.js';
import { createUnderwaterSystem } from '../ocean3/underwater.js';

import { BoatController } from './boat.js';
import { CameraController } from './camera.js';
import { WEATHER_PRESETS, WeatherSystem } from './weather.js';

export class OceanSimulationEngine {
    constructor() {
        this.container = null;
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.composer = null;
        this.bloomPass = null;
        this.clock = new THREE.Clock();

        this.boatController = null;
        this.cameraController = null;
        this.weatherSystem = null;
        this.underwaterSystem = null;
        this.seabedSystem = null;
        this.vegetationSystem = null;
        this.fishSystem = null;
        this.sharkSystem = null;
        this.pfzSystem = null;
        this.navSystem = null;
        this.emergencyCommSystem = null;

        this.clouds = null;
        this.fishingBoat = null;
        this.offshoreBuoy = null;
        this.coastalEnvironment = null;
        this.oceanMaterial = null;

        this.manualDistressActive = false;
        this.animFrameId = null;
        this.isMounted = false;
        this.onHudUpdate = null;
        this.context = {};

        this._resizeHandler = () => this.resize();
        this._keydownHandler = null;
    }

    mount(container, context = {}, onHudUpdate = null) {
        if (!container) throw new Error('[OceanSimulationEngine] Container element is required');
        this.container = container;
        this.context = context;
        this.onHudUpdate = onHudUpdate;

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || window.innerHeight;

        // 1. Renderer Setup
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.62;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        container.appendChild(this.renderer.domElement);

        // 2. Scene & Camera
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, width / height, 1, 25000);
        const startX = NAV_CONFIG.coastalStart ? NAV_CONFIG.coastalStart.x : 0.0;
        const startZ = NAV_CONFIG.coastalStart ? NAV_CONFIG.coastalStart.z : -500.0;
        this.camera.position.set(startX - 28, 22, startZ - 55);
        this.camera.lookAt(startX, 4, startZ);

        // 3. OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI * 0.98;
        this.controls.minPolarAngle = 0.02;
        this.controls.minDistance = 6;
        this.controls.maxDistance = 3500;
        this.controls.target.set(startX, 4, startZ);

        // 4. Sky
        const sky = new Sky();
        sky.scale.setScalar(12000);
        this.scene.add(sky);

        const sunPosition = new THREE.Vector3();
        const phi = THREE.MathUtils.degToRad(90 - SUN_CONFIG.elevation);
        const theta = THREE.MathUtils.degToRad(SUN_CONFIG.azimuth);
        sunPosition.setFromSphericalCoords(1, phi, theta);

        sky.material.uniforms['turbidity'].value = SUN_CONFIG.turbidity;
        sky.material.uniforms['rayleigh'].value = SUN_CONFIG.rayleigh;
        sky.material.uniforms['mieCoefficient'].value = SUN_CONFIG.mieCoefficient;
        sky.material.uniforms['mieDirectionalG'].value = SUN_CONFIG.mieDirectionalG;
        sky.material.uniforms['sunPosition'].value.copy(sunPosition);

        // Environment CubeMap
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512, {
            format: THREE.RGBAFormat,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
        });
        const cubeCamera = new THREE.CubeCamera(1, 12000, cubeRenderTarget);
        cubeCamera.update(this.renderer, this.scene);

        this.scene.environment = cubeRenderTarget.texture;
        this.scene.fog = new THREE.FogExp2(COLORS.fog, 0.00022);

        // Lights
        const sunLight = new THREE.DirectionalLight(0xfff8ed, 2.8);
        sunLight.position.copy(sunPosition.clone().multiplyScalar(4500));
        this.scene.add(sunLight);

        const hemiLight = new THREE.HemisphereLight(0x90ccf4, 0x0e3c4a, 1.4);
        this.scene.add(hemiLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
        this.scene.add(ambientLight);

        // 5. Ocean Surface
        const oceanGeometry = new THREE.PlaneGeometry(4000, 4000, 512, 512);
        oceanGeometry.rotateX(-Math.PI / 2);

        const wavesUniform = WAVE_CONFIG.map(w =>
            new THREE.Vector4(w[0], w[1], w[2], w[3])
        );

        this.oceanMaterial = new THREE.ShaderMaterial({
            vertexShader: oceanVertexShader,
            fragmentShader: oceanFragmentShader,
            uniforms: {
                uTime: { value: 0.0 },
                uWaves: { value: wavesUniform },
                uWaveMultiplier: { value: 1.0 },
                uDeepColor: { value: new THREE.Color(COLORS.deep) },
                uShallowColor: { value: new THREE.Color(COLORS.shallow) },
                uSunDirection: { value: sunPosition.clone().normalize() },
                uSunColor: { value: new THREE.Color(0xfff5e6) },
                uSkyColor: { value: new THREE.Color(COLORS.sky) },
                uFogColor: { value: new THREE.Color(COLORS.fog) },
                uFogDensity: { value: 0.00022 },
                uEnvMap: { value: cubeRenderTarget.texture },
                uBoatPos: { value: new THREE.Vector3(0, 0, -500) },
                uBoatHeading: { value: 0.0 },
                uBoatSpeed: { value: 0.0 },
            },
            wireframe: false,
        });

        const ocean = new THREE.Mesh(oceanGeometry, this.oceanMaterial);
        this.scene.add(ocean);

        const horizonGeometry = new THREE.RingGeometry(1950, 36000, 64);
        horizonGeometry.rotateX(-Math.PI / 2);
        const horizonOcean = new THREE.Mesh(horizonGeometry, this.oceanMaterial);
        this.scene.add(horizonOcean);

        // 6. Coastal Environment, Atmosphere & Celestials
        this.coastalEnvironment = createCoastalEnvironment();
        this.scene.add(this.coastalEnvironment);

        this.clouds = createCloudSystem();
        this.scene.add(this.clouds.group);

        const rainSystem = createRainSystem();
        this.scene.add(rainSystem.group);

        const lightningSystem = createLightningSystem();
        this.scene.add(lightningSystem.group);

        const celestials = createCelestialSystem();
        this.scene.add(celestials.group);

        // 7. 32m Commercial Trawler Vessel (ocean3: OrcaFishingTrawler)
        this.fishingBoat = createDetailedTrawlerVessel();
        this.scene.add(this.fishingBoat.group);

        // 8. Marine Ecology & Underwater Subsystems (ocean3 calibrated)
        this.seabedSystem = createSeabedSystem();
        this.scene.add(this.seabedSystem.group);

        this.vegetationSystem = createVegetationSystem();
        this.scene.add(this.vegetationSystem.group);

        this.fishSystem = createFishSystem();
        this.scene.add(this.fishSystem.group);

        this.sharkSystem = createSharkSystem();
        this.scene.add(this.sharkSystem.group);

        this.underwaterSystem = createUnderwaterSystem(this.scene);
        this.scene.add(this.underwaterSystem.group);

        // 9. Controllers
        this.boatController = new BoatController(
            this.fishingBoat.group,
            this.fishingBoat.wakeMesh,
            this.fishingBoat.bowSprayMesh,
            this.fishingBoat.antennaNode
        );

        this.cameraController = new CameraController(
            this.camera,
            this.controls,
            this.boatController
        );

        // 10. Post-Processing
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            0.22,
            0.5,
            0.92
        );
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());

        // 11. Weather System
        this.weatherSystem = new WeatherSystem(
            sky, sunPosition, sunLight, hemiLight, ambientLight, this.scene,
            this.oceanMaterial, this.composer, this.bloomPass, this.renderer,
            this.clouds, rainSystem, lightningSystem, celestials,
            this.coastalEnvironment.userData, this.fishingBoat.nightLights
        );
        this.boatController.weatherSystem = this.weatherSystem;

        // 12. Potential Fishing Zone (PFZ) GIS Analytical System (ocean3)
        this.pfzSystem = createPFZSystem(this.scene);

        // 13. Autonomous Navigation System (ocean3)
        this.navSystem = new AutonomousNavigationSystem(
            this.boatController,
            this.cameraController,
            this.pfzSystem,
            this.weatherSystem
        );

        // 14. Emergency Maritime Communication Station & Airborne Signal Beam (ocean3)
        this.emergencyCommSystem = createEmergencyCommunicationSystem(
            this.scene,
            this.boatController
        );

        // 15. Offshore Buoy
        this.offshoreBuoy = createOffshoreBuoy();
        this.scene.add(this.offshoreBuoy.group);

        // Expose digital twin controllers and systems on window for telemetry and hotkeys
        window.boatController = this.boatController;
        window.cameraController = this.cameraController;
        window.pfzSystem = this.pfzSystem;
        window.navSystem = this.navSystem;
        window.emergencyCommSystem = this.emergencyCommSystem;
        window.weatherSystem = this.weatherSystem;
        window.PFZ_CONFIG = PFZ_CONFIG;
        window.NAV_CONFIG = NAV_CONFIG;
        window.EMERGENCY_COMM_CONFIG = EMERGENCY_COMM_CONFIG;
        window.getNavigationTarget = getNavigationTarget;

        // Keydown handlers for ocean3 shortcuts
        this._keydownHandler = (e) => {
            const isInput = e.target && e.target.tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if (isInput) return;

            if (e.code === 'KeyP') {
                this.togglePfz();
            } else if (e.code === 'Space') {
                e.preventDefault();
                this.toggleNav();
            } else if (e.code === 'KeyC') {
                this.cycleCamera();
            } else if (e.code === 'KeyU') {
                this.toggleDive();
            } else if (e.code === 'Digit1') {
                this.setWeather('sunny');
            } else if (e.code === 'Digit2') {
                this.setWeather('cloudy');
            } else if (e.code === 'Digit3') {
                this.setWeather('night');
            } else if (e.code === 'Digit4') {
                this.setWeather('storm');
            }
        };
        window.addEventListener('keydown', this._keydownHandler);

        // Apply context-specific settings
        this.updateContext(context);

        // Register window resize
        window.addEventListener('resize', this._resizeHandler);

        // Start Animation Loop
        this.isMounted = true;
        this._animate();

        console.log('[OceanSimulationEngine] Successfully initialized with ocean3 assets and subsystems');
    }

    updateContext(newContext = {}) {
        this.context = { ...this.context, ...newContext };
        const { selectedPfz, weather } = this.context;

        // Map ORCA backend weather conditions if present
        if (weather && this.weatherSystem) {
            const waveHeight = typeof weather.wave_height === 'number' ? weather.wave_height : 1.2;
            const cond = (weather.weather_condition || '').toLowerCase();

            this.weatherSystem.currentWaveMultiplier = Math.max(0.65, Math.min(2.2, waveHeight / 1.1));

            if (cond.includes('storm') || waveHeight > 2.5) {
                this.weatherSystem.setWeather('storm');
            } else if (cond.includes('rain') || cond.includes('cloud') || cond.includes('overcast')) {
                this.weatherSystem.setWeather('cloudy');
            } else if (cond.includes('night')) {
                this.weatherSystem.setWeather('night');
            }
        }
    }

    startNav() {
        if (this.navSystem) {
            this.navSystem.start();
        }
    }

    stopNav() {
        if (this.navSystem) {
            this.navSystem.stop();
        }
    }

    toggleNav() {
        if (!this.navSystem) return;
        if (this.navSystem.state === 'NAVIGATING' || this.navSystem.state === 'ARRIVING') {
            this.navSystem.stop();
        } else {
            this.navSystem.start();
        }
    }

    togglePfz() {
        if (this.pfzSystem) {
            this.pfzSystem.toggle();
        }
    }

    setWeather(presetKey) {
        if (this.weatherSystem) {
            this.weatherSystem.setWeather(presetKey);
        }
    }

    cycleCamera() {
        if (this.cameraController) {
            this.cameraController.cycleMode();
        }
    }

    toggleDive() {
        if (this.cameraController) {
            this.cameraController.toggleDive();
        }
    }

    triggerDistress() {
        this.manualDistressActive = true;
        if (this.emergencyCommSystem) {
            this.emergencyCommSystem.setActive(true);
        }
        if (this.navSystem) {
            this.navSystem.startEmergencyReturn();
        }
    }

    resetDistress() {
        this.manualDistressActive = false;
        if (this.emergencyCommSystem) {
            this.emergencyCommSystem.setActive(false);
        }
        if (this.navSystem) {
            this.navSystem.stop();
        }
    }

    resize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        if (this.composer) {
            this.composer.setSize(width, height);
        }
    }

    _emitHudUpdate() {
        if (!this.onHudUpdate || !this.boatController) return;

        const knots = (Math.abs(this.boatController.speed) * 0.58).toFixed(1);
        const headingDeg = Math.round(((-this.boatController.heading * 180 / Math.PI) % 360 + 360) % 360);
        const camMode = this.cameraController ? this.cameraController.mode : 'FOLLOW';
        const depthStatus = this.underwaterSystem && this.underwaterSystem.submersionFactor > 0.5 ? 'SUBMERGED' : 'SURFACE';
        const weatherPreset = this.weatherSystem ? this.weatherSystem.currentPresetKey.toUpperCase() : 'SUNNY';

        const curZone = getPFZAtPosition(this.boatController.position.x, this.boatController.position.z);
        const zoneStr = curZone ? `${curZone.id} [${curZone.level}]` : 'OPEN SEA';

        const targetStr = (this.navSystem && this.navSystem.targetZone) ? this.navSystem.targetZone.id : '--';
        const navStatus = this.navSystem ? this.navSystem.state : 'IDLE';
        const distStr = (this.navSystem && this.navSystem.distanceToTarget > 0) ? `${Math.round(this.navSystem.distanceToTarget)} M` : '--';
        const commStatus = (this.emergencyCommSystem && this.emergencyCommSystem.isActive) ? 'EMERGENCY LINK ACTIVE' : 'STANDBY';

        this.onHudUpdate({
            speedKnots: knots,
            headingDeg,
            cameraMode: camMode,
            depthStatus,
            weatherPreset,
            distressState: navStatus,
            zone: zoneStr,
            navTarget: targetStr,
            navStatus,
            distanceToTarget: distStr,
            commStatus,
            pfzVisible: this.pfzSystem ? this.pfzSystem.visible : true,
            isStorm: this.weatherSystem ? this.weatherSystem.currentIsStorm : false,
        });
    }

    _animate() {
        if (!this.isMounted) return;
        this.animFrameId = requestAnimationFrame(() => this._animate());

        const delta = Math.min(this.clock.getDelta(), 0.1);
        const elapsed = this.clock.getElapsedTime();

        // 1. Ocean shader animation
        if (this.oceanMaterial) {
            this.oceanMaterial.uniforms.uTime.value = elapsed;
        }

        // 2. Multi-layer volumetric cloud drift
        if (this.clouds) {
            this.clouds.lowerTex.offset.x = elapsed * 0.0024;
            this.clouds.lowerTex.offset.y = elapsed * 0.0014;
            this.clouds.upperTex.offset.x = -elapsed * 0.0016;
            this.clouds.upperTex.offset.y = elapsed * 0.0009;
        }

        // 3. Vessel animation (Rotating radar scanner, propeller, and cloth fluttering flags)
        if (this.fishingBoat && this.fishingBoat.update) {
            this.fishingBoat.update(
                elapsed,
                delta,
                this.weatherSystem ? this.weatherSystem.currentIsStorm : false,
                this.boatController ? this.boatController.speed : 0
            );
        }

        // 4. Dynamic weather interpolation
        if (this.weatherSystem) {
            this.weatherSystem.update(
                delta,
                this.boatController ? this.boatController.position : null,
                this.camera.position
            );
        }

        // 5. Underwater submersion and atmosphere
        if (this.underwaterSystem) {
            this.underwaterSystem.update(
                elapsed,
                delta,
                this.camera,
                (x, z, t) => getGerstnerWaveHeight(x, z, t, this.weatherSystem ? this.weatherSystem.currentWaveMultiplier : 1.0),
                {
                    nightFactor: this.weatherSystem ? this.weatherSystem.currentNightFactor : 0,
                    isStorm: this.weatherSystem ? this.weatherSystem.currentIsStorm : false,
                },
                this.weatherSystem && this.weatherSystem.lightningSystem ? this.weatherSystem.lightningSystem.flashIntensity : 0
            );

            // Fog blending
            if (this.underwaterSystem.submersionFactor > 0.0) {
                const sub = this.underwaterSystem.submersionFactor;
                this.scene.fog.color.copy(this.weatherSystem.currentFogColor).lerp(this.underwaterSystem.currentUnderwaterColor, sub);
                this.scene.fog.density = THREE.MathUtils.lerp(this.weatherSystem.currentFogDensity, this.underwaterSystem.currentUnderwaterFogDensity, sub);
                if (this.oceanMaterial) {
                    this.oceanMaterial.uniforms.uFogColor.value.copy(this.scene.fog.color);
                    this.oceanMaterial.uniforms.uFogDensity.value = this.scene.fog.density;
                }
            }
        }

        // 6. Marine life & seabed terrain updates
        const underwaterFogCol = this.scene.fog.color;
        const underwaterFogDens = this.scene.fog.density;
        const curSunDir = this.oceanMaterial ? this.oceanMaterial.uniforms.uSunDirection.value : new THREE.Vector3(0, 1, 0);
        const curSunCol = this.oceanMaterial ? this.oceanMaterial.uniforms.uSunColor.value : new THREE.Color(1, 1, 1);
        const nightFactor = this.weatherSystem ? this.weatherSystem.currentNightFactor : 0;

        if (this.seabedSystem) {
            this.seabedSystem.update(elapsed, underwaterFogCol, underwaterFogDens, curSunDir, curSunCol, nightFactor);
        }
        if (this.vegetationSystem) {
            this.vegetationSystem.update(elapsed, underwaterFogCol, underwaterFogDens, curSunDir, curSunCol, nightFactor);
        }
        if (this.sharkSystem && this.boatController) {
            this.sharkSystem.update(elapsed, delta, this.boatController.position, underwaterFogCol, underwaterFogDens);
        }
        if (this.fishSystem && this.sharkSystem) {
            this.fishSystem.update(elapsed, delta, this.camera.position, this.sharkSystem.position, underwaterFogCol, underwaterFogDens, curSunDir, curSunCol, nightFactor);
        }

        // 7. Potential Fishing Zone (PFZ) GIS update
        if (this.pfzSystem && this.boatController) {
            this.pfzSystem.update(delta, elapsed, this.camera.position, this.boatController.position);
        }

        // 8. Autonomous Marine Navigation Autopilot update
        if (this.navSystem) {
            this.navSystem.update(delta);
        }

        // 9. Vessel Navigation Controller update
        if (this.boatController) {
            this.boatController.update(elapsed, delta);
        }

        // 10. Ocean shader local boat displacement exclusion
        if (this.oceanMaterial && this.boatController) {
            if (this.oceanMaterial.uniforms.uBoatPos) {
                this.oceanMaterial.uniforms.uBoatPos.value.copy(this.boatController.position);
                this.oceanMaterial.uniforms.uBoatHeading.value = this.boatController.heading;
                this.oceanMaterial.uniforms.uBoatSpeed.value = this.boatController.speed;
            }
        }

        // 11. Coastal Emergency Communication Station & Airborne Signal Beam update
        if (this.emergencyCommSystem) {
            const isStorm = this.weatherSystem && this.weatherSystem.currentIsStorm;
            const isEmergencyReturn = this.navSystem && (this.navSystem.state === 'AUTONOMOUS_RETURN' || this.navSystem.state === 'STORM_BLOCKED');
            if (isStorm || isEmergencyReturn || this.manualDistressActive) {
                if (!this.emergencyCommSystem.isActive) {
                    this.emergencyCommSystem.setActive(true);
                }
            } else if (!isStorm && !isEmergencyReturn && !this.manualDistressActive && this.emergencyCommSystem.isActive) {
                this.emergencyCommSystem.setActive(false);
            }
            this.emergencyCommSystem.update(elapsed, delta);
        }

        // 12. Camera update
        if (this.cameraController) {
            this.cameraController.update(elapsed, delta);
        }

        // 13. Render post-processing pass
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        // 14. Emit Telemetry HUD Update
        this._emitHudUpdate();
    }

    destroy() {
        this.isMounted = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        window.removeEventListener('resize', this._resizeHandler);
        if (this._keydownHandler) {
            window.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }

        if (this.boatController && this.boatController.dispose) {
            this.boatController.dispose();
        }

        if (this.emergencyCommSystem && this.emergencyCommSystem.dispose) {
            this.emergencyCommSystem.dispose();
        }

        if (this.controls) {
            this.controls.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }

        // Clean up globals
        if (window.boatController === this.boatController) delete window.boatController;
        if (window.cameraController === this.cameraController) delete window.cameraController;
        if (window.pfzSystem === this.pfzSystem) delete window.pfzSystem;
        if (window.navSystem === this.navSystem) delete window.navSystem;
        if (window.emergencyCommSystem === this.emergencyCommSystem) delete window.emergencyCommSystem;
        if (window.weatherSystem === this.weatherSystem) delete window.weatherSystem;
    }
}

