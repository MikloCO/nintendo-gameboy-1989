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
                
                // Update grid texture for active cells
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

// Check if a rotation would cause wall collision
function isValidRotation(shapeId, offsetX, newRotation) {
    const shape = allShapes[shapeId];
    const rotation = Math.floor(newRotation / 90) % 4;
    
    // Define where the walls are - accounting for the 1 unit width of each wall
    const wallWidth = 1;
    const playableLeftEdge = wallWidth; // First playable column (after left wall)
    const playableRightEdge = gridWidth - wallWidth; // Last playable column (before right wall)
    
    // Track if any cell would be at the edge after rotation
    let wouldBeAtLeftEdge = false;
    let wouldBeAtRightEdge = false;
    
    // Track if there's any wall intersection
    let hasIntersection = false;
    let intersectionType = "";
    
    // Create a 2D grid to visualize the shape and walls
    const visualGrid = [];
    for (let y = 0; y < 4; y++) {
        visualGrid[y] = [];
        for (let x = 0; x < gridWidth + 2; x++) {
            // Set wall positions
            if (x === 0 || x === gridWidth + 1) {
                visualGrid[y][x] = '|'; // Wall character
            } else {
                visualGrid[y][x] = ' '; // Empty space
            }
        }
    }
    
    // We need to check each position in the 4x4 grid where shape cells will be after rotation
    for (let fy = 0; fy < 4; fy++) {
        for (let fx = 0; fx < 4; fx++) {
            // These coordinates match what the shader does with grid position
            
            // Apply inverse rotation to find which cell from the original shape would end up here
            let rx = fx, ry = fy;
            
            // EXACT MATCH to shader rotation in tetris-fragment.glsl
            if (rotation === 1) { // 90° clockwise in shader
                rx = fy; 
                ry = 3 - fx;
            } else if (rotation === 2) { // 180°
                rx = 3 - fx;
                ry = 3 - fy;
            } else if (rotation === 3) { // 270° clockwise in shader
                rx = 3 - fy;
                ry = fx;
            }
            
            // Check if there's a cell in the shape at this inverse-rotated position
            const originalCellValue = (rx >= 0 && rx < 4 && ry >= 0 && ry < 4) 
                ? shape[ry * 4 + rx] 
                : 0;
                
            // Check for both 9 and 1 as filled cell values
            if (originalCellValue === 0) continue; // No cell here after rotation
            
            // This position will have a cell after rotation, check if it would be outside grid
            const gx = offsetX + fx;
            
            // Update the visual grid with the cell position
            if (gx >= 0 && gx < gridWidth && fy < 4) {
                visualGrid[fy][gx + 1] = 'X'; // +1 to account for the left wall
            }
            
            // Wall collision check with detailed information
            if (gx < playableLeftEdge) {
                console.log(`INTERSECTED LEFT WALL: Cell would be at grid x=${gx}`);
                hasIntersection = true;
                intersectionType = "LEFT WALL";
            } else if (gx >= playableRightEdge) {
                console.log(`INTERSECTED RIGHT WALL: Cell would be at grid x=${gx}`);
                hasIntersection = true;
                intersectionType = "RIGHT WALL";
            } else if (gx === playableLeftEdge) {
                // Block would be right next to the left wall edge after rotation
                console.log(`EDGE DETECTION: Block would be at LEFT EDGE after rotation - grid x=${gx}`);
                wouldBeAtLeftEdge = true;
            } else if (gx === playableRightEdge - 1) {
                // Block would be right next to the right wall edge after rotation
                console.log(`EDGE DETECTION: Block would be at RIGHT EDGE after rotation - grid x=${gx}`);
                wouldBeAtRightEdge = true;
            }
        }
    }
    
    // Print visual representation of the shape and walls if there's an intersection
    if (hasIntersection) {
        console.log(`ROTATION BLOCKED: Intersection with ${intersectionType} detected`);
        console.log("Visual grid representation:");
        visualGrid.forEach(row => console.log(row.join('')));
        return false;
    }
    
    // Check if the piece would be at an edge after rotation
    if (wouldBeAtLeftEdge) {
        console.log("ROTATION BLOCKED: Would place piece at LEFT EDGE");
        return false;
    }
    
    if (wouldBeAtRightEdge) {
        console.log("ROTATION BLOCKED: Would place piece at RIGHT EDGE");
        return false;
    }
    
    // No collisions or edge placements detected
    return true;
}

