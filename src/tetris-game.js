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
    UnsignedByteType,
    RawShaderMaterial,
    Vector4,
    LinearFilter,
    BufferGeometry,
    CanvasTexture,
    TextureLoader,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; 
import { TetrisShader } from './tetris-shader'; 
import { GameOverShader } from './gameover-shader.js';
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


const fontTexture = new CanvasTexture(sneakerTag);
fontTexture.minFilter = LinearFilter;
fontTexture.magFilter = LinearFilter;

const textureLoader = new TextureLoader();
// Debug texture loading
console.log("Loading texture atlases...");
const fontAtlas = textureLoader.load('./public/texture_atlases/game_over.png', 
    () => console.log("GAME OVER texture loaded successfully"), 
    undefined, 
    (err) => console.error("Error loading GAME OVER texture:", err)
);
const pleaseAtlas = textureLoader.load('./public/texture_atlases/atlas_PLEASE.png',
    () => console.log("PLEASE texture loaded successfully"),
    undefined,
    (err) => console.error("Error loading PLEASE texture:", err)
);
const tryAtlas = textureLoader.load('./public/texture_atlases/atlas_TRY.png',
    () => console.log("TRY texture loaded successfully"),
    undefined,
    (err) => console.error("Error loading TRY texture:", err)
);
const againAtlas = textureLoader.load('./public/texture_atlases/atlas_AGAIN.png',
    () => console.log("AGAIN texture loaded successfully"),
    undefined,
    (err) => console.error("Error loading AGAIN texture:", err)
);

const gameOverMaterial = new ShaderMaterial({
    uniforms: {
        u_resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
        u_time: { value: 0.0 },
        u_gridTexture: { value: gridTexture },
        u_texture: { value: null }, // Will be set when applied to screen
        u_fontAtlas: { value: null },
        u_pleaseAtlas: { value: null },
        u_tryAtlas: { value: null },
        u_againAtlas: { value: null },
    },
    vertexShader: GameOverShader.vertexShader,
    fragmentShader: GameOverShader.fragmentShader,
    transparent: true
});
gameOverMaterial.uniforms.u_fontAtlas = { value: fontAtlas };
gameOverMaterial.uniforms.u_pleaseAtlas = { value: pleaseAtlas };
gameOverMaterial.uniforms.u_tryAtlas = { value: tryAtlas };
gameOverMaterial.uniforms.u_againAtlas = { value: againAtlas };


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
            
            // Get the current fall step for collision checks
            const fallStep = Math.floor((performance.now() / 1000 - tetrisMaterial.uniforms.u_timeStart.value) * 1.0);
            const gy = fallStep + fy;
            
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
            
            // Check for collisions with existing blocks on the board
            if (gy >= 0 && gy < gridHeight && gx >= 0 && gx < gridWidth) {
                if (gameGrid[gy][gx] !== null) {
                    console.log(`ROTATION BLOCKED: Would collide with existing block at grid (${gx},${gy})`);
                    hasIntersection = true;
                    intersectionType = "EXISTING BLOCK";
                }
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
function isValidMove(shapeId, offsetX, rotation, fallOffset = null) {
    const shape = allShapes[shapeId];
    rotation = Math.floor(rotation / 90) % 4;
    
    // Define the playable grid area considering 1-unit walls on each side
    const wallWidth = 1; // Each wall is 1 unit wide
    const playableLeftEdge = wallWidth; // First playable column after left wall
    const playableRightEdge = gridWidth - wallWidth; // Last playable column before right wall
    
    // Get the current falling step if not provided
    const fallStep = fallOffset !== null ? fallOffset : 
        Math.floor((performance.now() / 1000 - tetrisMaterial.uniforms.u_timeStart.value) * 1.0);
    
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
            const gy = fallStep + fy;
            
            // Check if this would collide with walls or be outside the playable area
            if (gx < playableLeftEdge || gx >= playableRightEdge) {
                console.log(`Move blocked: position (${fx},${fy}) would hit wall or be outside grid at x=${gx}`);
                return false;
            }
            
            // Check if this would collide with an existing block on the board
            if (gy >= 0 && gy < gridHeight) {  // Only check if within vertical bounds
                if (gameGrid[gy][gx] !== null) {
                    console.log(`Move blocked: position (${fx},${fy}) would collide with existing block at grid (${gx},${gy})`);
                    return false;
                }
            }
        }
    }
    
    return true; // Move is valid
}

