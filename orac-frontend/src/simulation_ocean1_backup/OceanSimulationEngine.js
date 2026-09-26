/**
 * ORCA 3D Ocean Simulation Engine
 * High-performance procedural Three.js ocean system with Gerstner waves,
 * dynamic weather/atmospheric engine, marine life, and tactical navigation beacon.
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

import { createFishingBoat, BoatController } from './boat.js';
import { CameraController } from './camera.js';
import { WEATHER_PRESETS, WeatherSystem } from './weather.js';
import { createSeabedSystem } from './seabed.js';
import { createVegetationSystem } from './vegetation.js';
import { createFishSystem } from './fish.js';
import { createSharkSystem } from './shark.js';
import { createUnderwaterSystem } from './underwater.js';
import { DistressSystem } from './distress.js';

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
        this.distressSystem = null;
        this.underwaterSystem = null;
        this.seabedSystem = null;
        this.vegetationSystem = null;
        this.fishSystem = null;
        this.sharkSystem = null;

        this.clouds = null;
        this.fishingBoat = null;
        this.offshoreBuoy = null;
        this.coastalEnvironment = null;
        this.oceanMaterial = null;

        this.pfzBeaconGroup = null;
        this.secondaryPfzMarkers = [];
        this.courseLine = null;
        this.selectedPfzPos = null;

        this.animFrameId = null;
        this.isMounted = false;
        this.onHudUpdate = null;
        this.context = {};

        this._resizeHandler = () => this.resize();
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
        this.camera.position.set(-65, 32, 105);
        this.camera.lookAt(-5, 5, 10);

        // 3. OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI * 0.98;
        this.controls.minPolarAngle = 0.02;
        this.controls.minDistance = 6;
        this.controls.maxDistance = 3500;
        this.controls.target.set(-8, 3.5, 22);

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

        // 7. Vessel & Marine Subsystems
        this.fishingBoat = createFishingBoat();
        this.scene.add(this.fishingBoat.group);

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

        // Controllers
        this.boatController = new BoatController(
            this.fishingBoat.group,
            this.fishingBoat.wakeMesh,
            this.fishingBoat.bowSprayMesh
        );

        this.cameraController = new CameraController(
            this.camera,
            this.controls,
            this.boatController
        );

        // 8. Post-Processing
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

        // 9. Weather System
        this.weatherSystem = new WeatherSystem(
            sky, sunPosition, sunLight, hemiLight, ambientLight, this.scene,
            this.oceanMaterial, this.composer, this.bloomPass, this.renderer,
            this.clouds, rainSystem, lightningSystem, celestials,
            this.coastalEnvironment.userData, this.fishingBoat.nightLights
        );
        this.boatController.weatherSystem = this.weatherSystem;

        // 10. Offshore Buoy & Distress Subsystem
        this.offshoreBuoy = createOffshoreBuoy();
        this.scene.add(this.offshoreBuoy.group);

        this.distressSystem = new DistressSystem();
        this.distressSystem.init({
            scene: this.scene,
            camera: this.camera,
            boat: this.boatController,
            weatherSystem: this.weatherSystem,
            coastalBeaconPos: this.coastalEnvironment.userData.beaconPos,
            offshoreBuoyPos: this.offshoreBuoy.group.position,
            handheldDevice: this.fishingBoat.handheldDevice,
        });
        this.weatherSystem.distressSystem = this.distressSystem;

        // 11. PFZ Target Beacon & Course Vector
        this._initPfzSystem();

        // Apply context-specific settings
        this.updateContext(context);

        // Register window resize
        window.addEventListener('resize', this._resizeHandler);

        // Start Animation Loop
        this.isMounted = true;
        this._animate();
    }

    _initPfzSystem() {
        this.pfzBeaconGroup = new THREE.Group();
        this.pfzBeaconGroup.name = 'ORCA_PFZ_PRIMARY_BEACON';

        // Glowing vertical light pillar
        const columnGeo = new THREE.CylinderGeometry(2.0, 5.0, 220, 16, 1, true);
        columnGeo.translate(0, 110, 0);
        const columnMat = new THREE.MeshBasicMaterial({
            color: 0x00f0d0,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const columnMesh = new THREE.Mesh(columnGeo, columnMat);
        this.pfzBeaconGroup.add(columnMesh);

        // Inner radiant beam core
        const coreGeo = new THREE.CylinderGeometry(0.5, 0.8, 240, 8, 1, true);
        coreGeo.translate(0, 120, 0);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        this.pfzBeaconGroup.add(coreMesh);

        // Concentric pulsing water rings
        const ringGeo = new THREE.RingGeometry(8, 12, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x00ffaa,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.y = 0.5;
        this.pfzBeaconGroup.add(ringMesh);

        // Surface glowing marker orb
        const orbGeo = new THREE.SphereGeometry(4.0, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({
            color: 0x00f0d0,
            emissive: 0x00f0d0,
            emissiveIntensity: 1.5,
            roughness: 0.2,
        });
        const orbMesh = new THREE.Mesh(orbGeo, orbMat);
        orbMesh.position.y = 4.0;
        this.pfzBeaconGroup.add(orbMesh);

        // Pulsing PointLight
        const pointLight = new THREE.PointLight(0x00f0d0, 4.0, 400, 1.2);
        pointLight.position.y = 10.0;
        this.pfzBeaconGroup.add(pointLight);

        this.pfzBeaconGroup.userData = {
            ringMesh,
            columnMesh,
            pointLight,
            phase: 0,
            sprite: null
        };
        this.scene.add(this.pfzBeaconGroup);

        // Course Vector Line
        const lineGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const lineMat = new THREE.LineDashedMaterial({
            color: 0x00f0d0,
            linewidth: 2,
            dashSize: 6,
            gapSize: 3,
            transparent: true,
            opacity: 0.8,
        });
        this.courseLine = new THREE.Line(lineGeo, lineMat);
        this.scene.add(this.courseLine);
    }

    _createPfzLabelSprite(pfz) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 140;
        const ctx = canvas.getContext('2d');

        // Background pill
        ctx.fillStyle = 'rgba(6, 20, 28, 0.88)';
        ctx.strokeStyle = '#00f0d0';
        ctx.lineWidth = 4;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(8, 8, 496, 124, 16);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(8, 8, 496, 124);
            ctx.strokeRect(8, 8, 496, 124);
        }

        ctx.fillStyle = '#00ffaa';
        ctx.font = 'bold 34px monospace';
        ctx.textAlign = 'center';
        const rankStr = `PFZ CANDIDATE #${pfz.rank || 1}${pfz.is_recommended || pfz.rank === 1 ? ' [TOP PIC]' : ''}`;
        ctx.fillText(rankStr, 256, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = '22px monospace';
        const distStr = `${(pfz.distance_km || 0).toFixed(1)} km · ${(pfz.bearing_deg || 0).toFixed(0)}° · FDI: ${(pfz.fish_density_index || 0).toFixed(1)}`;
        ctx.fillText(distStr, 256, 88);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '18px monospace';
        const species = Array.isArray(pfz.target_species) ? pfz.target_species.slice(0, 2).join(', ') : (pfz.target_species || 'Tuna, Mackerel');
        ctx.fillText(`Target: ${species}`, 256, 118);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(45, 12, 1);
        sprite.position.set(0, 38, 0);
        return sprite;
    }

    computePfzPosition(pfz, boatPos) {
        const bearing = pfz.bearing_deg !== undefined ? pfz.bearing_deg : 0;
        const distKm = pfz.distance_km !== undefined ? pfz.distance_km : 15.0;
        const rad = (bearing * Math.PI) / 180;
        // Scale distance to scene coordinates: 350 to 1100 units
        const sceneDist = Math.max(350, Math.min(1100, 250 + distKm * 18));
        const baseX = boatPos ? boatPos.x : -8.0;
        const baseZ = boatPos ? boatPos.z : 22.0;

        // Nautical coordinates: 0° is North (-Z), 90° is East (+X)
        const targetX = baseX + Math.sin(rad) * sceneDist;
        const targetZ = baseZ - Math.cos(rad) * sceneDist;
        return new THREE.Vector3(targetX, 0, targetZ);
    }

    updateContext(newContext = {}) {
        this.context = { ...this.context, ...newContext };
        const { selectedPfz, allCandidates = [], weather } = this.context;

        // 1. Update Primary PFZ Beacon
        const targetPfz = selectedPfz || (allCandidates.length > 0 ? allCandidates[0] : { rank: 1, distance_km: 18.5, bearing_deg: 245, fish_density_index: 7.8 });
        const boatPos = this.boatController ? this.boatController.position : new THREE.Vector3(-8, 0, 22);
        this.selectedPfzPos = this.computePfzPosition(targetPfz, boatPos);

        if (this.pfzBeaconGroup) {
            this.pfzBeaconGroup.position.set(this.selectedPfzPos.x, 0, this.selectedPfzPos.z);
            if (this.pfzBeaconGroup.userData.sprite) {
                this.pfzBeaconGroup.remove(this.pfzBeaconGroup.userData.sprite);
            }
            const sprite = this._createPfzLabelSprite(targetPfz);
            this.pfzBeaconGroup.add(sprite);
            this.pfzBeaconGroup.userData.sprite = sprite;
        }

        // 2. Update Secondary PFZ Markers for other candidates
        this.secondaryPfzMarkers.forEach(m => this.scene.remove(m));
        this.secondaryPfzMarkers = [];

        const radarTargets = [];
        allCandidates.forEach((cand) => {
            const isSelected = (cand.rank === targetPfz.rank);
            const pos = this.computePfzPosition(cand, boatPos);
            radarTargets.push({
                x: pos.x,
                z: pos.z,
                rank: cand.rank,
                isSelected
            });

            if (!isSelected) {
                const secGroup = new THREE.Group();
                secGroup.position.set(pos.x, 0, pos.z);

                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(4, 6, 16),
                    new THREE.MeshBasicMaterial({ color: 0x00a8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
                );
                ring.rotateX(-Math.PI / 2);
                ring.position.y = 0.5;
                secGroup.add(ring);

                const orb = new THREE.Mesh(
                    new THREE.SphereGeometry(2.5, 12, 12),
                    new THREE.MeshBasicMaterial({ color: 0x00a8ff })
                );
                orb.position.y = 2.5;
                secGroup.add(orb);

                this.secondaryPfzMarkers.push(secGroup);
                this.scene.add(secGroup);
            }
        });

        // Pass radar targets to distress radar renderer
        if (this.distressSystem) {
            this.distressSystem.pfzTargets = radarTargets;
        }

        // 3. Map ORCA backend weather conditions if present
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
        if (this.distressSystem) {
            this.distressSystem.trigger();
        }
    }

    resetDistress() {
        if (this.distressSystem) {
            this.distressSystem.reset();
        }
    }

    resize() {
        if (!this.container || !this.renderer || !this.camera || !this.composer) return;
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
        if (this.bloomPass) {
            this.bloomPass.resolution.set(w, h);
        }
    }

    _animate() {
        if (!this.isMounted) return;
        this.animFrameId = requestAnimationFrame(() => this._animate());

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        // 1. Ocean shader time uniform
        if (this.oceanMaterial) {
            this.oceanMaterial.uniforms.uTime.value = elapsed;
        }

        // 2. Multi-layer drifting cloud offsets
        if (this.clouds) {
            this.clouds.lowerTex.offset.x = elapsed * 0.0024;
            this.clouds.lowerTex.offset.y = elapsed * 0.0014;
            this.clouds.upperTex.offset.x = -elapsed * 0.0016;
            this.clouds.upperTex.offset.y = elapsed * 0.0009;
        }

        // 3. Rotating vessel radar scanner
        if (this.fishingBoat && this.fishingBoat.radarScanner) {
            this.fishingBoat.radarScanner.rotation.y += delta * 2.6;
        }

        // 4. Weather interpolation
        if (this.weatherSystem) {
            this.weatherSystem.update(delta, this.boatController.position, this.camera.position);
        }

        // 5. Underwater & Submersion atmosphere
        if (this.underwaterSystem) {
            this.underwaterSystem.update(
                elapsed, delta, this.camera,
                (x, z, t) => getGerstnerWaveHeight(x, z, t, this.weatherSystem ? this.weatherSystem.currentWaveMultiplier : 1.0),
                { nightFactor: this.weatherSystem ? this.weatherSystem.currentNightFactor : 0, isStorm: this.weatherSystem ? this.weatherSystem.currentIsStorm : false },
                0.0
            );

            if (this.underwaterSystem.submersionFactor > 0.0) {
                const sub = this.underwaterSystem.submersionFactor;
                this.scene.fog.color.copy(this.weatherSystem.currentFogColor).lerp(this.underwaterSystem.currentUnderwaterColor, sub);
                this.scene.fog.density = THREE.MathUtils.lerp(this.weatherSystem.currentFogDensity, this.underwaterSystem.currentUnderwaterFogDensity, sub);
                this.oceanMaterial.uniforms.uFogColor.value.copy(this.scene.fog.color);
                this.oceanMaterial.uniforms.uFogDensity.value = this.scene.fog.density;
            }
        }

        // 6. Marine life & seabed updates
        const curSunDir = this.oceanMaterial ? this.oceanMaterial.uniforms.uSunDirection.value : new THREE.Vector3(0, 1, 0);
        const curSunCol = this.oceanMaterial ? this.oceanMaterial.uniforms.uSunColor.value : new THREE.Color(0xffffff);
        const nightFactor = this.weatherSystem ? this.weatherSystem.currentNightFactor : 0.0;
        const underFogCol = this.scene.fog.color;
        const underFogDens = this.scene.fog.density;

        if (this.seabedSystem) this.seabedSystem.update(elapsed, underFogCol, underFogDens, curSunDir, curSunCol, nightFactor);
        if (this.vegetationSystem) this.vegetationSystem.update(elapsed, underFogCol, underFogDens, curSunDir, curSunCol, nightFactor);
        if (this.sharkSystem) this.sharkSystem.update(elapsed, delta, this.boatController.position, underFogCol, underFogDens);
        if (this.fishSystem) this.fishSystem.update(elapsed, delta, this.camera.position, this.sharkSystem.position, underFogCol, underFogDens, curSunDir, curSunCol, nightFactor);

        // 7. Vessel navigation & wave physics
        if (this.boatController) {
            this.boatController.update(elapsed, delta);
        }

        // 8. Offshore buoy wave buoyancy
        if (this.offshoreBuoy && this.offshoreBuoy.update) {
            this.offshoreBuoy.update(elapsed);
        }

        // 9. Distress System
        if (this.distressSystem) {
            this.distressSystem.update(elapsed, delta, this.boatController);
        }

        // 10. PFZ Beacon pulsing & Course Vector Line
        if (this.pfzBeaconGroup) {
            const u = this.pfzBeaconGroup.userData;
            u.phase = (u.phase + delta * 2.2) % (Math.PI * 2);
            const pulse = 1.0 + 0.3 * Math.sin(u.phase);
            u.ringMesh.scale.set(pulse, pulse, 1.0);
            u.pointLight.intensity = 3.0 + 2.0 * Math.sin(u.phase * 1.5);
        }

        if (this.courseLine && this.selectedPfzPos && this.boatController) {
            const posAttr = this.courseLine.geometry.attributes.position;
            posAttr.setXYZ(0, this.boatController.position.x, this.boatController.position.y + 1.8, this.boatController.position.z);
            posAttr.setXYZ(1, this.selectedPfzPos.x, 2.5, this.selectedPfzPos.z);
            posAttr.needsUpdate = true;
            this.courseLine.computeLineDistances();
        }

        // 11. Camera update
        if (this.cameraController) {
            this.cameraController.update(elapsed, delta);
        }

        // 12. Render via Post-Processing Composer
        if (this.composer) {
            this.composer.render();
        }

        // 13. HUD Callback
        if (this.onHudUpdate && this.boatController && this.cameraController && this.weatherSystem) {
            const waveY = getGerstnerWaveHeight(
                this.camera.position.x,
                this.camera.position.z,
                elapsed,
                this.weatherSystem.currentWaveMultiplier
            );
            const depth = waveY - this.camera.position.y;
            const headingDeg = THREE.MathUtils.radToDeg(this.boatController.heading);
            const normHeading = Math.round((headingDeg % 360 + 360) % 360);

            this.onHudUpdate({
                speedKnots: Math.abs(this.boatController.speed * 0.58).toFixed(1),
                headingDeg: normHeading,
                cameraMode: this.cameraController.mode.toUpperCase(),
                depthStatus: depth > 0.4 ? - M : 'SURFACE',
                weatherPreset: this.weatherSystem.currentPresetKey.toUpperCase(),
                distressState: this.distressSystem ? this.distressSystem.state : 'IDLE',
            });
        }
    }

    destroy() {
        this.isMounted = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        window.removeEventListener('resize', this._resizeHandler);

        if (this.boatController && this.boatController.dispose) {
            this.boatController.dispose();
        }
        if (this.cameraController && this.cameraController.dispose) {
            this.cameraController.dispose();
        }
        if (this.weatherSystem && this.weatherSystem.dispose) {
            this.weatherSystem.dispose();
        }
        if (this.distressSystem && this.distressSystem.dispose) {
            this.distressSystem.dispose();
        }

        if (this.controls && this.controls.dispose) {
            this.controls.dispose();
        }

        // Remove canvas from container
        if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        if (this.renderer && this.renderer.dispose) {
            this.renderer.dispose();
        }
    }
}
