import { scene, loadGroup, scrollGroup } from './tetris-game';
import {
    ITermino,
    OTermino,
    TTermino,
    LTermino,
    JTermino,
    STermino,
    ZTermino
} from './ITerminos.js';

import { DataTexture, RGBAFormat, UnsignedByteType } from 'three';

import { gameOverMaterial, tetrisMaterial } from './shader_modules/shader-materials.js';

export const allShapes = [ITermino, OTermino, TTermino, LTermino, JTermino, STermino, ZTermino];
export const gridWidth = 14;
export const gridHeight = 14;
export const gridData = new Uint8Array(gridWidth * gridHeight * 4);
export const gameGrid = Array.from({ length: gridHeight }, () =>
    new Array(gridWidth).fill(null)
);
const gridTexture = new DataTexture(gridData, gridWidth, gridHeight, RGBAFormat, UnsignedByteType);
gridTexture.needsUpdate = true;


export function getShapeBottomOffset(shape, rotation) {
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

export function isValidRotation(shapeId, offsetX, newRotation) {
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
export function checkPieceAtEdge() {
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
export function isValidMove(shapeId, offsetX, rotation, fallOffset = null) {
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
            if (gy >= 0 && gy < gridHeight) { // Only check if within vertical bounds
                if (gameGrid[gy][gx] !== null) {
                    console.log(`Move blocked: position (${fx},${fy}) would collide with existing block at grid (${gx},${gy})`);
                    return false;
                }
            }
        }
    }

    return true; // Move is valid
}
export function spawnNewShape() {
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
       
        // Set game over state
        isGameOver = true;

        // Show GAME OVER text
        showGameOverText();

        // Search for screen in all groups
        const applyToGroup = (group) => {
            group.traverse(child => {
                if ((child.isScreen || (child.parent && child.parent.isScreen)) && child.isMesh) {
                    // Save original texture if available
                    if (child.material && child.material.map && !gameOverMaterial.uniforms.u_texture.value) {
                        gameOverMaterial.uniforms.u_texture.value = child.material.map;
                    }

                    // Apply game over material
                    child.material = gameOverMaterial;
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

function updateGridTexture() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const index = (y * gridWidth + x) * 4;
            const cell = gameGrid[y][x];
            if (cell) {
                // Store block info in texture with simpler encoding
                gridData[index] = Math.min(255, cell.type * 36); // R: type (1-7) × 36
                gridData[index + 1] = Math.min(255, (cell.shapeId + 1) * 36); // G: shapeId (1-7) × 36
                gridData[index + 2] = 255; // B: full value for active blocks
                gridData[index + 3] = 255; // A: full opacity


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
                if (rotation === 1) { // 90° counter-clockwise
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
let gameOverSoundPlayed = false; // Flag to track if game over sound has played

// Function to show game over effect on the screen
function showGameOverText() {
    try {
        // Clean up any previous game over effects
        if (gameOverText) {
            scene.remove(gameOverText);
            gameOverText = null;
        }

        // Find and apply the game over shader to the screen
        const applyGameOverShader = (group) => {
            group.traverse(child => {
                // Check if this is the screen or a mesh within the screen
                if ((child.isScreen || (child.parent && child.parent.isScreen)) && child.isMesh) {
                    // Store the original texture if available
                    if (child.material && child.material.map) {
                        gameOverMaterial.uniforms.u_texture.value = child.material.map;
                    }

                    // Apply the game over shader material
                    child.material = gameOverMaterial;
                }
            });
        };

        // Apply shader to all possible locations
        applyGameOverShader(scene);
        applyGameOverShader(loadGroup);
        applyGameOverShader(scrollGroup);

        // Reset the game over shader time for animation
        gameOverMaterial.uniforms.u_time.value = 0;

        // Only log these messages once
        if (!gameOverSoundPlayed) {
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
                
                // Mark that we've played the sound
                gameOverSoundPlayed = true;
            } catch (audioError) {
                console.log("Could not play game over sound:", audioError);
                gameOverSoundPlayed = true; // Mark as played anyway to prevent retry
            }
        }

    } catch (error) {
        console.error("Error creating GAME OVER text:", error);
        console.error("Error stack:", error.stack);
    }
}

export function getGameState() {
    return { isGameOver };
}

export function getGridTexture() {
    return gridTexture;
}

export function GG(tick) { // Add tick parameter to get the current time
    const overlay = document.getElementById('game-over-text');
    if (overlay) {
        // Simple pulsing effect
        const pulseScale = 1.0 + Math.sin(tick * 3) * 0.1;
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
}


export function gameloop(tick) {
    const fallSpeed = 1.0;
    const blockHeight = 4;
    const fallDuration = tick - tetrisMaterial.uniforms.u_timeStart.value;
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
}