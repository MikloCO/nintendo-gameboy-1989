import { ShaderMaterial, Vector2 } from 'three';
import { TetrisShader } from './tetris-shader.js';
import { GameOverShader } from './gameover-shader.js';
import { getGridTexture } from '../Tetris-logic.js';

export const gameOverMaterial = new ShaderMaterial({
    uniforms: {
        u_resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
        u_time: { value: 0.0 },
        u_gridTexture: { value: getGridTexture() },
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

export const tetrisMaterial = new ShaderMaterial({
    uniforms: {
        u_time: { value: 0.0 },
        u_timeStart: { value: performance.now() / 1000 },
        u_offsetX: { value: 0 },
        u_shapeId: { value: 0 },
        u_rotation: { value: 0 }, // rotation stored as int (0, 90, 180, 270)
        u_resolution: { value: new Vector2(window.innerWidth, window.innerHeight) },
        opacity: { value: 1.0 },
        u_gridTexture: { value: getGridTexture() },
        u_emission: { value: 1.0 },
    },
    vertexShader: TetrisShader.vertexShader,
    fragmentShader: TetrisShader.fragmentShader,
    transparent: false
});