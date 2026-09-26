import * as THREE from 'three';
import { WAVE_CONFIG } from './oceanShaders';

export const WEATHER_PRESETS = {
    sunny: {
        name: 'SUNNY',
        sunElevation: 26,
        sunAzimuth: 155,
        turbidity: 2.2,
        rayleigh: 1.2,
        mieCoefficient: 0.003,
        mieDirectionalG: 0.85,
        sunLightColor: new THREE.Color(0xfff8ed),
        sunLightIntensity: 2.8,
        hemiSkyColor: new THREE.Color(0x90ccf4),
        hemiGroundColor: new THREE.Color(0x0e3c4a),
        hemiIntensity: 1.4,
        ambientLightColor: new THREE.Color(0xffffff),
        ambientLightIntensity: 0.45,
        fogColor: new THREE.Color(0.68, 0.78, 0.88),
        fogDensity: 0.00022,
        oceanDeep: new THREE.Color(0.005, 0.045, 0.12),
        oceanShallow: new THREE.Color(0.04, 0.35, 0.44),
        oceanSunColor: new THREE.Color(1.0, 0.97, 0.90),
        exposure: 0.62,
        bloomStrength: 0.22,
        waveMultiplier: 1.0,
        cloudColor: new THREE.Color(0xffffff),
        cloudOpacity: 0.55,
        upperCloudOpacity: 0.35,
        rainIntensity: 0.0,
        nightFactor: 0.0,
        cityEmissive: 0.0,
        boatLights: 0.0,
        isStorm: false,
    },
    cloudy: {
        name: 'CLOUDY',
        sunElevation: 20,
        sunAzimuth: 140,
        turbidity: 6.8,
        rayleigh: 2.6,
        mieCoefficient: 0.012,
        mieDirectionalG: 0.8,
        sunLightColor: new THREE.Color(0xd2e0ec),
        sunLightIntensity: 1.3,
        hemiSkyColor: new THREE.Color(0x6e889a),
        hemiGroundColor: new THREE.Color(0x182834),
        hemiIntensity: 0.95,
        ambientLightColor: new THREE.Color(0xa2b2be),
        ambientLightIntensity: 0.55,
        fogColor: new THREE.Color(0.52, 0.60, 0.68),
        fogDensity: 0.00035,
        oceanDeep: new THREE.Color(0.008, 0.035, 0.08),
        oceanShallow: new THREE.Color(0.03, 0.22, 0.28),
        oceanSunColor: new THREE.Color(0.8, 0.85, 0.9),
        exposure: 0.52,
        bloomStrength: 0.18,
        waveMultiplier: 1.18,
        cloudColor: new THREE.Color(0x8e9ca8),
        cloudOpacity: 0.85,
        upperCloudOpacity: 0.65,
        rainIntensity: 0.08,
        nightFactor: 0.0,
        cityEmissive: 0.15,
        boatLights: 0.2,
        isStorm: false,
    },
    night: {
        name: 'NIGHT',
        sunElevation: -14, // below horizon
        sunAzimuth: 155,
        turbidity: 1.8,
        rayleigh: 0.4,
        mieCoefficient: 0.002,
        mieDirectionalG: 0.8,
        sunLightColor: new THREE.Color(0x020408),
        sunLightIntensity: 0.0,
        hemiSkyColor: new THREE.Color(0x0c1a2e),
        hemiGroundColor: new THREE.Color(0x020810),
        hemiIntensity: 0.35,
        ambientLightColor: new THREE.Color(0x0e1c30),
        ambientLightIntensity: 0.25,
        fogColor: new THREE.Color(0.03, 0.06, 0.12),
        fogDensity: 0.00028,
        oceanDeep: new THREE.Color(0.001, 0.008, 0.02),
        oceanShallow: new THREE.Color(0.005, 0.03, 0.06),
        oceanSunColor: new THREE.Color(0.45, 0.60, 0.82), // moonlight reflection
        exposure: 0.42,
        bloomStrength: 0.45,
        waveMultiplier: 0.95,
        cloudColor: new THREE.Color(0x121a28),
        cloudOpacity: 0.40,
        upperCloudOpacity: 0.25,
        rainIntensity: 0.0,
        nightFactor: 1.0,
        cityEmissive: 1.0,
        boatLights: 1.0,
        isStorm: false,
    },
    storm: {
        name: 'STORM',
        sunElevation: 10,
        sunAzimuth: 125,
        turbidity: 9.8,
        rayleigh: 4.8,
        mieCoefficient: 0.035,
        mieDirectionalG: 0.72,
        sunLightColor: new THREE.Color(0x455260),
        sunLightIntensity: 0.45,
        hemiSkyColor: new THREE.Color(0x28343e),
        hemiGroundColor: new THREE.Color(0x0a1014),
        hemiIntensity: 0.45,
        ambientLightColor: new THREE.Color(0x35424c),
        ambientLightIntensity: 0.35,
        fogColor: new THREE.Color(0.16, 0.20, 0.25),
        fogDensity: 0.00048,
        oceanDeep: new THREE.Color(0.002, 0.015, 0.025),
        oceanShallow: new THREE.Color(0.01, 0.09, 0.11),
        oceanSunColor: new THREE.Color(0.35, 0.4, 0.48),
        exposure: 0.38,
        bloomStrength: 0.35,
        waveMultiplier: 1.6, // dramatic storm swells & foam!
        cloudColor: new THREE.Color(0x1a2128),
        cloudOpacity: 0.96,
        upperCloudOpacity: 0.88,
        rainIntensity: 1.0,
        nightFactor: 0.0,
        cityEmissive: 0.65,
        boatLights: 1.0,
        isStorm: true,
    }
};
export class WeatherSystem {
    constructor(sky, sunPosition, sunLight, hemiLight, ambientLight, scene, oceanMaterial, composer, bloomPass, renderer, clouds, rainSystem, lightningSystem, celestials, cityData, boatNightLights) {
        this.sky = sky;
        this.sunPosition = sunPosition;
        this.sunLight = sunLight;
        this.hemiLight = hemiLight;
        this.ambientLight = ambientLight;
        this.scene = scene;
        this.oceanMaterial = oceanMaterial;
        this.composer = composer;
        this.bloomPass = bloomPass;
        this.renderer = renderer;
        this.clouds = clouds;
        this.rainSystem = rainSystem;
        this.lightningSystem = lightningSystem;
        this.celestials = celestials;
        this.cityData = cityData;
        this.boatNightLights = boatNightLights;

        this.currentPresetKey = 'sunny';
        this.targetPreset = WEATHER_PRESETS.sunny;

        const s = WEATHER_PRESETS.sunny;
        this.currentSunElevation = s.sunElevation;
        this.currentSunAzimuth = s.sunAzimuth;
        this.currentTurbidity = s.turbidity;
        this.currentRayleigh = s.rayleigh;
        this.currentMieCoefficient = s.mieCoefficient;
        this.currentMieDirectionalG = s.mieDirectionalG;

        this.currentSunLightColor = s.sunLightColor.clone();
        this.currentSunLightIntensity = s.sunLightIntensity;

        this.currentHemiSkyColor = s.hemiSkyColor.clone();
        this.currentHemiGroundColor = s.hemiGroundColor.clone();
        this.currentHemiIntensity = s.hemiIntensity;

        this.currentAmbientColor = s.ambientLightColor.clone();
        this.currentAmbientIntensity = s.ambientLightIntensity;

        this.currentFogColor = s.fogColor.clone();
        this.currentFogDensity = s.fogDensity;

        this.currentOceanDeep = s.oceanDeep.clone();
        this.currentOceanShallow = s.oceanShallow.clone();
        this.currentOceanSunColor = s.oceanSunColor.clone();

        this.currentExposure = s.exposure;
        this.currentBloom = s.bloomStrength;
        this.currentWaveMultiplier = s.waveMultiplier;

        this.currentCloudColor = s.cloudColor.clone();
        this.currentCloudOpacity = s.cloudOpacity;
        this.currentUpperCloudOpacity = s.upperCloudOpacity;

        this.currentRainIntensity = s.rainIntensity;
        this.currentNightFactor = s.nightFactor;
        this.currentCityEmissive = s.cityEmissive;
        this.currentBoatLights = s.boatLights;
        this.currentIsStorm = s.isStorm;

        this.setupUI();
    }

