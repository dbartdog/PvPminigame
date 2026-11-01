import {
  BoxGeometry,
  Mesh,
  MeshNormalMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

const SPIN_RADIANS_PER_MS = 0.0005;
const MAX_PIXEL_RATIO = 2;

/** Loaded on demand by SceneCanvas, so Three.js stays out of the initial bundle. */
export function mountPlaceholderScene(canvas: HTMLCanvasElement): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 5;
  const geometry = new BoxGeometry();
  const material = new MeshNormalMaterial();
  const box = new Mesh(geometry, material);
  scene.add(box);

  const resize = (): void => {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  renderer.setAnimationLoop((timeMs) => {
    box.rotation.set(timeMs * SPIN_RADIANS_PER_MS, timeMs * SPIN_RADIANS_PER_MS, 0);
    renderer.render(scene, camera);
  });

  return () => {
    observer.disconnect();
    renderer.setAnimationLoop(null);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