// Function to reset the game
function resetGame() {
    // Clear the grid
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            gameGrid[y][x] = null;
        }
    }
    updateGridTexture();
    
    // Reset game state
    isGameOver = false;
    
    // Remove the GAME OVER text if it exists
    if (gameOverText) {
        scene.remove(gameOverText);
        gameOverText = null;
    }
    
    // Remove the HTML overlay if it exists
    const gameOverDiv = document.getElementById('game-over-text');
    if (gameOverDiv) {
        document.body.removeChild(gameOverDiv);
    }
    
    // Reset tetris material time
    tetrisMaterial.uniforms.u_timeStart.value = performance.now() / 1000;
    tetrisMaterial.uniforms.u_offsetX.value = Math.floor(gridWidth / 2) - 2;
    tetrisMaterial.uniforms.u_rotation.value = 0;
    tetrisMaterial.uniforms.u_shapeId.value = Math.floor(Math.random() * allShapes.length);
    
    // Reload the screen with tetris material
    gltfLoader.load("/models/screen.glb", (gltf) => {
        gltf.scene.isScreen = true;
        gltf.scene.traverse(child => {
            if (child.isMesh) {
                child.material = tetrisMaterial;
            }
        });
        
        // Remove old screen
        loadGroup.children.forEach(child => {
            if (child.isScreen) {
                loadGroup.remove(child);
            }
        });
        
        // Add new screen
        loadGroup.add(gltf.scene);
    });
}

// Key movement
window.addEventListener("keydown", (e) => {
    // If game is over, allow resetting with R key
    if (isGameOver && e.code === "KeyR") {
        console.log("Resetting game");
        resetGame();
        return;
    }
    
    // Skip other controls if game is over
    if (isGameOver) return;
    
    const currentShapeId = tetrisMaterial.uniforms.u_shapeId.value;
    const currentOffsetX = tetrisMaterial.uniforms.u_offsetX.value;
    const currentRotation = tetrisMaterial.uniforms.u_rotation.value;
    
    // Define wall width constant to be consistent
    const wallWidth = 1;
    
    // Handle fast drop when Space is pressed
    if (e.code === "Space") {
        // Drop the piece until it collides
        let currentFallStep = Math.floor((performance.now() / 1000 - tetrisMaterial.uniforms.u_timeStart.value) * 1.0);
        let nextFallStep = currentFallStep + 1;
        
        // Keep dropping until we hit something
        while (isValidMove(currentShapeId, currentOffsetX, currentRotation, nextFallStep)) {
            nextFallStep++;
        }
        
        // Set the time to make the piece appear at its final position
        const newTime = performance.now() / 1000 - (nextFallStep - 1);
        tetrisMaterial.uniforms.u_timeStart.value = newTime;
        
        return;
    }
    
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
// Track game state
let isGameOver = false;
let gameOverText = null;

// Function to show game over effect on the screen
function showGameOverText() {
    try {
        // Clean up any previous game over effects
        if (gameOverText) {
            scene.remove(gameOverText);
            gameOverText = null;
        }
        
        console.log("Showing game over effect on screen...");
        
        // Find and apply the game over shader to the screen
        const applyGameOverShader = (group) => {
            group.traverse(child => {
                // Check if this is the screen or a mesh within the screen
                if ((child.isScreen || (child.parent && child.parent.isScreen)) && child.isMesh) {
                    console.log("Found screen mesh to apply game over shader");
                    
                    // Store the original texture if available
                    if (child.material && child.material.map) {
                        gameOverMaterial.uniforms.u_texture.value = child.material.map;
                        console.log("Applied original texture to game over shader");
                    }
                    
                    // Apply the game over shader material
                    child.material = gameOverMaterial;
                    console.log("Applied game over shader to screen mesh");
                }
            });
        };
        
        // Apply shader to all possible locations
        applyGameOverShader(scene);
        applyGameOverShader(loadGroup);
        applyGameOverShader(scrollGroup);
        
        // Reset the game over shader time for animation
        gameOverMaterial.uniforms.u_time.value = 0;
        
        // For the game over effect, we'll just apply a subtle screen effect
        // without any visible "GAME OVER" text, as requested by user
        
        console.log("Applied subtle game over effect without text");
        
        // The main effect will be the shader on the screen
        console.log("Game over shader will be applied to screen in spawnNewShape function");
        
        // Play a beep sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = 'square';
            oscillator.frequency.value = 220; // A low A note
            gainNode.gain.value = 0.1;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            
            // Frequency drop effect
            oscillator.frequency.exponentialRampToValueAtTime(110, audioContext.currentTime + 0.5);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.0);
            
            setTimeout(() => {
                oscillator.stop();
            }, 1000);
        } catch (audioError) {
            console.log("Could not play game over sound:", audioError);
        }
        
        console.log("Added GAME OVER 3D text plane");
        
    } catch (error) {
        console.error("Error creating GAME OVER text:", error);
        console.error("Error stack:", error.stack);
    }
}