    setupUI() {
        this._onBtnClick = (e) => {
            const btn = e.target.closest ? e.target.closest('.weather-btn') : null;
            if (btn) {
                const w = btn.dataset.weather;
                if (w && WEATHER_PRESETS[w]) {
                    this.setWeather(w);
                }
            }
        };
        this._onKeyDown = (e) => {
            if (e.code === 'Digit1') this.setWeather('sunny');
            if (e.code === 'Digit2') this.setWeather('cloudy');
            if (e.code === 'Digit3') this.setWeather('night');
            if (e.code === 'Digit4') this.setWeather('storm');
        };
        document.addEventListener('click', this._onBtnClick);
        window.addEventListener('keydown', this._onKeyDown);
    }

    dispose() {
        if (this._onBtnClick) document.removeEventListener('click', this._onBtnClick);
        if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    }

    setWeather(key) {
        if (!WEATHER_PRESETS[key]) return;
        this.currentPresetKey = key;
        this.targetPreset = WEATHER_PRESETS[key];

        const buttons = document.querySelectorAll('.weather-btn');
        buttons.forEach(btn => {
            if (btn.dataset.weather === key) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const badge = document.getElementById('weather-val');
        if (badge) {
            badge.textContent = this.targetPreset.name;
        }
        if (this.distressSystem) {
            if (key === 'storm') {
                this.distressSystem.trigger();
            } else {
                this.distressSystem.reset();
            }
        }
    }

    update(delta, boatPos, cameraPos) {
        const dt = Math.min(delta, 0.1);
        const rate = 2.8;

        const t = this.targetPreset;

        this.currentSunElevation = THREE.MathUtils.damp(this.currentSunElevation, t.sunElevation, rate, dt);
        this.currentSunAzimuth = THREE.MathUtils.damp(this.currentSunAzimuth, t.sunAzimuth, rate, dt);
        this.currentTurbidity = THREE.MathUtils.damp(this.currentTurbidity, t.turbidity, rate, dt);
        this.currentRayleigh = THREE.MathUtils.damp(this.currentRayleigh, t.rayleigh, rate, dt);
        this.currentMieCoefficient = THREE.MathUtils.damp(this.currentMieCoefficient, t.mieCoefficient, rate, dt);
        this.currentMieDirectionalG = THREE.MathUtils.damp(this.currentMieDirectionalG, t.mieDirectionalG, rate, dt);

        this.currentSunLightColor.lerp(t.sunLightColor, rate * dt);
        this.currentSunLightIntensity = THREE.MathUtils.damp(this.currentSunLightIntensity, t.sunLightIntensity, rate, dt);

        this.currentHemiSkyColor.lerp(t.hemiSkyColor, rate * dt);
        this.currentHemiGroundColor.lerp(t.hemiGroundColor, rate * dt);
        this.currentHemiIntensity = THREE.MathUtils.damp(this.currentHemiIntensity, t.hemiIntensity, rate, dt);

        this.currentAmbientColor.lerp(t.ambientLightColor, rate * dt);
        this.currentAmbientIntensity = THREE.MathUtils.damp(this.currentAmbientIntensity, t.ambientLightIntensity, rate, dt);

        this.currentFogColor.lerp(t.fogColor, rate * dt);
        this.currentFogDensity = THREE.MathUtils.damp(this.currentFogDensity, t.fogDensity, rate, dt);

        this.currentOceanDeep.lerp(t.oceanDeep, rate * dt);
        this.currentOceanShallow.lerp(t.oceanShallow, rate * dt);
        this.currentOceanSunColor.lerp(t.oceanSunColor, rate * dt);

        this.currentExposure = THREE.MathUtils.damp(this.currentExposure, t.exposure, rate, dt);
        this.currentBloom = THREE.MathUtils.damp(this.currentBloom, t.bloomStrength, rate, dt);
        this.currentWaveMultiplier = THREE.MathUtils.damp(this.currentWaveMultiplier, t.waveMultiplier, rate, dt);

        this.currentCloudColor.lerp(t.cloudColor, rate * dt);
        this.currentCloudOpacity = THREE.MathUtils.damp(this.currentCloudOpacity, t.cloudOpacity, rate, dt);
        this.currentUpperCloudOpacity = THREE.MathUtils.damp(this.currentUpperCloudOpacity, t.upperCloudOpacity, rate, dt);

        this.currentRainIntensity = THREE.MathUtils.damp(this.currentRainIntensity, t.rainIntensity, rate, dt);
        this.currentNightFactor = THREE.MathUtils.damp(this.currentNightFactor, t.nightFactor, rate, dt);
        this.currentCityEmissive = THREE.MathUtils.damp(this.currentCityEmissive, t.cityEmissive, rate, dt);
        this.currentBoatLights = THREE.MathUtils.damp(this.currentBoatLights, t.boatLights, rate, dt);
        this.currentIsStorm = t.isStorm;

        // 1. Sky & Sun Coordinates
        const phi = THREE.MathUtils.degToRad(90 - this.currentSunElevation);
        const theta = THREE.MathUtils.degToRad(this.currentSunAzimuth);
        this.sunPosition.setFromSphericalCoords(1, phi, theta);

        this.sky.material.uniforms['turbidity'].value = this.currentTurbidity;
        this.sky.material.uniforms['rayleigh'].value = this.currentRayleigh;
        this.sky.material.uniforms['mieCoefficient'].value = this.currentMieCoefficient;
        this.sky.material.uniforms['mieDirectionalG'].value = this.currentMieDirectionalG;
        this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);

        // 2. Sun / Ambient / Hemisphere Lighting
        this.sunLight.color.copy(this.currentSunLightColor);
        this.sunLight.intensity = this.currentSunLightIntensity;
        this.sunLight.position.copy(this.sunPosition).multiplyScalar(4500);

        this.hemiLight.color.copy(this.currentHemiSkyColor);
        this.hemiLight.groundColor.copy(this.currentHemiGroundColor);
        this.hemiLight.intensity = this.currentHemiIntensity;

        this.ambientLight.color.copy(this.currentAmbientColor);
        this.ambientLight.intensity = this.currentAmbientIntensity;

        // 3. Scene Fog
        this.scene.fog.color.copy(this.currentFogColor);
        this.scene.fog.density = this.currentFogDensity;

        // 4. Ocean Shader Uniforms
        const u = this.oceanMaterial.uniforms;
        u.uDeepColor.value.copy(this.currentOceanDeep);
        u.uShallowColor.value.copy(this.currentOceanShallow);
        u.uSunColor.value.copy(this.currentOceanSunColor);

        // In night mode, point specular glints to moon; otherwise to sun
        if (this.currentNightFactor > 0.4) {
            const moonDir = this.celestials.moonPos.clone().normalize();
            u.uSunDirection.value.lerp(moonDir, this.currentNightFactor);
        } else {
            u.uSunDirection.value.copy(this.sunPosition).normalize();
        }

        u.uFogColor.value.copy(this.currentFogColor);
        u.uFogDensity.value = this.currentFogDensity;

        // Scale wave amplitudes with waveMultiplier
        for (let i = 0; i < 12; i++) {
            u.uWaves.value[i].z = WAVE_CONFIG[i][2] * this.currentWaveMultiplier;
        }

        // 5. Post-Processing & Lightning Flashes
        let finalExposure = this.currentExposure;
        this.lightningSystem.update(dt, this.currentIsStorm, boatPos);

        if (this.lightningSystem.isFlashing) {
            const flashPulse = this.lightningSystem.flashIntensity;
            this.sunLight.intensity += 4.5 * flashPulse;
            this.ambientLight.intensity += 2.0 * flashPulse;
            finalExposure += 1.3 * flashPulse;
        }

        this.renderer.toneMappingExposure = finalExposure;
        this.bloomPass.strength = this.currentBloom;

        // 6. Clouds
        this.clouds.lowerMesh.material.color.copy(this.currentCloudColor);
        this.clouds.lowerMesh.material.opacity = this.currentCloudOpacity;
        this.clouds.upperMesh.material.color.copy(this.currentCloudColor);
        this.clouds.upperMesh.material.opacity = this.currentUpperCloudOpacity;

        // 7. Rain System
        this.rainSystem.update(dt, boatPos, this.currentRainIntensity);

        // 8. Celestials (Moon & Stars)
        this.celestials.update(dt, this.currentNightFactor, cameraPos);

        // 9. Coastal City Night Lights
        if (this.cityData) {
            if (this.cityData.cityMaterials) {
                this.cityData.cityMaterials.forEach(m => {
                    m.emissiveIntensity = this.currentCityEmissive;
                });
            }
            if (this.cityData.streetLightMat) {
                this.cityData.streetLightMat.emissiveIntensity = this.currentCityEmissive;
            }
        }

        // 10. Boat Night Illumination
        if (this.boatNightLights) {
            this.boatNightLights.setIntensity(this.currentBoatLights);
        }
    }
}
