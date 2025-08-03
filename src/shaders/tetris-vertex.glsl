precision mediump float;
precision mediump int;
uniform float u_time;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec3 pos = position;
    // Remove wobble effect for stable gameplay
    // pos.x += sin(u_time * 2.0 + position.y) * 0.01;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}