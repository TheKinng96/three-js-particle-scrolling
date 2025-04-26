import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xf0f0f0);
document.body.appendChild(renderer.domElement);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Add smooth damping
controls.dampingFactor = 0.05; // Damping factor
controls.screenSpacePanning = false; // Pan in 3D space
controls.minDistance = 3; // Minimum zoom distance
controls.maxDistance = 20; // Maximum zoom distance
controls.maxPolarAngle = Math.PI; // Maximum vertical angle

const gltfLoader = new GLTFLoader();
gltfLoader.load('assets/models/dog/scene.gltf', (gltf) => {
  const root = gltf.scene;

  // 1) Center & scale the root just as before
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 5 / maxDim;
  root.scale.set(scale, scale, scale);

  // 2) Gather all mesh geometries (apply their world transforms):
  const geoms = [];
  root.updateWorldMatrix(true, false);
  root.traverse((child) => {
    if (child.isMesh) {
      const geom = child.geometry.clone();
      geom.applyMatrix4(child.matrixWorld);
      geoms.push(geom);
    }
  });
  // 3) Merge into one big geometry:
  const merged = mergeGeometries(geoms, true);

  // 4) Build a surface sampler
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged))
    .setWeightAttribute(null) // or a custom weight for non-uniform density
    .build();

  // 5) Sample N points
  const N = 20_000;
  const positions = new Float32Array(N * 3);
  const tempPos = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    sampler.sample(tempPos);
    // optional jitter in a small radius:
    tempPos.x += (Math.random() - 0.5) * 0.02;
    tempPos.y += (Math.random() - 0.5) * 0.02;
    tempPos.z += (Math.random() - 0.5) * 0.02;
    positions.set([tempPos.x, tempPos.y, tempPos.z], i * 3);
  }

  // 6) Create the Points mesh
  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  );
  const particlesMat = new THREE.PointsMaterial({
    size: 0.03,
    color: 0x222222,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(particlesGeo, particlesMat);
  scene.add(points);

  // 7) Remove or hide the original
  scene.remove(root);
});

camera.position.z = 10;

function animate() {
    controls.update();
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});