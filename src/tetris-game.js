import './style.css';
import { animate } from 'motion';
import {
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    ShaderMaterial,
    Mesh,
    AmbientLight,
    DirectionalLight,
    Group,
    Box3,
    Vector3,
    Vector2,
    LinearFilter,
    CanvasTexture,
    TextureLoader,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; 
import { gameOverMaterial, tetrisMaterial } from './shader_modules/shader-materials.js';

import { ControlPanel, StatsPanel } from './statistics.js';
import { 
    getGameState, 
    GG as endOfGame,
    gameloop,
} from './Tetris-logic.js';
import './controller.js';


const canvasTag = document.querySelector("section.gameboymodel");

export const scene = new Scene();
export const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.set(0, 0, 2);

export const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
canvasTag.appendChild(renderer.domElement);

//
const params = { minScale: 10, maxScale: 20, rotate: true };
const controlsContainer = document.getElementById('controls-container');
const controlPanel = new ControlPanel(params, controlsContainer);
const statsPanel = new StatsPanel(controlsContainer);
//

// Lights
const light = new AmbientLight(0xffffff);
const keyLight = new DirectionalLight(0xffffff, 1);
keyLight.position.set(-1, 1, 3);
const fillLight = new DirectionalLight(0xffffff, 0.5);
fillLight.position.set(1, 1, 3);
const backlight = new DirectionalLight(0xffffff, 1);
backlight.position.set(-1, -3, -1);
camera.add(light, keyLight, fillLight, backlight);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = true;
controls.enableZoom = true;



const fontTexture = new CanvasTexture(canvasTag);
fontTexture.minFilter = LinearFilter;
fontTexture.magFilter = LinearFilter;

const textureLoader = new TextureLoader();
gameOverMaterial.uniforms.u_fontAtlas = { value: textureLoader.load('./public/texture_atlases/game_over.png') };
gameOverMaterial.uniforms.u_pleaseAtlas = { value: textureLoader.load('./public/texture_atlases/atlas_PLEASE.png') };
gameOverMaterial.uniforms.u_tryAtlas = { value: textureLoader.load('./public/texture_atlases/atlas_TRY.png') };
gameOverMaterial.uniforms.u_againAtlas = { value: textureLoader.load('./public/texture_atlases/atlas_AGAIN.png') };


// Groups
export const loadGroup = new Group();
export const scrollGroup = new Group();
scrollGroup.add(loadGroup);
scene.add(scrollGroup);

// Load Models
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load("/models/gameboy_anims.glb", (gltf) => {
    loadGroup.add(gltf.scene);
});

gltfLoader.load("/models/screen.glb", (gltf) => {
    // Tag this as screen for later identification
    gltf.scene.isScreen = true;
    
    gltf.scene.traverse(child => {
        if (child.isMesh) {
            child.material = tetrisMaterial;

            const box = new Box3().setFromObject(child);
            const size = new Vector3();
            box.getSize(size);

            tetrisMaterial.uniforms.u_resolution.value = new Vector2(window.innerWidth, window.innerHeight);
        }
    });
    loadGroup.add(gltf.scene);
});

gltfLoader.load("/models/cartridge.glb", (gltf) => {
    loadGroup.add(gltf.scene);
});


// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

// Main loop
function render() {
    requestAnimationFrame(render);
    
    statsPanel.statsObject.begin();
    controls.update();
    const tick = performance.now() / 1000;

    
    // Update material time uniforms
    tetrisMaterial.uniforms.u_time.value = tick;
    gameOverMaterial.uniforms.u_time.value = tick;

    // If game is over, just update animations and render
    if (getGameState().isGameOver) {
        endOfGame(tick);
        scrollGroup.rotation.y = window.scrollY * 0.001;
        composer.render();
        statsPanel.statsObject.end();
        return;
    }

    gameloop(tick);


    scrollGroup.rotation.y = window.scrollY * 0.001;
    composer.render();
}

render();
