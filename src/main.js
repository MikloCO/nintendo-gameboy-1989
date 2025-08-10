import './style.css'
import { animate, inView } from "motion"
import { a } from 'motion/react-client';
import { 
    Scene,
    PerspectiveCamera,
    WebGLRenderer,
    TorusKnotGeometry,
    MeshLambertMaterial,
    ShaderMaterial,
    Mesh,
    AmbientLight,
    DirectionalLight,
    Group
    
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TetrisShader } from './shader_modules/tetris-shader';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/'); // or your local path

const gameboyTag = document.querySelector("section.gameboymodel");

animate("header", 
    {
        y: [-20, 0],
        opacity: [0, 1]
    }, 
    { duration: 1, delay: 2.5 }
)

animate("section.new-drop", {
    y: [-20, 0],
    opacity: [0, 1]
},
{duration: 1, delay: 2})

animate('section.content p, section.content img', { opacity: 0 })

const boxes = document.querySelectorAll("section.content p, section.content img")

boxes.forEach((box) => {
    inView(box, () => {
        animate(box, { opacity: 1 }, { duration: 1, delay: 1 });
    });
});


const scene = new Scene();
const camera = new PerspectiveCamera(19, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
gameboyTag.appendChild(renderer.domElement);

// Lighting
const light = new AmbientLight(0xFFFFFF);
camera.add(light);

const keylight = new DirectionalLight(0xFFFFFF, 1);
keylight.position.set(-1, 1, 3);
camera.add(keylight);

const fillLight = new DirectionalLight(0xFFFFFF, 0.5);
fillLight.position.set(1,1,3);
camera.add(fillLight);

const backlight = new DirectionalLight(0xFFFFFF, 1);
backlight.position.set(-1, -3, -1);
camera.add(backlight);
scene.add(camera);


const material = new MeshLambertMaterial({ color: 0xffff00 });



const loadGroup = new Group();
loadGroup.position.y = -4;

const scrollGroup = new Group();

// Object import
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);


gltfLoader.load("/models/gameboy.glb", (gltf) => {
    loadGroup.add(gltf.scene);
})

gltfLoader.load("/models/screen.glb", (gltf) => {
    gltf.scene.traverse((child) => {
        if (child.isMesh) {
            child.material = material; 
        }
    });
    loadGroup.add(gltf.scene);
});

gltfLoader.load("/models/cartridge.glb", (gltf) => {
    loadGroup.add(gltf.scene);
})


scrollGroup.add(loadGroup);
scene.add(scrollGroup);


scene.add(loadGroup);

animate(0, 1, {
    duration: 2,
    delay: 1,
    onUpdate: (t) => {
        loadGroup.position.y = -5 + (5 * t); 
    },
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.maxDistance = 6;
controls.minDistance = 2.5;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.update();

camera.position.set(0, 0, 20);

// Post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// const tetris = new ShaderPass(TetrisShader);
// composer.addPass(tetris);

const outputPass = new OutputPass();
composer.addPass(outputPass);


const render = () =>{
    controls.update();
    scrollGroup.rotation.set(0, window.scrollY, 0); // Rotate the group slowly
    requestAnimationFrame(animate);
    composer.render();
    renderer.setAnimationLoop(render);
}

const resize = () => {
    camera.aspect =window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

render();
window.addEventListener("resize", resize);
