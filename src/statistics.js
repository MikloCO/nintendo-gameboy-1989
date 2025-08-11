import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';


export class ControlPanel {
    constructor(params, container) {
        this.gui = new GUI({
            container,
            title: 'Controls',
            width: 250
        });
        this.gui.add(params, 'minScale', 1, 20).step(1).name('minScale').onChange(value => {
            console.log(`minScale set to ${value}`);
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