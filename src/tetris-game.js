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
    DataTexture,
    RGBAFormat,
    UnsignedByteType
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; 
import { TetrisShader } from '../tetris-shader';
import {
    ITermino,
    OTermino,
    TTermino,
    LTermino,
    JTermino,
    STermino,
    ZTermino
} from './ITerminos.js';

const allShapes = [ITermino, OTermino, TTermino, LTermino, JTermino, STermino, ZTermino];



const sneakerTag = document.querySelector("section.sneaker");

const scene = new Scene();
const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 2);

const renderer = new WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
sneakerTag.appendChild(renderer.domElement);

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

const gridWidth = 14;
const gridHeight = 14;
const gridData = new Uint8Array(gridWidth * gridHeight * 4);
const gameGrid = Array.from({ length: gridHeight }, () =>
    new Array(gridWidth).fill(null)
);
const gridTexture = new DataTexture(gridData, gridWidth, gridHeight, RGBAFormat, UnsignedByteType);
gridTexture.needsUpdate = true;

function getShapeBottomOffset(shape, rotation) {
    // Create a 4x4 grid copy
    const grid = [];
    for (let y = 0; y < 4; y++) {
        grid[y] = [];
        for (let x = 0; x < 4; x++) {
            grid[y][x] = shape[y * 4 + x];
        }
    }

    // Apply rotation to grid
    const rotated = Array.from({ length: 4 }, () => Array(4).fill(0));
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            let rx = x, ry = y;
            if (rotation === 1) { rx = 3 - y; ry = x; }
            else if (rotation === 2) { rx = 3 - x; ry = 3 - y; }
            else if (rotation === 3) { rx = y; ry = 3 - x; }
            rotated[ry][rx] = grid[y][x];
        }
    }

    // Find bottom-most non-empty row
    let maxY = 3;
    for (let y = 3; y >= 0; y--) {
        let hasBlock = false;
        for (let x = 0; x < 4; x++) {
            if (rotated[y][x]) {
                hasBlock = true;
                break;
            }
        }
        if (hasBlock) {
            maxY = y;
            break;
        }
    }

    return maxY; // highest Y that has content
}

function updateGridTexture() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const index = (y * gridWidth + x) * 4;
            const cell = gameGrid[y][x];
            if (cell) {
                // Store block info in texture with simpler encoding
                gridData[index] = Math.min(255, cell.type * 36);        // R: type (1-7) × 36
                gridData[index + 1] = Math.min(255, (cell.shapeId + 1) * 36); // G: shapeId (1-7) × 36
                gridData[index + 2] = 255;                              // B: full value for active blocks
                gridData[index + 3] = 255;                             // A: full opacity
                
                if (cell.type > 0) {
                    console.log(`Grid texture at (${x},${y}):`, {
                        r: gridData[index],
                        g: gridData[index + 1],
                        b: gridData[index + 2]
                    });
                }
            } else {
                gridData[index] = 0;
                gridData[index + 1] = 0;
                gridData[index + 2] = 0;
                gridData[index + 3] = 255;
            }
        }
    }
    gridTexture.needsUpdate = true;
}

// Shader Material
const tetrisMaterial = new ShaderMaterial({
    uniforms: {
        u_time: { value: 0.0 },
        u_timeStart: { value: performance.now() / 1000 },
        u_offsetX: { value: 0 },
        u_shapeId: { value: 0 },
        u_rotation: { value: 0 }, // rotation stored as int (0, 90, 180, 270)
        u_resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
        opacity: { value: 1.0 },
        u_gridTexture: { value: gridTexture }
    },
    vertexShader: TetrisShader.vertexShader,
    fragmentShader: TetrisShader.fragmentShader,
    transparent: false
});
tetrisMaterial.uniforms.u_rotation = { value: 0 };

// Key movement
window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowRight") {
        tetrisMaterial.uniforms.u_offsetX.value += 1;
    }
    if (e.code === "ArrowLeft") {
        tetrisMaterial.uniforms.u_offsetX.value -= 1;
    }
    
    if (e.code === "ArrowUp") {
        tetrisMaterial.uniforms.u_rotation.value = (tetrisMaterial.uniforms.u_rotation.value + 90) % 360;
    }
    if (e.code === "ArrowDown") {
        tetrisMaterial.uniforms.u_rotation.value = (tetrisMaterial.uniforms.u_rotation.value + 270) % 360;
    }
    tetrisMaterial.uniforms.u_offsetX.value = Math.max(0, Math.min(10, tetrisMaterial.uniforms.u_offsetX.value));
});


