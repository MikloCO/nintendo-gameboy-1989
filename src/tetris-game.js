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
    Shape,
    ShapeGeometry,
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
    DoubleSide,
    Sprite,
    SpriteMaterial,
    ExtrudeGeometry
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { gameOverMaterial, tetrisMaterial } from './shader_modules/shader-materials.js';
import { ControlPanel, StatsPanel, autoRotate } from './statistics.js';
import { getGameState, GG as endOfGame, gameloop, isValidMove, isValidRotation, checkPieceAtEdge } from './Tetris-logic.js';
import './controller.js';
import { act } from 'react';

const GAME_STATES = {
    START_SCREEN: 'start_screen',
    PLAYING: 'playing',
    GAME_OVER: 'game_over'
};

let currentGameState = GAME_STATES.START_SCREEN;

let arrowContainer = null;
let arrowBaseY = null;

const canvasTag = document.querySelector("section.gameboymodel");

// THREE.js setup
export const scene = new Scene();
export const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 0, 2);

export const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
canvasTag.appendChild(renderer.domElement);

// UI panels
export const params = { minScale: 10, maxScale: 20, rotate: true, emission: 10000.0 };
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
let textSprite = null;

// Animation setup
let mixer, animations = {}, currentAnimation;
gltfLoader.load("/models/gameboy.glb", (gltf) => {
    loadGroup.add(gltf.scene);

    // Compute bounding box of the Gameboy
    const box = new Box3().setFromObject(gltf.scene);
    const center = new Vector3();
    box.getCenter(center);

    const triangleY = box.max.y + 0.1;

    // Create your triangle mesh
    const shape = new Shape();
    shape.moveTo(0, -1);    // bottom vertex (tip)
    shape.lineTo(-1, 1);    // top left (base)
    shape.lineTo(1, 1);     // top right (base)
    shape.lineTo(0, -1);

    // Extrude settings
    const extrudeSettings = {
        depth: 0.25, // Thickness of the triangle
        bevelEnabled: false // Disable bevel for sharp edges
    };

    // Create the extruded geometry
    const triangleGeometry = new ExtrudeGeometry(shape, extrudeSettings);

    const triangleMaterial = new MeshBasicMaterial({ color: 0xffff00, transparent: false, opacity: 1., side: DoubleSide });
    const triangleMesh = new Mesh(triangleGeometry, triangleMaterial);
    triangleMesh.scale.set(0.05, 0.05, 0.05);
    // Create a container for the triangle
    arrowContainer = new Object3D(); // Remove 'const' to make it global
    arrowContainer.add(triangleMesh);

    // Position the arrow above the Gameboy
    arrowContainer.position.set(center.x - .31, triangleY, center.z);
    arrowBaseY = arrowContainer.position.y; // Add this line to store original Y

    // Add to the scene/group
    loadGroup.add(arrowContainer);

    // --- Add text sprite above the triangle ---
    textSprite = createTextSprite('Toggle to play!');
    textSprite.position.set(center.x - .3, triangleY + 0.002, center.z); // adjust Y offset as needed
    loadGroup.add(textSprite);

    // Only disable raycast for objects we DON'T want to interact with
    gltf.scene.traverse(c => {


        // Keep raycasting enabled for buttons and controls
        const keepRaycast = c.userData.isInteractive
            || c.userData.markerName != null
            || ['A', 'B', 'contrast', 'vol', 'off_on', 'out_cartridge', 'arrow_left']
                .includes(c.name);        
        
        if (c.isMesh && !keepRaycast) {
            c.raycast = () => null;
            if (c.isMesh && c.material) {
                // Only set emission for supported material types
                if (
                    c.material.type === 'MeshStandardMaterial' ||
                    c.material.type === 'MeshPhysicalMaterial'
                ) {
                    c.material.emissive.set(0xF76F65);
                    c.material.emissiveIntensity = 0; 
                }
            }
        } else if (keepRaycast) {
            // Add userData to identify interactive parts
            c.userData.isInteractive = true;
            c.userData.controlType = c.name;
            console.log(`Made ${c.name} interactive for raycasting`);
        }
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
            c.material = turned_off_material;
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
    console.log(action);
    if (!action) {
        console.warn(`Animation "${buttonName}" not found`);
        return;
    }
    if (currentAnimation) currentAnimation.stop();
    currentAnimation = action;
    action.reset().setLoop(false, 1).clampWhenFinished = true;
    action.play();
    console.log("PLayed")
    if (onComplete) setTimeout(onComplete, action.getClip().duration * 1000);
}

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());




// ─── Markers ─────────────────────────────────────────────────────────────────
const markerData = [
    { position: [-0.15, -0.20, 0.16], mesh: 'arrow_right', animation: 'arrow_right' },
    { position: [-0.35, -0.20, 0.16], mesh: 'arrow_left', animation: 'arrow_left' },
    { position: [-0.25, -0.30, 0.16], mesh: 'down_arrow', animation: 'down_arrow' },
    { position: [-0.25, -0.10, 0.16], mesh: 'up_arrow', animation: 'arrowsAction' },
];

markerData.forEach((marker, idx) => {
    const markerContainer = new Object3D();

    const torus = new Mesh(
        new TorusGeometry(0.06, 0.01, 2, 100),
        new MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.0 })
    );
    const circle = new Mesh(
        new CircleGeometry(0.05, 32),
        new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0. })
    );

    [torus, circle].forEach(mesh => {
        mesh.userData.isInteractive = true;
        mesh.userData.controlType = marker.mesh; 
    });


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

