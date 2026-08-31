import { Raycaster } from '../engine/index.js';
import { project } from './project.js';

const canvas = document.getElementById('screen');
canvas.width = 640;
canvas.height = 480;

const engine = new Raycaster(project);
engine.renderSimple(canvas);