// Groups
const loadGroup = new Group();
const scrollGroup = new Group();
scrollGroup.add(loadGroup);
scene.add(scrollGroup);

// Load Models
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load("/models/gameboy.glb", (gltf) => {
    loadGroup.add(gltf.scene);
});

gltfLoader.load("/models/screen.glb", (gltf) => {
    gltf.scene.traverse(child => {
        if (child.isMesh) {
            child.material = tetrisMaterial;

            const box = new Box3().setFromObject(child);
            const size = new Vector3();
            box.getSize(size);
            console.log("Mesh size:", size);

            tetrisMaterial.uniforms.u_resolution.value = new Vector2(window.innerWidth, window.innerHeight);
        }
    });
    loadGroup.add(gltf.scene);
});

gltfLoader.load("/models/cartridge.glb", (gltf) => {
    loadGroup.add(gltf.scene);
});

function lockShapeIntoGrid() {
    const shapeId = tetrisMaterial.uniforms.u_shapeId.value;
    const offsetX = tetrisMaterial.uniforms.u_offsetX.value;
    const fallStep = Math.floor((performance.now() / 1000 - tetrisMaterial.uniforms.u_timeStart.value) * 1.0);
    const rotation = Math.floor(tetrisMaterial.uniforms.u_rotation.value / 90) % 4;

    const shapeData = allShapes[shapeId];

    // Standard Tetris rotation matrix
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = shapeData[y * 4 + x];
            if (cell === 9) {
                let rx = x, ry = y;
                
                // Counter-clockwise rotation in JS (opposite to GLSL)
                if (rotation === 1) {        // 90° counter-clockwise
                    if (shapeId === 3) { // L piece
                        rx = 3 - y;
                        ry = x;
                        console.log(`L piece rotation ${rotation}: (${x},${y}) -> (${rx},${ry})`);
                    } else {
                        rx = 3 - y;
                        ry = x;
                    }
                } else if (rotation === 2) { // 180°
                    rx = 3 - x;
                    ry = 3 - y;
                } else if (rotation === 3) { // 270° counter-clockwise
                    rx = y;
                    ry = 3 - x;
                }
                
                // Keep track of the last position before landing
                if (y === 3) {
                    console.log(`Last row rotation state: shape=${shapeId}, rotation=${rotation}, pos=(${x},${y}) -> (${rx},${ry})`);
                }

                // Debug output to check rotation
                if (shapeId === 0) { // If it's the L piece
                    console.log(`Rotating L piece: rotation=${rotation}, from (${x},${y}) to (${rx},${ry})`);
                }

                const gx = offsetX + rx;
                const gy = fallStep + ry;

                if (gx >= 0 && gx < gridWidth && gy >= 0 && gy < gridHeight) {
                    const cell = {
                        type: shapeId + 1,
                        rotation: rotation,
                        shapeId: shapeId
                    };
                    gameGrid[gy][gx] = cell;
                    console.log(`Landed block at (${gx},${gy}):`, cell);
                }
            }
        }
    }

    updateGridTexture(); // Apply updates to GPU
}
function spawnNewShape() {
    lockShapeIntoGrid();
    tetrisMaterial.uniforms.u_timeStart.value = performance.now() / 1000;
    tetrisMaterial.uniforms.u_offsetX.value = 0;
    tetrisMaterial.uniforms.u_rotation.value = 0; // Reset rotation for new shape
    const nextShape = Math.floor(Math.random() * 2);
    tetrisMaterial.uniforms.u_shapeId.value = nextShape;
    console.log("🚀 New shape spawned:", nextShape === 0 ? "L" : "Cube");
}

// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tetrisMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
});

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

// Main loop
function render() {
    requestAnimationFrame(render);
    controls.update();
    const now = performance.now() / 1000;
    tetrisMaterial.uniforms.u_time.value = now;

    const fallSpeed = 1.0;
    const blockHeight = 4;
    const maxFall = gridHeight - blockHeight;
    const fallDuration = now - tetrisMaterial.uniforms.u_timeStart.value;
    const fallStep = Math.floor(fallDuration * fallSpeed);

    if (fallStep >= maxFall) {
        spawnNewShape();
    }

    scrollGroup.rotation.y = window.scrollY * 0.001;
    composer.render();
}
render();