let gameboy_turned_off = false;

const turned_off_material = new MeshBasicMaterial({
    color: 0x879372, // Classic Gameboy green color
    transparent: false
});

let dummyswitch = false;
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

    // First, check if we hit an interactive control directly
    const interactiveHit = intersects.find(hit => hit.object.userData.isInteractive);
    if (interactiveHit) {
        const controlType = interactiveHit.object.userData.controlType;
        console.log(`Clicked on ${controlType} control`);
        const currentShapeId = tetrisMaterial.uniforms.u_shapeId.value;
        const currentOffsetX = tetrisMaterial.uniforms.u_offsetX.value;
        const currentRotation = tetrisMaterial.uniforms.u_rotation.value;
        
        // Play corresponding animation
        switch (controlType) {
            case 'A':
                playButtonAnimation('AAction.001');
                break;
            case 'B':
                playButtonAnimation('BAction');
                break;
            case 'contrast':
                playButtonAnimation('contrastAction'); // or whatever the animation is called
                break;
            case 'vol':
                playButtonAnimation('vol_up');
                break;
            case 'up_arrow':
                // Rotate piece clockwise (same as UP arrow key)
                playButtonAnimation('arrowsAction');
                const newRotation = (currentRotation + 90) % 360;
                if (isValidRotation(currentShapeId, currentOffsetX, newRotation)) {
                    console.log("Rotation is safe - applying it");
                    tetrisMaterial.uniforms.u_rotation.value = newRotation;
                    checkPieceAtEdge();
                } else {
                    console.log("Rotation blocked - would cause collision");
                }
                break;

            case 'down_arrow':
                playButtonAnimation('down_arrow');

                // Rotate piece counter-clockwise (or fast drop if you prefer)
                const ccwRotation = (currentRotation + 270) % 360;
                if (isValidRotation(currentShapeId, newOffsetX, ccwRotation)) {
                    console.log("Counter-clockwise rotation is safe - applying it");
                    tetrisMaterial.uniforms.u_rotation.value = ccwRotation;
                    checkPieceAtEdge();
                }
                break;

            case 'arrow_left':
                playButtonAnimation('arrow_left');

                // Move piece left (same as LEFT arrow key)
                const newOffsetXLeft = currentOffsetX - 1;
                if (isValidMove(currentShapeId, newOffsetXLeft, currentRotation)) {
                    console.log("Moving left");
                    tetrisMaterial.uniforms.u_offsetX.value = newOffsetXLeft;
                    checkPieceAtEdge();
                } else {
                    console.log("Can't move left - blocked");
                }
                break;

            case 'arrow_right':
                playButtonAnimation('arrow_right');

                // Move piece right (same as RIGHT arrow key)
                const newOffsetXRight = currentOffsetX + 1;
                if (isValidMove(currentShapeId, newOffsetXRight, currentRotation)) {
                    console.log("Moving right");
                    tetrisMaterial.uniforms.u_offsetX.value = newOffsetXRight;
                    checkPieceAtEdge();
                } else {
                    console.log("Can't move right - blocked");
                }
                break;
            // Add other controls as needed
            case 'off_on':
                if (gameboy_turned_off) {
                    playButtonAnimation('on_off');

                }
                else {
                    playButtonAnimation('off_on');
                    dummyswitch = true;
                    scene.traverse(child => {

                        console.log(child.children)
                        // Check if this is the screen or a mesh within the screen
                        if ((child.isScreen || (child.parent && child.parent.isScreen)) && child.isMesh) {
                            // Store the original texture if available
                            if (child.material && child.material.map) {
                                tetrisMaterial.uniforms.u_texture.value = child.material.map;
                            }
                            // Apply the game over shader material
                            child.material = tetrisMaterial;
                        }
                            // Keep raycasting enabled for buttons and controls
                        const keepRaycast = child.userData.isInteractive
                            || child.userData.markerName != null
                            || ['A', 'B', 'contrast', 'vol', 'off_on', 'out_cartridge'].includes(child.name);                            console.log(child.name, keepRaycast);
                            if (child.isMesh && !keepRaycast) {
                                child.raycast = () => null;
                                if (child.isMesh && child.material) {
                                    // Only set emission for supported material types
                                    if (
                                        child.material.type === 'MeshStandardMaterial' ||
                                        child.material.type === 'MeshPhysicalMaterial'
                                    ) {
                                        child.material.emissive.set(0xF76F65);
                                        child.material.emissiveIntensity = 40; // Try a very high value
                                    }
                                }
                            } 
                    });
                    // REMOVE THE TRIANGLE AND TEXT
                    if (arrowContainer && arrowContainer.parent) {
                        arrowContainer.parent.remove(arrowContainer);
                    }
                    if (textSprite && textSprite.parent) {
                        textSprite.parent.remove(textSprite);
                    }
                }
                gameboy_turned_off = !gameboy_turned_off;
                break;
        }

        return;
    }
    
    // If no interactive control was hit, continue with your existing marker check...
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
    
}



