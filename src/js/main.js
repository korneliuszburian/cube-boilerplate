import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

initScene('#eye-container', 'models/eye_model.glb');
initScene('#space-container', 'models/free_deep_space.glb');

function initScene(containerId, modelPath) {
  const container = document.querySelector(containerId);
  let renderer, scene, camera, controls, eyeModel, modelGroup;

  // Specific flag to track if this is the eye scene
  const isEyeScene = containerId === '#eye-container';

  // Ensure container has a defined size
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // Setup scene
  scene = new THREE.Scene();
  scene.background = null; // Make background transparent

  // Tracking setup
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();
  const planePoint = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  // Improved size detection and handling
  function getContainerSize() {
    const rect = container.getBoundingClientRect();
    return {
      width: rect.width || 300, // Fallback to 300 if no width
      height: rect.height || 300 // Fallback to 300 if no height
    };
  }

  const {width, height} = getContainerSize();

  // Setup camera with aspect ratio
  camera = new THREE.PerspectiveCamera(30, width / height, 1, 1000);
  camera.position.set(0, 0, 45); // Increased distance
  scene.add(camera);

  // Setup renderer with explicit size and options
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    stencil: true
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Setup controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 100;
  controls.enablePan = false;

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 5);
  pointLight.position.set(10, 10, 10);
  scene.add(pointLight);

  // Mouse move event listener (global)
  function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    // console.log("Mouse Position:", pointer.x, pointer.y); // Debugging
  }

  // Function to get the center of an element
  function getElementCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  // Function to find the active element (or the element under the mouse)
  function getActiveElement() {
    let activeElement = null;
    const elements = document.querySelectorAll('.card'); // Select all card elements

    // Check if the mouse is over any of the cards
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (
        pointer.x >= (rect.left / window.innerWidth) * 2 - 1 &&
        pointer.x <= (rect.right / window.innerWidth) * 2 - 1 &&
        pointer.y >= -(rect.bottom / window.innerHeight) * 2 + 1 &&
        pointer.y <= -(rect.top / window.innerHeight) * 2 + 1
      ) {
        activeElement = element;
        // console.log("Active Element:", element); // Debugging
        break; // Stop checking once we find an element
      }
    }

    return activeElement;
  }

  // Update eye tracking
  function updateEyeTracking() {
    if (!eyeModel) return;

    let targetX = 0;
    let targetY = 0;

    const activeElement = getActiveElement();

    if (activeElement) {
      const center = getElementCenter(activeElement);
      // Convert element center to normalized device coordinates
      targetX = (center.x / window.innerWidth) * 2 - 1;
      targetY = -((center.y / window.innerHeight) * 2 - 1);
      // console.log("Target Coordinates:", targetX, targetY); // Debugging
    } else {
      // console.log("No active element"); // Debugging
    }

    const maxRotationX = Math.PI / 4;
    const maxRotationY = Math.PI / 4;

    // Get the eye's world position
    const eyePosition = new THREE.Vector3();
    eyeModel.getWorldPosition(eyePosition);

    // Calculate the direction from the eye to the lookAt point
    const lookAtPoint = new THREE.Vector3(targetX, targetY, 0); // Z = 0 for 2D
    const direction = lookAtPoint.clone().sub(eyePosition).normalize();

    // Calculate the rotation angles using atan2
    let rotationX = -Math.atan2(
      direction.y,
      Math.sqrt(direction.x * direction.x + direction.z * direction.z)
    );
    let rotationY = -Math.atan2(direction.x, direction.z);

    // Clamp the rotation angles
    rotationX = Math.max(-maxRotationX, Math.min(maxRotationX, rotationX));
    rotationY = Math.max(-maxRotationY, Math.min(maxRotationY, rotationY));

    // Smooth interpolation for more natural movement
    const smoothingFactor = 0.5;

    eyeModel.rotation.x += (rotationX - eyeModel.rotation.x) * smoothingFactor;
    eyeModel.rotation.y += (rotationY - eyeModel.rotation.y) * smoothingFactor;
  }

  // Load model
  const loader = new GLTFLoader();
  loader.load(
    modelPath,
    function (gltf) {
      modelGroup = new THREE.Group();

      // Find the eye mesh only for the eye scene
      let eyeMesh = null;
      gltf.scene.traverse(function (child) {
        if (child.isMesh) {
          // Ensure materials are double-sided and optimize
          child.material.side = THREE.DoubleSide;
          child.material.needsUpdate = true;

          // Only set eyeMesh for the eye scene
          if (isEyeScene) {
            eyeMesh = child;
          }
        }
      });

      // Center and scale model
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scaleFactor = 22 / maxDim; // Slightly reduced scale

      // Subtract the center to truly center the model
      gltf.scene.position.sub(center);
      gltf.scene.scale.setScalar(scaleFactor);

      // **Adjust the model's position to center it**
      gltf.scene.position.x += 8; // Adjust this value to move the eye right

      // Store eye model reference only for the eye scene
      if (isEyeScene) {
        eyeModel = eyeMesh;

        // Rotate the model to face forward
        gltf.scene.rotation.set(0, -Math.PI / 2, 0);

        // Add to group and scene
        modelGroup.add(gltf.scene);
        scene.add(modelGroup);

        // Ensure model group is centered
        modelGroup.position.set(0, 0, 0);
        camera.lookAt(modelGroup.position);

        // Add mouse move event listener only for eye scene
        // container.addEventListener('mousemove', onMouseMove, false); // Removed container listener
      } else {
        // For other scenes, just add to scene
        modelGroup.add(gltf.scene);
        scene.add(modelGroup);
      }
    },
    function (error) {
      // console.error('Error loading model:', error);
    }
  );

  // Responsive resize
  function onWindowResize() {
    const {width, height} = getContainerSize();

    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onWindowResize);

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Update eye tracking
    updateEyeTracking();

    renderer.render(scene, camera);
  }
  animate();
}

// Add global mouse move listener
window.addEventListener('mousemove', onMouseMove, false);
