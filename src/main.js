import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const MODEL_URLS = [
  'assets/models/dog/scene.gltf',
  'assets/models/deer/scene.gltf',
  'assets/models/penguin/scene.gltf',
];
const N = 10000; // number of particles
let modelPositions = []; // will hold three Float32Arrays
let scrollPhase = 0; // 0→2
let points, positionsAttr;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0xf0f0f0);
document.body.appendChild(renderer.domElement);

camera.position.z = 10;
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dl = new THREE.DirectionalLight(0xffffff, 0.8);
dl.position.set(1, 1, 1);
scene.add(dl);

// 1) sample all three models into Float32Arrays
const loader = new GLTFLoader();
async function sampleModel(url) {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  // center & roughly scale so all get same sampling size
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  root.position.sub(c);
  let s = 5 / Math.max(...Object.values(box.getSize(new THREE.Vector3())).slice(0, 3));

  // scale the deer model because it's too big
  if (url.includes('deer')) {
    s *= 0.03;
  }

  root.position.sub(box.getCenter(new THREE.Vector3()));
  root.scale.setScalar(s);

  // merge all sub-geometries
  const geoms = [];
  root.updateWorldMatrix(true, false);
  root.traverse((ch) => ch.isMesh && geoms.push(ch.geometry.clone().applyMatrix4(ch.matrixWorld)));
  const merged = mergeGeometries(geoms, true);

  merged.center();

  // surface-sample N points
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).build();
  const posArr = new Float32Array(N * 3);
  const tmp = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    sampler.sample(tmp);
    // tiny jitter
    tmp.x += (Math.random() - 0.5) * 0.02;
    tmp.y += (Math.random() - 0.5) * 0.02;
    tmp.z += (Math.random() - 0.5) * 0.02;
    posArr.set([tmp.x, tmp.y, tmp.z], i * 3);
  }
  return posArr;
}

(async function init() {
  // load & sample
  for (let url of MODEL_URLS) {
    let arr = await sampleModel(url);

    // if it’s deer, scale every coordinate
    if (url.includes('deer')) {
      const factor = 0.03;
      for (let i = 0; i < arr.length; i++) {
        arr[i] *= factor;
      }
    }
    modelPositions.push(arr);
  }

  // build the Points once, using the dog positions
  const geometry = new THREE.BufferGeometry();
  const initial = new Float32Array(N * 3);
  initial.set(modelPositions[0]);
  positionsAttr = new THREE.BufferAttribute(initial, 3);
  geometry.setAttribute('position', positionsAttr);

  const material = new THREE.PointsMaterial({
    size: 0.03,
    color: 0x222222,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  });

  points = new THREE.Points(geometry, material);
  scene.add(points);

  // listen scroll
  window.addEventListener('scroll', onScroll, false);

  animate();
})();

function onScroll() {
  // normalized scroll [0…1]
  const scrollNorm = window.scrollY / (document.body.scrollHeight - innerHeight);
  const segments = MODEL_URLS.length - 1; // e.g. 2
  const rawPhase = scrollNorm * segments; // [0…2]

  // break into integer segment + fractional progress
  const i0 = Math.floor(rawPhase);
  const f0 = THREE.MathUtils.clamp(rawPhase - i0, 0, 1);

  // define plateau zone [start…end] within each segment
  const start = 0.5,
    end = 0.9; // 50% in, 90% out
  let t;
  if (f0 < start) t = 0; // fully model i0
  else if (f0 > end) t = 1; // fully model i0+1
  else t = (f0 - start) / (end - start);

  scrollPhase = THREE.MathUtils.clamp(i0 + t, 0, segments);
}

function animate() {
  const i0 = Math.floor(scrollPhase),
    i1 = Math.min(i0 + 1, modelPositions.length - 1),
    t = scrollPhase - i0;
  const a0 = modelPositions[i0],
    a1 = modelPositions[i1],
    dst = positionsAttr.array;

  for (let i = 0; i < dst.length; i++) {
    dst[i] = a0[i] + (a1[i] - a0[i]) * t;
  }
  positionsAttr.needsUpdate = true;

  points.rotation.y += 0.005;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