// ─── Render Loop ──────────────────────────────────────────────────────────────
function render() {
    requestAnimationFrame(render);
    statsPanel.statsObject.begin();
    controls.update();

    const t = performance.now() / 1000;
    if (mixer) mixer.update(0.016);

    // Call autoRotate function
    autoRotate.autoRotate();

    // Add this animation for the triangle
    if (arrowContainer && arrowBaseY !== null) {
        arrowContainer.position.y = arrowBaseY + Math.sin(t * Math.PI * 2 / 0.9) * 0.01;
        arrowContainer.rotation.y = Math.sin(t * Math.PI * 2 / 1.5) * Math.PI * 0.25; // 180° rotation
    }

    if (dummyswitch === true) {
        tetrisMaterial.uniforms.u_time.value = t;
        gameOverMaterial.uniforms.u_time.value = t;

        if (getGameState().isGameOver) {
            endOfGame(t);
            scrollGroup.rotation.y = window.scrollY * 0.001;
            composer.render();
            statsPanel.statsObject.end();
            return;
        }

        gameloop(t);
        statsPanel.statsObject.end();
    }
    scrollGroup.rotation.y = window.scrollY * 0.001;

    composer.render();
}

render();

function createTextSprite(message) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = '32px Arial';
    context.fillStyle = '#ffff00';
    context.fillText(message, 20, 24);

    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({ map: texture, transparent: true });
    const sprite = new Sprite(material);
    sprite.scale.set(0.3, 0.3, 1); // Adjust size as needed
    return sprite;
}

