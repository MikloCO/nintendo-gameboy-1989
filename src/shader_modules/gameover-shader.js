/**
 * @module CopyShader
 * @three_import import { CopyShader } from 'three/addons/shaders/CopyShader.js';
 */

/**
 * Full-screen copy shader pass.
 *
 * @constant
 * @type {ShaderMaterial~Shader}
 */

import vertexShader from '../shaders/game-over-vertex.glsl';
import fragmentShader from '../shaders/game-over-fragment.glsl';

const GameOverShader = {
    name: 'GameOverShader',
    uniforms: {
        'u_resolution': { value: null },
        'u_time': { value: 0.0 },
        'u_gridTexture': { value: null },
        'u_fontAtlas': { value: null } // Texture atlas for font
    },
    vertexShader,
    fragmentShader
};

export { GameOverShader };