function spawnNewShape() {
    lockShapeIntoGrid();
    tetrisMaterial.uniforms.u_timeStart.value = performance.now() / 1000;
    
    // Set starting position - centered horizontally
    const initialOffsetX = Math.floor(gridWidth / 2) - 2;
    tetrisMaterial.uniforms.u_offsetX.value = initialOffsetX;
    tetrisMaterial.uniforms.u_rotation.value = 0; // Reset rotation for new shape
    
    // Use all available shapes (not just 0 and 1)
    const nextShape = Math.floor(Math.random() * allShapes.length);
    console.log(`Spawning new shape with ID ${nextShape}`);
    tetrisMaterial.uniforms.u_shapeId.value = nextShape;
    
    // Check if the new shape can be placed (if not, game would be over)
    const canPlace = isValidMove(nextShape, initialOffsetX, 0, 0);
    if (!canPlace) {
        console.log("GAME OVER: Cannot place new shape!");
        
        // Set game over state
        isGameOver = true;
        
        // Show GAME OVER text
        showGameOverText();
        
        // Apply the game over material to the existing screen
        console.log("Applying game over shader to all screen meshes...");
        
        // Search for screen in all groups
        const applyToGroup = (group) => {
            group.traverse(child => {
                if ((child.isScreen || (child.parent && child.parent.isScreen)) && child.isMesh) {
                    console.log("Found screen mesh, applying game over material");
                    
                    // Save original texture if available
                    if (child.material && child.material.map && !gameOverMaterial.uniforms.u_texture.value) {
                        gameOverMaterial.uniforms.u_texture.value = child.material.map;
                    }
                    
                    // Apply game over material
                    child.material = gameOverMaterial;
                    console.log("Applied game over material to screen mesh");
                }
            });
        };
        
        // Search in both groups to make sure we find the screen
        applyToGroup(loadGroup);
        applyToGroup(scrollGroup);
        applyToGroup(scene);
    }
    
    // Check if the new shape is at the edge (it shouldn't be, but just to be safe)
    checkPieceAtEdge();
}

// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tetrisMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    gameOverMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
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

    
    // Update material time uniforms
    tetrisMaterial.uniforms.u_time.value = now;
    gameOverMaterial.uniforms.u_time.value = now;

    // If game is over, just update animations and render
    if (isGameOver) {
        // Update the HTML overlay with simple effects
        const overlay = document.getElementById('game-over-text');
        if (overlay) {
            // Simple pulsing effect
            const pulseScale = 1.0 + Math.sin(now * 3) * 0.1;
            overlay.style.transform = `translate(-50%, 0) scale(${pulseScale})`;
            
            // Occasional glitch effect
            if (Math.random() > 0.95) {
                const glitchX = (Math.random() - 0.5) * 10;
                overlay.style.transform = `translate(calc(-50% + ${glitchX}px), 0) scale(${pulseScale})`;
                
                // Random color flicker
                if (Math.random() > 0.7) {
                    overlay.style.color = '#ffffff'; // Flash white occasionally
                    setTimeout(() => {
                        if (overlay) overlay.style.color = '#ff3333'; // Return to red
                    }, 50);
                }
            }
        }
        
        // The main game over effect is in the shader applied to the screen
        // We don't need to do anything else special here
        
        // Ensure all screen meshes use the game over shader
        const checkAndApply = (group) => {
            group.traverse(child => {
                if ((child.isScreen || (child.parent && child.parent.isScreen)) && child.isMesh && child.material !== gameOverMaterial) {
                    console.log("Applying game over material to screen in animate");
                    child.material = gameOverMaterial;
                }
            });
        };
        
        // Check all possible locations where the screen might be
        checkAndApply(scene);
        checkAndApply(loadGroup);
        checkAndApply(scrollGroup);
        
        scrollGroup.rotation.y = window.scrollY * 0.001;
        composer.render();
        return;
    }

    const fallSpeed = 1.0;
    const blockHeight = 4;
    const fallDuration = now - tetrisMaterial.uniforms.u_timeStart.value;
    const fallStep = Math.floor(fallDuration * fallSpeed);
    
    // Get current shape and rotation
    const shapeId = tetrisMaterial.uniforms.u_shapeId.value;
    const currentOffsetX = tetrisMaterial.uniforms.u_offsetX.value;
    const rotation = Math.floor(tetrisMaterial.uniforms.u_rotation.value / 90) % 4;
    const shape = allShapes[shapeId];
    
    // Check for collision with existing blocks or bottom boundary
    const nextFallStep = fallStep + 1;
    const wouldCollide = !isValidMove(shapeId, currentOffsetX, tetrisMaterial.uniforms.u_rotation.value, nextFallStep);
    
    // Calculate the bottom offset for current shape+rotation
    const bottomOffset = getShapeBottomOffset(shape, rotation);
    
    // Adjust maxFall based on the shape's bottom offset
    const maxFall = gridHeight - (blockHeight - (3 - bottomOffset));
    
    // Spawn new shape if we've hit the bottom or would collide with another block
    if (fallStep >= maxFall || wouldCollide) {
        spawnNewShape();
    }

    scrollGroup.rotation.y = window.scrollY * 0.001;
    composer.render();
}
(async () => {
    // Kick off the render loop
    render();
})();