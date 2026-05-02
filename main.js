import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Scene Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// Interactive Cursor Light (adds dynamic flair)
const cursorLight = new THREE.PointLight(0x0070f3, 15, 15);
cursorLight.position.set(0, 0, 5);
scene.add(cursorLight);

// Main Key Light (Front)
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(5, 5, 10);
scene.add(keyLight);

// Fill Light (Side)
const fillLight = new THREE.DirectionalLight(0xffffff, 1.5);
fillLight.position.set(-10, 0, 5);
scene.add(fillLight);

// Rim Light (Back/Top)
const rimLight = new THREE.DirectionalLight(0xffffff, 2);
rimLight.position.set(0, 10, -5);
scene.add(rimLight);

// Function to apply material overrides
function applyMaterialOverrides(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            // Some meshes might have an array of materials
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            let newMaterials = [];
            let changed = false;

            materials.forEach((mat) => {
                if (!mat) {
                    newMaterials.push(mat);
                    return;
                }

                let isYellow = false;
                const name = (mat.name || "").toLowerCase();
                const meshName = (child.name || "").toLowerCase();

                // 1. Check by Name
                if (name.includes('yellow') || name.includes('gold') || name.includes('orange') ||
                    meshName.includes('yellow') || meshName.includes('gold')) {
                    isYellow = true;
                }

                // 2. Check by Color Values (High R, High G, Low B)
                if (!isYellow && mat.color) {
                    const c = mat.color;
                    if (c.r > 0.3 && c.g > 0.3 && c.b < 0.6) {
                        isYellow = true;
                    }
                }

                // 3. Check by Emissive Color
                if (!isYellow && mat.emissive) {
                    const e = mat.emissive;
                    if (e.r > 0.3 && e.g > 0.3 && e.b < 0.6) {
                        isYellow = true;
                    }
                }

                if (isYellow) {
                    // Create a brand new clean white material to replace the yellow one
                    const whiteMat = new THREE.MeshPhysicalMaterial({
                        color: 0xffffff,
                        metalness: 0.2,
                        roughness: 0.1,
                        clearcoat: 1.0,
                        clearcoatRoughness: 0.1,
                        reflectivity: 1.0
                    });
                    newMaterials.push(whiteMat);
                    changed = true;
                } else {
                    newMaterials.push(mat);
                }
            });

            if (changed) {
                child.material = Array.isArray(child.material) ? newMaterials : newMaterials[0];
            }
        }
    });
}

// Model Loading
const loader = new GLTFLoader();
let model;
let initialCameraZ = 5;

loader.load(
    './Copilot3D-512b67c4-5aac-4ba3-a491-83bdcff563ec.glb',
    (gltf) => {
        model = gltf.scene;
        
        // Apply material overrides (Yellow -> White)
        applyMaterialOverrides(model);
        
        // Center and scale model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 2.5; // Zoomed out more to make the model look smaller
        initialCameraZ = cameraZ;
        camera.position.z = cameraZ;

        scene.add(model);
    },
    undefined,
    (error) => {
        console.error('An error happened', error);
    }
);

// Interaction Variables
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let isHovering = false;
let autoRotation = 0;

const raycaster = new THREE.Raycaster();
const mouseVector = new THREE.Vector2();

window.addEventListener('mousemove', (event) => {
    // Normalized coordinates for Raycasting and Interactivity
    targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    // Smoothly interpolate mouse coordinates for "lazy" follow effect
    mouseX += (targetMouseX - mouseX) * 0.05;
    mouseY += (targetMouseY - mouseY) * 0.05;

    // Increment auto-rotation
    autoRotation += 0.01;

    // 1. Move Cursor Light
    cursorLight.position.x = mouseX * 5;
    cursorLight.position.y = mouseY * 5;
    cursorLight.position.z = 2 + (isHovering ? 1 : 0);

    // 2. Raycast to check for hover
    mouseVector.x = targetMouseX;
    mouseVector.y = targetMouseY;
    raycaster.setFromCamera(mouseVector, camera);

    if (model) {
        const intersects = raycaster.intersectObjects(model.children, true);
        isHovering = intersects.length > 0;

        // 3. Model Rotation: Combine Auto-rotation and Cursor following
        model.rotation.y = autoRotation + (mouseX * 0.5);
        model.rotation.x = -mouseY * 0.3;

        // 4. Subtle scale up on hover
        const targetScale = isHovering ? 1.05 : 1.0;
        model.scale.x += (targetScale - model.scale.x) * 0.1;
        model.scale.y += (targetScale - model.scale.y) * 0.1;
        model.scale.z += (targetScale - model.scale.z) * 0.1;

        // 5. Constant "floating" motion
        const time = Date.now() * 0.001;
        model.position.y = Math.sin(time) * 0.1;
    }

    // 6. Camera Parallax
    camera.position.x += (targetMouseX * 0.5 - camera.position.x) * 0.05;
    camera.position.y += (targetMouseY * 0.5 - camera.position.y) * 0.05;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
}

animate();

// Handle Resize
window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
});