// Function to check if a piece is at the edge of the grid
function checkPieceAtEdge() {
    const shapeId = tetrisMaterial.uniforms.u_shapeId.value;
    const offsetX = tetrisMaterial.uniforms.u_offsetX.value;
    const rotation = Math.floor(tetrisMaterial.uniforms.u_rotation.value / 90) % 4;
    const shape = allShapes[shapeId];
    
    // Define wall width constant
    const wallWidth = 1;
    const playableLeftEdge = wallWidth;
    const playableRightEdge = gridWidth - wallWidth;
    
    console.log(`EDGE CHECK: Shape ${shapeId}, rotation ${rotation}°, offset ${offsetX}`);
    
    // Track if any cell is at the edge
    let atLeftEdge = false;
    let atRightEdge = false;
    
    // Check each position in the 4x4 grid
    for (let fy = 0; fy < 4; fy++) {
        for (let fx = 0; fx < 4; fx++) {
            // Apply inverse rotation to find which cell from the original shape would end up here
            let rx = fx, ry = fy;
            
            // EXACT MATCH to shader rotation in tetris-fragment.glsl
            if (rotation === 1) { // 90° clockwise
                rx = fy; 
                ry = 3 - fx;
            } else if (rotation === 2) { // 180°
                rx = 3 - fx;
                ry = 3 - fy;
            } else if (rotation === 3) { // 270° clockwise
                rx = 3 - fy;
                ry = fx;
            }
            
            // Check if there's a cell in the shape at this inverse-rotated position
            const originalCellValue = (rx >= 0 && rx < 4 && ry >= 0 && ry < 4) 
                ? shape[ry * 4 + rx] 
                : 0;
            
            if (shapeId === 1) { // Specifically debugging the cube (OTermino)
                console.log(`Cube check: position (${fx},${fy}) maps to original (${rx},${ry}) with value ${originalCellValue}`);
            }
                
            if (originalCellValue === 0) continue; // No cell here for any shape
            // Both values 1 and 9 are used to indicate filled cells in different shapes
            
            // Calculate grid position
            const gx = offsetX + fx;
            
            // Check if at edge
            if (gx === playableLeftEdge) {
                atLeftEdge = true;
                console.log(`EDGE ALERT: Shape ${shapeId}, rot ${rotation}° - Block at LEFT EDGE (${fx},${fy}) -> grid x=${gx}`);
            } else if (gx === playableRightEdge - 1) {
                atRightEdge = true;
                console.log(`EDGE ALERT: Shape ${shapeId}, rot ${rotation}° - Block at RIGHT EDGE (${fx},${fy}) -> grid x=${gx}`);
            }
        }
    }
    
    // Print summary with shape and rotation info
    if (atLeftEdge) {
        console.log(`!!! PIECE IS AT LEFT EDGE OF GRID !!! Shape ${shapeId}, Rotation ${rotation}°`);
    }
    if (atRightEdge) {
        console.log(`!!! PIECE IS AT RIGHT EDGE OF GRID !!! Shape ${shapeId}, Rotation ${rotation}°`);
    }
    
    return { atLeftEdge, atRightEdge };
}

// Check if moving in a direction would cause a collision
function isValidMove(shapeId, offsetX, rotation) {
    const shape = allShapes[shapeId];
    rotation = Math.floor(rotation / 90) % 4;
    
    // Define the playable grid area considering 1-unit walls on each side
    const wallWidth = 1; // Each wall is 1 unit wide
    const playableLeftEdge = wallWidth; // First playable column after left wall
    const playableRightEdge = gridWidth - wallWidth; // Last playable column before right wall
    
    // Check each position in the 4x4 grid
    for (let fy = 0; fy < 4; fy++) {
        for (let fx = 0; fx < 4; fx++) {
            // Apply inverse rotation to find which cell from the original shape would end up here
            let rx = fx, ry = fy;
            
            // EXACT MATCH to shader rotation in tetris-fragment.glsl
            if (rotation === 1) { // 90° clockwise
                rx = fy; 
                ry = 3 - fx;
            } else if (rotation === 2) { // 180°
                rx = 3 - fx;
                ry = 3 - fy;
            } else if (rotation === 3) { // 270° clockwise
                rx = 3 - fy;
                ry = fx;
            }
            
            // Check if there's a cell in the shape at this inverse-rotated position
            const originalCellValue = (rx >= 0 && rx < 4 && ry >= 0 && ry < 4) 
                ? shape[ry * 4 + rx] 
                : 0;
                
            // Check for both 9 and 1 as filled cell values (some shapes use 1, others use 9)
            if (originalCellValue === 0) continue; // No cell here for this shape
            
            // Calculate grid position with the proposed offset
            const gx = offsetX + fx;
            
            // Check if this would collide with walls or be outside the playable area
            if (gx < playableLeftEdge || gx >= playableRightEdge) {
                console.log(`Move blocked: position (${fx},${fy}) would hit wall or be outside grid at x=${gx}`);
                return false;
            }
        }
    }
    
    return true; // Move is valid
}

