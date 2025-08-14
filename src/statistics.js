import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';
import { scene, loadGroup } from './tetris-game.js';

const wireframe = {
    enabled: false,
    enableWireframe: function () {
        scene.traverse(obj => {
            if (obj.isMesh) {
                if (!obj.material.isWireframeCloned) {
                    obj.material = obj.material.clone();
                    obj.material.isWireframeCloned = true;
                }
                obj.material.wireframe = !obj.material.wireframe;
            }
        });
    },
};

export const autoRotate = {
    enabled: false,
    autoRotate: function() {
                if (autoRotate.enabled) { // Use autoRotate.enabled explicitly
                    // obj.rotation.y += 0.01; // Adjust speed as needed
                    loadGroup.rotation.y += 0.01; // Rotate the scrollGroup
                    console.log("Rotating");
                }
    },
}


export class ControlPanel {
    constructor(params, container) {
        this.gui = new GUI({
            container,
            title: 'Controls',
            width: 250
        });
        this.gui.add(wireframe, 'enabled')
            .name('Toggle Wireframe')
            .onChange(value => {
                wireframe.enableWireframe();
            });
        const imgPanel = document.createElement('div');
        imgPanel.className = 'image-stack-panel';

        const images = Object.keys(import.meta.glob('/public/gameboy_textures/*.png'));
        images.forEach(src => {
            const div = document.createElement('div');
            div.className = 'image-slice';
            div.style.backgroundImage = `url(${src})`;
            imgPanel.appendChild(div);
        });
        const folder = this.gui.addFolder('Texture Maps');
        const imagePanel = document.createElement('div');
        imagePanel.className = 'image-stack-panel';
        folder.$children.appendChild(imgPanel);

        this.gui.add(autoRotate, 'enabled')
            .name('Auto rotate')
            .onChange(value => {
                autoRotate.enabled = value;
            });
        



        
    } 
}

export class StatsPanel {

    constructor(controlsContainer) {
        this.stats = new Stats();
        this.stats.showPanel(0); // 0: fps, 1: ms, 2: memory
        this.controlsContainer = controlsContainer;
        document.body.appendChild(this.stats.dom);
        this.position();
    }

    position() {
        if (!this.controlsContainer) return;
        this.stats.dom.style.position = 'absolute';
        this.stats.dom.style.top = '100px';
        this.stats.dom.style.left = '50px';
        this.stats.dom.style.zIndex = '1000';
    }

    get statsObject() {
        return this.stats;
    }

}