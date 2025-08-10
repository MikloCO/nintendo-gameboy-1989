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

import vertexShader from '../shaders/tetris-vertex.glsl';
import fragmentShader from '../shaders/tetris-fragment.glsl';

const TetrisShader = {
	name: 'TetrisShader',
	uniforms: {
		'tDiffuse': { value: null },
		'opacity': { value: 1.0 },
		'u_resolution': { value: null },
		'u_time': { value: 0.0 },
		'u_offsetX': { value: 0.0 },
		'u_shapeId': { value: 0.0 },
		'u_timeStart': { value: 0.0 },
		'u_rotation': { value: 0 },
		'u_gridTexture': { value: null },
		'u_shapeBottomOffset': { value: 0 }

	},
	vertexShader,
	fragmentShader
};

export { TetrisShader };