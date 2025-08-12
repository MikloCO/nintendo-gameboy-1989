import { tetrisMaterial, gameOverMaterial } from './shader_modules/shader-materials';
import { camera, renderer, playButtonAnimation } from './tetris-game';
import { getGameState, isValidMove, checkPieceAtEdge, isValidRotation } from './Tetris-logic';



// Key movement
window.addEventListener("keydown", (e) => {
    // Skip other controls if game is over
    if (getGameState().isGameOver) return;

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
        playButtonAnimation('arrow_right');

        const newOffsetX = currentOffsetX + 1;
        // Check if moving right is valid using the new collision detection
        if (isValidMove(currentShapeId, newOffsetX, currentRotation)) {
            tetrisMaterial.uniforms.u_offsetX.value = newOffsetX;
            // Check if piece is now at edge
            checkPieceAtEdge();
        }
    }
    if (e.code === "ArrowLeft") {
        playButtonAnimation('arrow_left');

        const newOffsetX = currentOffsetX - 1;
        // Check if moving left is valid using the new collision detection
        if (isValidMove(currentShapeId, newOffsetX, currentRotation)) {
            tetrisMaterial.uniforms.u_offsetX.value = newOffsetX;
            // Check if piece is now at edge
            checkPieceAtEdge();
        }
    }

    if (e.code === "ArrowUp") {
        playButtonAnimation('arrowsAction');
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
        playButtonAnimation('down_arrow');

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
// Resize
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tetrisMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    gameOverMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);

    // // Update GUI width if needed
    // if (gui) {
    //     gui.width = 250;
    // }

    // Reposition stats below controls
    // if (stats && stats.dom) {
    //     positionStatsPanel();
    // }
});
