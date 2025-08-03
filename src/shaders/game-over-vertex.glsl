precision mediump int;
precision mediump float;
uniform float u_time;
varying vec2 vUv;

void main() {
    // Pass the uv coordinates to fragment shader
    vUv = uv; // uv is provided by Three.js
    
    // Add some animation based on time
    vec3 pos = position; // position is provided by Three.js
    // Wobble effect for game over
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}