// Key movement
window.addEventListener("keydown", (e) => {
    const currentShapeId = tetrisMaterial.uniforms.u_shapeId.value;
    const currentOffsetX = tetrisMaterial.uniforms.u_offsetX.value;
    const currentRotation = tetrisMaterial.uniforms.u_rotation.value;
    
    // Define wall width constant to be consistent
    const wallWidth = 1;
    
    if (e.code === "ArrowRight") {
        const newOffsetX = currentOffsetX + 1;
        // Check if moving right is valid using the new collision detection
        if (isValidMove(currentShapeId, newOffsetX, currentRotation)) {
            tetrisMaterial.uniforms.u_offsetX.value = newOffsetX;
            // Check if piece is now at edge
            checkPieceAtEdge();
        }
    }
    if (e.code === "ArrowLeft") {
        const newOffsetX = currentOffsetX - 1;
        // Check if moving left is valid using the new collision detection
        if (isValidMove(currentShapeId, newOffsetX, currentRotation)) {
            tetrisMaterial.uniforms.u_offsetX.value = newOffsetX;
            // Check if piece is now at edge
            checkPieceAtEdge();
        }
    }
    
    if (e.code === "ArrowUp") {
        const newRotation = (tetrisMaterial.uniforms.u_rotation.value + 90) % 360;
        
        console.log("Simulating clockwise rotation to check if valid...");
        
        // First simulate the rotation to see if it would be valid
        // This is our "fake" rotation test
        if (isValidRotation(currentShapeId, currentOffsetX, newRotation)) {
            console.log("Rotation is safe - applying it");
            tetrisMaterial.uniforms.u_rotation.value = newRotation;
            // Check edge status after rotation just for logging
            checkPieceAtEdge();
        } else {
            console.log("Rotation blocked - would cause wall collision or edge placement");
            // Rotation was not applied
        }
    }
    if (e.code === "ArrowDown") {
        const newRotation = (tetrisMaterial.uniforms.u_rotation.value + 270) % 360;
        
        console.log("Simulating counter-clockwise rotation to check if valid...");
        
        // First simulate the rotation to see if it would be valid
        // This is our "fake" rotation test
        if (isValidRotation(currentShapeId, currentOffsetX, newRotation)) {
            console.log("Rotation is safe - applying it");
            tetrisMaterial.uniforms.u_rotation.value = newRotation;
            // Check edge status after rotation just for logging
            checkPieceAtEdge();
        } else {
            console.log("Rotation blocked - would cause wall collision or edge placement");
            // Rotation was not applied
        }
    }
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
    
    // Define wall width constant to be consistent
    const wallWidth = 1;

    const shapeData = allShapes[shapeId];

    // Standard Tetris rotation matrix
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            const cell = shapeData[y * 4 + x];
            // Check for both 9 and 1 as filled cell values
            if (cell === 9 || cell === 1) {
                let rx = x, ry = y;
                
                // Counter-clockwise rotation in JS (opposite to GLSL)
                if (rotation === 1) {        // 90° counter-clockwise
                    if (shapeId === 3) { // L piece
                        rx = 3 - y;
                        ry = x;
                        // L piece specific rotation
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
                
                // Handle last row position
                // (no logging needed)

                // Debug output to check rotation
                if (shapeId === 0) { // If it's the L piece
                    // Rotation transformation applied
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
    
    // Use all available shapes (not just 0 and 1)
    const nextShape = Math.floor(Math.random() * allShapes.length);
    console.log(`Spawning new shape with ID ${nextShape}`);
    tetrisMaterial.uniforms.u_shapeId.value = nextShape;
    
    // Check if the new shape is at the edge (it shouldn't be, but just to be safe)
    checkPieceAtEdge();
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
    const fallDuration = now - tetrisMaterial.uniforms.u_timeStart.value;
    const fallStep = Math.floor(fallDuration * fallSpeed);
    
    // Get current shape and rotation
    const shapeId = tetrisMaterial.uniforms.u_shapeId.value;
    const rotation = Math.floor(tetrisMaterial.uniforms.u_rotation.value / 90) % 4;
    const shape = allShapes[shapeId];
    
    // Calculate the bottom offset for current shape+rotation
    const bottomOffset = getShapeBottomOffset(shape, rotation);
    
    // Adjust maxFall based on the shape's bottom offset
    const maxFall = gridHeight - (blockHeight - (3 - bottomOffset));
    
    if (fallStep >= maxFall) {
        spawnNewShape();
    }

    scrollGroup.rotation.y = window.scrollY * 0.001;
    composer.render();
}
render();
