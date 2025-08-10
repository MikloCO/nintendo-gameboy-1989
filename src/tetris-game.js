import './style.css';
import { animate, mix } from 'motion';
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
    AnimationMixer,
    Raycaster,
    Object3D,
    TorusGeometry,
    MeshBasicMaterial,
    CircleGeometry,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { gameOverMaterial, tetrisMaterial } from './shader_modules/shader-materials.js';
import { ControlPanel, StatsPanel } from './statistics.js';
import { getGameState, GG as endOfGame, gameloop } from './Tetris-logic.js';
import './controller.js';

const canvasTag = document.querySelector("section.gameboymodel");

// THREE.js setup
export const scene = new Scene();
export const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.set(0, 0, 2);

export const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
canvasTag.appendChild(renderer.domElement);

// UI panels
const params = { minScale: 10, maxScale: 20, rotate: true };
const controlsContainer = document.getElementById('controls-container');
new ControlPanel(params, controlsContainer);
const statsPanel = new StatsPanel(controlsContainer);

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

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = true;
controls.enableZoom = true;

// Font textures for shaders
const fontTexture = new CanvasTexture(canvasTag);
fontTexture.minFilter = LinearFilter;
fontTexture.magFilter = LinearFilter;
const textureLoader = new TextureLoader();
gameOverMaterial.uniforms.u_fontAtlas = { value: textureLoader.load('./texture_atlases/game_over.png') };
gameOverMaterial.uniforms.u_pleaseAtlas = { value: textureLoader.load('./texture_atlases/atlas_PLEASE.png') };
gameOverMaterial.uniforms.u_tryAtlas = { value: textureLoader.load('./texture_atlases/atlas_TRY.png') };
gameOverMaterial.uniforms.u_againAtlas = { value: textureLoader.load('./texture_atlases/atlas_AGAIN.png') };

// Groups
export const loadGroup = new Group();
export const scrollGroup = new Group();
scrollGroup.add(loadGroup);
scene.add(scrollGroup);

// DRACO + GLTF loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// Animation setup
let mixer, animations = {}, currentAnimation;
gltfLoader.load("/models/gameboy_anims.glb", (gltf) => {
    loadGroup.add(gltf.scene);

    // disable raycast on all default meshes
    gltf.scene.traverse(c => {
        if (c.isMesh) c.raycast = () => null;
    });

    mixer = new AnimationMixer(gltf.scene);
    gltf.animations.forEach(clip => {
        animations[clip.name] = mixer.clipAction(clip);
    });
    console.log("Available animations:", Object.keys(animations));
});
gltfLoader.load("/models/screen.glb", (gltf) => {
    gltf.scene.isScreen = true;
    gltf.scene.traverse(c => {
        if (c.isMesh) {
            c.material = tetrisMaterial;
            tetrisMaterial.uniforms.u_resolution.value = new Vector2(window.innerWidth, window.innerHeight);
        }
    });
    loadGroup.add(gltf.scene);
});
gltfLoader.load("/models/cartridge.glb", (gltf) => {
    loadGroup.add(gltf.scene);
});

// Helper to play named animations
export function playButtonAnimation(buttonName, onComplete = null) {
    const action = animations[buttonName];
    if (!action) {
        console.warn(`Animation "${buttonName}" not found`);
        return;
    }
    if (currentAnimation) currentAnimation.stop();
    currentAnimation = action;
    action.reset().setLoop(false, 1).clampWhenFinished = true;
    action.play();
    if (onComplete) setTimeout(onComplete, action.getClip().duration * 1000);
}

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

// ─── Markers ─────────────────────────────────────────────────────────────────
const markerData = [
    { position: [0.28, -0.17, 0.155], mesh: 'A', animation: 'AAction.001' },
    { position: [0.15, -0.24, 0.155], mesh: 'B', animation: 'BAction' },
    { position: [-0.15, -0.20, 0.16], mesh: 'arrow_right', animation: 'arrow_right' },
    { position: [-0.35, -0.20, 0.16], mesh: 'arrow_left', animation: 'arrow_left' },
    { position: [-0.25, -0.30, 0.16], mesh: 'down_arrow', animation: 'down_arrow' },
    { position: [-0.25, -0.10, 0.16], mesh: 'up_arrow', animation: 'arrowsAction' },
];

markerData.forEach((marker, idx) => {
    const markerContainer = new Object3D();

    const torus = new Mesh(
        new TorusGeometry(0.06, 0.01, 2, 100),
        new MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 })
    );
    const circle = new Mesh(
        new CircleGeometry(0.05, 32),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
    );

    markerContainer.add(torus, circle);
    markerContainer.position.set(...marker.position);

    // **Tag the container** so raycast can find it
    markerContainer.userData.markerName = idx;

    loadGroup.add(markerContainer);
});

// ─── Interaction ─────────────────────────────────────────────────────────────
const raycaster = new Raycaster();
const pointer = new Vector2();

// **Attach click listener to the canvas** itself:
renderer.domElement.addEventListener('click', onCanvasClick);

function onCanvasClick(event) {
    // 1) Figure out mouse in NDC space **relative to the canvas**:
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 2) Raycast into loadGroup
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(loadGroup, true);
    console.log('Intersects', intersects);

    if (!intersects.length) return;

    // 3) Find the first hit under a tagged container
    const hit = intersects.find(({ object }) => {
        let o = object;
        while (o) {
            if (o.userData.markerName != null) return true;
            o = o.parent;
        }
        return false;
    });
    if (!hit) return;

    // 4) Climb up to that container
    let o = hit.object;
    while (o && o.userData.markerName == null) {
        o = o.parent;
    }
    const idx = o.userData.markerName;

    console.clear();
    console.log('Clicked marker data:', markerData[idx]);
    if (markerData[idx].mesh) {
        playButtonAnimation(markerData[idx].animation);
    }


}

// ─── Render Loop ──────────────────────────────────────────────────────────────
function render() {
    requestAnimationFrame(render);
    statsPanel.statsObject.begin();
    controls.update();

    const t = performance.now() / 1000;
    tetrisMaterial.uniforms.u_time.value = t;
    gameOverMaterial.uniforms.u_time.value = t;

    if (mixer) mixer.update(0.016);

    if (getGameState().isGameOver) {
        endOfGame(t);
        scrollGroup.rotation.y = window.scrollY * 0.001;
        composer.render();
        statsPanel.statsObject.end();
        return;
    }

    gameloop(t);
    scrollGroup.rotation.y = window.scrollY * 0.001;
    composer.render();
    statsPanel.statsObject.end();
}

render();
