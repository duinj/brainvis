//https://github.com/alperbayram
//alper

/*
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r125/three.min.js" ></script>
    <script src="https://threejs.org/examples/js/controls/OrbitControls.js"></script>


*/
import * as THREE from "./three.module.js";
import { OrbitControls } from "./OrbitControls.js";
import { OBJLoader } from "./OBJLoader.js";
import { VoxelSystem } from "./voxelSystem.js";

var container;
var camera, scene, renderer, controls;

let object;
let isHighDetail = false; // Flag to track detail level
let showHalfBrain = false; // Flag to track if only half brain is shown
let coordinateSystem; // Reference to the coordinate system
let brainRegions = []; // Array to store brain region markers
let brainRegionsGroup; // Group to hold brain region markers and labels
let testPointsGroup; // Group to hold test point markers and labels
let brainOpacity = 1.0; // Default opacity for the brain model
let voxelSystem; // Reference to the voxel system
let dlpfcVoxels = null; // Store the DLPFC voxels data

// Performance stats
let stats;
let originalGeometry;
let simplifiedGeometry;
let originalChildren = []; // Store original children to restore them

// Track if the scene needs rendering
let needsRender = true;

// Define brain regions with MNI coordinates [name, x, y, z]
const mniRegions = [
  ["Visual Cortex", 10, -85, 5],
  ["Motor Cortex", 30, -15, 60],
  ["Broca's Area", -45, 20, 15],
  ["Anterior Commissure", 0, 0, 0], // Origin point
  ["Wernicke's Area", -52, -54, 22],
  ["Hippocampus", 28, -24, -12],
];

// Define test points with MNI coordinates
const testPoints = [
  // Axis extremes
  ["Anterior", 0, 80, 0],
  ["Posterior", 0, -80, 0],
  ["Left", -70, 0, 0],
  ["Right", 70, 0, 0],
  ["Superior", 0, 0, 75],
  ["Inferior", 0, 0, -45],

  // Corners
  ["Front-Top-Left", -70, 80, 75],
  ["Front-Top-Right", 70, 80, 75],
  ["Back-Top-Left", -70, -80, 75],
  ["Back-Top-Right", 70, -80, 75],
  ["Front-Bottom-Left", -70, 80, -45],
  ["Front-Bottom-Right", 70, 80, -45],
  ["Back-Bottom-Left", -70, -80, -45],
  ["Back-Bottom-Right", 70, -80, -45],

  // Landmarks
  ["Frontal Pole", 0, 70, 0],
  ["Occipital Pole", 0, -75, 0],
  ["Left Temporal Pole", -55, 10, -35],
  ["Right Temporal Pole", 55, 10, -35],
  ["Vertex", 0, 0, 70],
  ["Cerebellum", 0, -45, -40],
];

function init() {
  var puthere = document.getElementById("brain");
  container = document.createElement("div");
  puthere.appendChild(container);

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.z = 50; // Increased from 30 to 50 to start more zoomed out

  scene = new THREE.Scene();
  scene.matrixAutoUpdate = false; // Disable automatic matrix updates for static objects

  // Improved lighting setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Softer ambient light
  scene.add(ambientLight);

  // Add directional lights from multiple angles for better 3D effect
  const frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
  frontLight.position.set(0, 0, 1);
  scene.add(frontLight);

  const topLight = new THREE.DirectionalLight(0xffffff, 0.6);
  topLight.position.set(0, 1, 0);
  scene.add(topLight);

  const leftLight = new THREE.DirectionalLight(0xffffff, 0.4);
  leftLight.position.set(-1, 0, 0);
  scene.add(leftLight);

  // Add a point light attached to the camera for dynamic lighting
  const pointLight = new THREE.PointLight(0xffffff, 0.4);
  camera.add(pointLight);
  scene.add(camera);

  // Create coordinate system first
  coordinateSystem = new THREE.Group();
  scene.add(coordinateSystem);
  coordinateSystem.visible = false; // Hide coordinate system by default

  // Create brain regions group
  brainRegionsGroup = new THREE.Group();
  scene.add(brainRegionsGroup);
  brainRegionsGroup.visible = false; // Hide brain regions by default

  // Create test points group
  testPointsGroup = new THREE.Group();
  scene.add(testPointsGroup);
  testPointsGroup.visible = false; // Hidden by default

  function loadModel() {
    object.traverse(function (child) {
      if (child.isMesh) {
        // Create a more sophisticated material with better lighting response
        child.material = new THREE.MeshPhongMaterial({
          color: 0xdddddd, // Light gray color
          specular: 0x111111, // Slight specular highlight
          shininess: 30, // Moderate shininess
          transparent: true,
          opacity: brainOpacity,
          side: THREE.DoubleSide,
        });
      }
    });

    scene.add(object);

    // Store original children for reference
    originalChildren = [];
    object.traverse(function (child) {
      if (child.isMesh) {
        originalChildren.push({
          mesh: child,
          position: child.position.clone(),
          visible: child.visible,
        });
      }
    });

    // Now that the model is loaded, update the coordinate system
    updateCoordinateSystem();

    // Initialize voxel system
    voxelSystem = new VoxelSystem(scene, object, forceRender);

    // Load DLPFC voxels
    loadDLPFCVoxels();

    // Add voxel toggle button
    addVoxelToggle();
  }

  const manager = new THREE.LoadingManager(loadModel);

  manager.onProgress = function (item, loaded, total) {
    console.log(item, loaded, total);
  };

  // texture

  const textureLoader = new THREE.TextureLoader(manager);
  const texture = textureLoader.load("../obj/brain.jpg");

  // model

  function onProgress(xhr) {
    if (xhr.lengthComputable) {
      const percentComplete = (xhr.loaded / xhr.total) * 100;
      console.log("model " + Math.round(percentComplete, 2) + "% downloaded");
    }
  }

  function onError() {}

  const loader = new OBJLoader(manager);
  loader.load(
    "../obj/freesurff.Obj",
    function (obj) {
      object = obj;

      const box = new THREE.Box3().setFromObject(object);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      object.position.x -= center.x;
      object.position.y -= center.y;
      object.position.z -= center.z;

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 20 / maxDim;
      object.scale.set(scale, scale, scale);

      // Store original geometry for each child
      object.traverse(function (child) {
        if (child.isMesh) {
          // Store original geometry in child's userData
          child.userData.originalGeometry = child.geometry.clone();

          // Create and store simplified geometry
          child.userData.simplifiedGeometry = simplifyGeometry(child);

          // Use simplified geometry by default
          child.geometry = child.userData.simplifiedGeometry;
        }
      });

      // Add detail toggle button
      addDetailToggle();

      // Add voxel toggle button
      addVoxelToggle();
    },
    onProgress,
    onError
  );

  renderer = new THREE.WebGLRenderer({
    antialias: false, // Disable antialiasing for performance
    powerPreference: "high-performance",
    precision: "mediump", // Use medium precision for better performance
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio for performance
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false; // Disable shadows for performance

  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 5;
  controls.maxDistance = 100;
  controls.rotateSpeed = 1.0;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI;

  window.addEventListener("resize", onWindowResize, false);

  // Add transparency control
  addTransparencyControl();

  // Add color picker
  addColorPicker();

  // Add render triggers
  addRenderTriggers();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  // Only update controls if they're being used
  if (controls.update()) {
    needsRender = true;
  }

  // Only render when needed
  if (needsRender) {
    render();
    needsRender = false;
  }
}

function render() {
  camera.lookAt(scene.position);
  renderer.render(scene, camera);
}

// Function to simplify geometry
function simplifyGeometry(mesh) {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute("position").array;
  const normals = geometry.getAttribute("normal").array;
  const uvs = geometry.getAttribute("uv")
    ? geometry.getAttribute("uv").array
    : null;

  const reduction = 4;
  const newPositions = [];
  const newNormals = [];
  const newUvs = [];

  for (let i = 0; i < positions.length; i += 9) {
    if (Math.floor(i / 9) % reduction === 0) {
      for (let j = 0; j < 9; j++) {
        if (i + j < positions.length) {
          newPositions.push(positions[i + j]);
          newNormals.push(normals[i + j]);
        }
      }

      if (uvs) {
        const uvIndex = Math.floor(i / 3) * 2;
        for (let j = 0; j < 6; j++) {
          if (uvIndex + j < uvs.length) {
            newUvs.push(uvs[uvIndex + j]);
          }
        }
      }
    }
  }

  const simplifiedGeometry = new THREE.BufferGeometry();
  simplifiedGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(newPositions, 3)
  );
  simplifiedGeometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(newNormals, 3)
  );
  if (uvs && newUvs.length > 0) {
    simplifiedGeometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(newUvs, 2)
    );
  }

  return simplifiedGeometry;
}

// Function to simplify geometry with a specific reduction factor
function simplifyGeometryWithFactor(mesh, factor) {
  // Use the original geometry as the source
  const positions = originalGeometry.getAttribute("position").array;
  const normals = originalGeometry.getAttribute("normal").array;
  const uvs = originalGeometry.getAttribute("uv")
    ? originalGeometry.getAttribute("uv").array
    : null;

  // Reduce vertex count by sampling (keep every Nth vertex)
  const reduction = factor; // Keep 1/factor of vertices
  const newPositions = [];
  const newNormals = [];
  const newUvs = [];

  // Process all triangles to maintain the complete model
  for (let i = 0; i < positions.length; i += 9) {
    // Process every 'reduction'th triangle
    if (Math.floor(i / 9) % reduction === 0) {
      // Add this triangle
      for (let j = 0; j < 9; j++) {
        if (i + j < positions.length) {
          newPositions.push(positions[i + j]);
          newNormals.push(normals[i + j]);
        }
      }

      if (uvs) {
        const uvIndex = Math.floor(i / 3) * 2;
        for (let j = 0; j < 6; j++) {
          if (uvIndex + j < uvs.length) {
            newUvs.push(uvs[uvIndex + j]);
          }
        }
      }
    }
  }

  // Create new geometry with reduced data
  const reducedGeometry = new THREE.BufferGeometry();
  reducedGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(newPositions, 3)
  );
  reducedGeometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(newNormals, 3)
  );
  if (uvs && newUvs.length > 0) {
    reducedGeometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(newUvs, 2)
    );
  }

  return reducedGeometry;
}

// Add button to toggle detail level
function addDetailToggle() {
  const button = document.createElement("button");
  button.id = "detailToggleBtn";
  button.textContent = "Low Detail";
  button.style.position = "absolute";
  button.style.bottom = "20px";
  button.style.left = "20px";
  button.style.zIndex = "100";
  button.style.padding = "10px 15px";
  button.style.backgroundColor = "#4CAF50"; // Green color
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "16px";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  button.style.transition = "all 0.3s ease";

  button.addEventListener("click", function () {
    isHighDetail = !isHighDetail;

    object.traverse(function (child) {
      if (child.isMesh) {
        child.geometry = isHighDetail
          ? child.userData.originalGeometry
          : child.userData.simplifiedGeometry;
      }
    });

    button.textContent = isHighDetail ? "Low Detail" : "High Detail";
    button.style.backgroundColor = isHighDetail ? "#4CAF50" : "#FF9800"; // Green for high detail, orange for low detail

    // Force a render to show the changes
    forceRender();
  });

  // Add hover effect
  button.addEventListener("mouseover", function () {
    this.style.backgroundColor = isHighDetail ? "#3e8e41" : "#e68a00"; // Darker shade on hover
    this.style.boxShadow = "0 6px 12px rgba(0,0,0,0.3)";
  });

  button.addEventListener("mouseout", function () {
    this.style.backgroundColor = isHighDetail ? "#4CAF50" : "#FF9800"; // Return to original color
    this.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  });

  document.body.appendChild(button);
}

// Add button to toggle half brain view
function addHalfBrainToggle() {
  // Don't add the button to keep the UI clean
  return;

  // Original code commented out
  /*
  const button = document.createElement("button");
  button.id = "halfBrainToggleBtn";
  button.textContent = "Show Half Brain";
  button.style.position = "absolute";
  button.style.bottom = "60px";
  button.style.right = "20px";
  button.style.zIndex = "100";
  button.style.padding = "8px 12px";
  button.style.backgroundColor = "#333";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";

  button.addEventListener("click", function () {
    showHalfBrain = !showHalfBrain;

    if (showHalfBrain) {
      // Create a clipping plane for the right half of the brain
      const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

      // Apply the clipping plane to all meshes
      object.traverse(function (child) {
        if (child.isMesh) {
          // Create a new material that clones the current one but adds clipping
          const newMaterial = child.material.clone();
          newMaterial.clippingPlanes = [clipPlane];
          newMaterial.clipShadows = true;
          newMaterial.needsUpdate = true;

          // Store the original material
          child.userData.originalMaterial = child.material;

          // Apply the new material
          child.material = newMaterial;
        }
      });

      // Enable clipping in the renderer
      renderer.localClippingEnabled = true;

      button.textContent = "Show Full Brain";
    } else {
      // Restore original materials
      object.traverse(function (child) {
        if (child.isMesh && child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
          delete child.userData.originalMaterial;
        }
      });

      // Disable clipping in the renderer
      renderer.localClippingEnabled = false;

      button.textContent = "Show Half Brain";
    }

    // Force a render to show the changes
    forceRender();
  });

  document.body.appendChild(button);
  */
}

// Add FPS counter
function addFpsCounter() {
  // Don't add the FPS counter to keep the UI clean
  return;

  // Original code commented out
  /*
  const fpsDiv = document.createElement("div");
  fpsDiv.style.position = "absolute";
  fpsDiv.style.top = "10px";
  fpsDiv.style.left = "10px";
  fpsDiv.style.backgroundColor = "rgba(0,0,0,0.5)";
  fpsDiv.style.color = "white";
  fpsDiv.style.padding = "5px";
  fpsDiv.style.borderRadius = "3px";
  fpsDiv.style.fontFamily = "monospace";
  fpsDiv.style.zIndex = "100";
  fpsDiv.textContent = "FPS: --";
  document.body.appendChild(fpsDiv);

  // FPS calculation variables
  let frameCount = 0;
  let lastTime = performance.now();

  // Update FPS display
  function updateFps() {
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastTime;

    if (elapsed >= 1000) {
      const fps = Math.round((frameCount * 1000) / elapsed);
      fpsDiv.textContent = `FPS: ${fps}`;
      frameCount = 0;
      lastTime = now;
    }

    requestAnimationFrame(updateFps);
  }

  updateFps();
  */
}

// Add quality selector
function addQualitySelector() {
  // Don't add the quality selector to keep the UI clean
  return;

  // Original code commented out
  /*
  const selector = document.createElement("select");
  selector.id = "qualitySelector";
  selector.style.position = "absolute";
  selector.style.top = "10px";
  selector.style.right = "10px";
  selector.style.zIndex = "100";
  selector.style.padding = "5px";
  selector.style.backgroundColor = "#333";
  selector.style.color = "white";
  selector.style.border = "none";
  selector.style.borderRadius = "4px";
  selector.style.fontSize = "14px";
  selector.style.fontFamily = "Arial, sans-serif";
  selector.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";

  const options = [
    { value: "low", text: "Low Quality (Fast)" },
    { value: "medium", text: "Medium Quality" },
    { value: "high", text: "High Quality (Slow)" },
  ];

  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.text;
    selector.appendChild(option);
  });

  // Set default to medium
  selector.value = "medium";

  selector.addEventListener("change", function () {
    const quality = this.value;

    // Save current visibility state of all meshes
    const visibilityState = [];
    object.traverse(function (child) {
      if (child.isMesh) {
        visibilityState.push({
          mesh: child,
          visible: child.visible,
        });
      }
    });

    switch (quality) {
      case "low":
        object.traverse(function (child) {
          if (child.isMesh) {
            const highReduction = simplifyGeometryWithFactor(child, 8);
            child.geometry = highReduction;
          }
        });
        renderer.setPixelRatio(1.0);
        break;

      case "medium":
        object.traverse(function (child) {
          if (child.isMesh) {
            child.geometry = child.userData.simplifiedGeometry;
          }
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        break;

      case "high":
        object.traverse(function (child) {
          if (child.isMesh) {
            child.geometry = child.userData.originalGeometry;
          }
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        break;
    }

    // Restore visibility state
    visibilityState.forEach((item) => {
      item.mesh.visible = item.visible;
    });

    // Force a render to show the changes
    forceRender();
  });

  document.body.appendChild(selector);
  */
}

// Force render on any user interaction
function forceRender() {
  needsRender = true;
}

// Add event listeners to force render on interaction
function addRenderTriggers() {
  window.addEventListener("resize", function () {
    onWindowResize();
    forceRender();
  });

  // Force render on mouse/touch events
  renderer.domElement.addEventListener("pointerdown", forceRender);
  renderer.domElement.addEventListener("pointermove", forceRender);
  renderer.domElement.addEventListener("pointerup", forceRender);
}

// Function to create a coordinate system with axes and numerical markers
function updateCoordinateSystem() {
  // Clear any existing elements in the coordinate system
  while (coordinateSystem.children.length > 0) {
    coordinateSystem.remove(coordinateSystem.children[0]);
  }

  // Get the brain model's bounding box to scale the coordinate system appropriately
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Position the coordinate system at the center of the brain
  coordinateSystem.position.copy(center);

  // Define the length of the axes (make them more proportional to the brain)
  const axisLength = maxDim * 1.2; // Reduced from 1.5 to 1.2 for more subtle appearance

  // Create axes using cylinders instead of lines for better visibility but thinner
  // X axis (red)
  const xAxisGeometry = new THREE.CylinderGeometry(
    maxDim * 0.01, // Thinner cylinder (reduced from 0.02)
    maxDim * 0.01,
    axisLength,
    8
  );
  xAxisGeometry.rotateZ(-Math.PI / 2); // Rotate to align with X axis
  const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
  xAxis.position.set(axisLength / 2, 0, 0);

  // Y axis (green)
  const yAxisGeometry = new THREE.CylinderGeometry(
    maxDim * 0.01, // Thinner
    maxDim * 0.01,
    axisLength,
    8
  );
  const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
  yAxis.position.set(0, axisLength / 2, 0);

  // Z axis (blue)
  const zAxisGeometry = new THREE.CylinderGeometry(
    maxDim * 0.01, // Thinner
    maxDim * 0.01,
    axisLength,
    8
  );
  zAxisGeometry.rotateX(Math.PI / 2); // Rotate to align with Z axis
  const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
  zAxis.position.set(0, 0, axisLength / 2);

  // Add axes to the coordinate system
  coordinateSystem.add(xAxis);
  coordinateSystem.add(yAxis);
  coordinateSystem.add(zAxis);

  // Add cone tips to the axes for better direction indication (smaller)
  // X axis tip
  const xTipGeometry = new THREE.ConeGeometry(maxDim * 0.03, maxDim * 0.1, 8); // Smaller cone
  xTipGeometry.rotateZ(-Math.PI / 2);
  const xTipMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const xTip = new THREE.Mesh(xTipGeometry, xTipMaterial);
  xTip.position.set(axisLength, 0, 0);

  // Y axis tip
  const yTipGeometry = new THREE.ConeGeometry(maxDim * 0.03, maxDim * 0.1, 8); // Smaller cone
  const yTipMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const yTip = new THREE.Mesh(yTipGeometry, yTipMaterial);
  yTip.position.set(0, axisLength, 0);

  // Z axis tip
  const zTipGeometry = new THREE.ConeGeometry(maxDim * 0.03, maxDim * 0.1, 8); // Smaller cone
  zTipGeometry.rotateX(Math.PI / 2);
  const zTipMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const zTip = new THREE.Mesh(zTipGeometry, zTipMaterial);
  zTip.position.set(0, 0, axisLength);

  // Add tips to the coordinate system
  coordinateSystem.add(xTip);
  coordinateSystem.add(yTip);
  coordinateSystem.add(zTip);

  // Add numerical markers along each axis (fewer and smaller)
  const markerCount = 4; // Reduced from 5 to 4
  const markerStep = axisLength / markerCount;

  // Create markers for X axis
  for (let i = 1; i <= markerCount; i++) {
    const position = i * markerStep;

    // Create a smaller sphere as a marker
    const markerGeometry = new THREE.SphereGeometry(maxDim * 0.025, 12, 12); // Smaller spheres
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(position, 0, 0);

    coordinateSystem.add(marker);

    // Add text label with the number
    addTextLabel(
      i.toString(),
      new THREE.Vector3(position, -maxDim * 0.07, 0), // Closer to axis
      0xff0000
    );
  }

  // Create markers for Y axis
  for (let i = 1; i <= markerCount; i++) {
    const position = i * markerStep;

    const markerGeometry = new THREE.SphereGeometry(maxDim * 0.025, 12, 12); // Smaller spheres
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(0, position, 0);

    coordinateSystem.add(marker);

    // Add text label with the number
    addTextLabel(
      i.toString(),
      new THREE.Vector3(-maxDim * 0.07, position, 0), // Closer to axis
      0x00ff00
    );
  }

  // Create markers for Z axis
  for (let i = 1; i <= markerCount; i++) {
    const position = i * markerStep;

    const markerGeometry = new THREE.SphereGeometry(maxDim * 0.025, 12, 12); // Smaller spheres
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(0, 0, position);

    coordinateSystem.add(marker);

    // Add text label with the number
    addTextLabel(
      i.toString(),
      new THREE.Vector3(0, -maxDim * 0.07, position), // Closer to axis
      0x0000ff
    );
  }

  // Add axis labels (smaller)
  addTextLabel(
    "X",
    new THREE.Vector3(axisLength + maxDim * 0.15, 0, 0), // Closer to axis end
    0xff0000,
    true
  );
  addTextLabel(
    "Y",
    new THREE.Vector3(0, axisLength + maxDim * 0.15, 0), // Closer to axis end
    0x00ff00,
    true
  );
  addTextLabel(
    "Z",
    new THREE.Vector3(0, 0, axisLength + maxDim * 0.15), // Closer to axis end
    0x0000ff,
    true
  );

  // Add a toggle button for the coordinate system if it doesn't exist yet
  if (!document.getElementById("coordToggleBtn")) {
    addCoordinateSystemToggle();
  }

  // Add brain regions after the coordinate system is set up
  addBrainRegions();

  // Add test points
  addTestPoints();

  // Force a render to show the coordinate system
  forceRender();
}

// Function to create a text label
function addTextLabel(text, position, color, isLarge = false) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 128; // Smaller canvas (reduced from 256)
  canvas.height = 64; // Smaller canvas (reduced from 128)

  // Set background to transparent
  context.fillStyle = "rgba(0, 0, 0, 0)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Draw text with a black outline for better visibility
  context.font = isLarge ? "48px Arial" : "36px Arial"; // Smaller font
  context.strokeStyle = "black";
  context.lineWidth = 3; // Thinner outline
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.strokeText(text, canvas.width / 2, canvas.height / 2);

  // Fill with color
  context.fillStyle = "#" + new THREE.Color(color).getHexString();
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create sprite material with the texture
  const material = new THREE.SpriteMaterial({ map: texture });

  // Create sprite and position it
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set(isLarge ? 0.6 : 0.4, isLarge ? 0.3 : 0.2, 1); // Smaller scale

  // Add to coordinate system
  coordinateSystem.add(sprite);

  return sprite;
}

// Add a toggle button for the coordinate system
function addCoordinateSystemToggle() {
  // Don't add the button to keep the UI clean
  return;

  // Original code commented out
  /*
  const button = document.createElement("button");
  button.id = "coordToggleBtn";
  button.textContent = "Toggle Axes";
  button.style.position = "absolute";
  button.style.bottom = "20px"; // Position at bottom
  button.style.right = "150px"; // Moved to the left to make room for quality toggle
  button.style.zIndex = "100";
  button.style.padding = "8px 12px"; // Smaller padding
  button.style.backgroundColor = "#333";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px"; // Smaller font
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)"; // Add shadow for better visibility

  button.addEventListener("click", function () {
    coordinateSystem.visible = !coordinateSystem.visible;
    this.textContent = coordinateSystem.visible ? "Hide Axes" : "Show Axes";
    forceRender();
  });

  document.body.appendChild(button);
  */
}

// Function to add brain regions based on MNI coordinates
function addBrainRegions() {
  // Clear any existing brain region markers
  while (brainRegionsGroup.children.length > 0) {
    brainRegionsGroup.remove(brainRegionsGroup.children[0]);
  }

  // Get the brain model's bounding box to scale appropriately
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Position the brain regions group at the center of the brain
  brainRegionsGroup.position.copy(center);

  // Create a material for the brain region markers
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 1.0,
    depthTest: false, // Make markers visible through the brain
  });

  // Add each brain region
  mniRegions.forEach((region) => {
    const [name, mniX, mniY, mniZ] = region;

    // Convert MNI coordinates to model coordinates
    const modelCoords = mniToModelCoordinates(mniX, mniY, mniZ, maxDim);

    // Create a sphere to mark the region
    const markerGeometry = new THREE.SphereGeometry(maxDim * 0.04, 16, 16);
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(modelCoords.x, modelCoords.y, modelCoords.z);

    // Add the marker to the brain regions group
    brainRegionsGroup.add(marker);

    // Add a label with the region name
    addRegionLabel(name, modelCoords, maxDim);
  });

  // Add a toggle button for brain regions if it doesn't exist yet
  if (!document.getElementById("regionsToggleBtn")) {
    addBrainRegionsToggle();
  }
}

// Function to convert MNI coordinates to model coordinates
function mniToModelCoordinates(mniX, mniY, mniZ, maxDim) {
  // Get calibration values from UI controls
  const scale = parseFloat(document.getElementById("mniScale")?.value || 1);
  const offsetX = parseFloat(document.getElementById("mniOffsetX")?.value || 0);
  const offsetY = parseFloat(document.getElementById("mniOffsetY")?.value || 0);
  const offsetZ = parseFloat(document.getElementById("mniOffsetZ")?.value || 0);

  // Scale factor to convert MNI coordinates to model scale
  // This is an approximation and may need adjustment based on your specific model
  const scaleFactor = (maxDim / 200) * scale; // Assuming MNI space is roughly -100 to 100 in each dimension

  // In MNI space:
  // X increases from left to right
  // Y increases from posterior to anterior
  // Z increases from inferior to superior

  // Convert to model coordinates with calibration adjustments
  // Note: This transformation may need adjustment based on your model's orientation
  return {
    x: mniX * scaleFactor + (offsetX * maxDim) / 20,
    y: mniZ * scaleFactor + (offsetY * maxDim) / 20, // Map MNI Z to model Y (vertical axis)
    z: -mniY * scaleFactor + (offsetZ * maxDim) / 20, // Map MNI Y to model Z (with negation for orientation)
  };
}

// Function to add a label for a brain region
function addRegionLabel(text, position, maxDim) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;

  // Set background to semi-transparent black for better readability
  context.fillStyle = "rgba(0, 0, 0, 0.7)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(255, 255, 255, 0.8)";
  context.lineWidth = 2;
  context.strokeRect(0, 0, canvas.width, canvas.height);

  // Draw text
  context.font = "24px Arial";
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create sprite material with the texture
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false, // Make labels visible through the brain
  });

  // Create sprite and position it
  const sprite = new THREE.Sprite(material);
  sprite.position.set(position.x, position.y + maxDim * 0.08, position.z); // Position above the marker
  sprite.scale.set(0.8, 0.2, 1);

  // Add to brain regions group
  brainRegionsGroup.add(sprite);

  return sprite;
}

// Add a toggle button for brain regions
function addBrainRegionsToggle() {
  // Don't add the button to keep the UI clean
  return;

  // Original code commented out
  /*
  const button = document.createElement("button");
  button.id = "regionsToggleBtn";
  button.textContent = "Toggle Regions";
  button.style.position = "absolute";
  button.style.bottom = "20px";
  button.style.right = "280px"; // Position to the left of the axes toggle
  button.style.zIndex = "100";
  button.style.padding = "8px 12px";
  button.style.backgroundColor = "#333";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";

  button.addEventListener("click", function () {
    brainRegionsGroup.visible = !brainRegionsGroup.visible;
    this.textContent = brainRegionsGroup.visible
      ? "Hide Regions"
      : "Show Regions";
    forceRender();
  });

  document.body.appendChild(button);
  */
}

// Add a calibration tool to adjust MNI to model coordinate mapping
function addCalibrationControls() {
  // Don't add the calibration controls to keep the UI clean
  return;

  // Original code commented out
  /*
  const controlsDiv = document.createElement("div");
  controlsDiv.id = "calibrationControls";
  controlsDiv.style.position = "absolute";
  controlsDiv.style.top = "50px";
  controlsDiv.style.right = "10px";
  controlsDiv.style.zIndex = "100";
  controlsDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  controlsDiv.style.padding = "10px";
  controlsDiv.style.borderRadius = "4px";
  controlsDiv.style.color = "white";
  controlsDiv.style.fontFamily = "Arial, sans-serif";
  controlsDiv.style.fontSize = "14px";
  controlsDiv.style.display = "none"; // Hidden by default

  controlsDiv.innerHTML = `
    <h3 style="margin-top: 0;">MNI Calibration</h3>
    <div>
      <label>Scale: </label>
      <input type="range" id="mniScale" min="0.1" max="2" step="0.05" value="1">
      <span id="mniScaleValue">1.00</span>
    </div>
    <div>
      <label>X Offset: </label>
      <input type="range" id="mniOffsetX" min="-10" max="10" step="0.5" value="0">
      <span id="mniOffsetXValue">0.00</span>
    </div>
    <div>
      <label>Y Offset: </label>
      <input type="range" id="mniOffsetY" min="-10" max="10" step="0.5" value="0">
      <span id="mniOffsetYValue">0.00</span>
    </div>
    <div>
      <label>Z Offset: </label>
      <input type="range" id="mniOffsetZ" min="-10" max="10" step="0.5" value="0">
      <span id="mniOffsetZValue">0.00</span>
    </div>
    <button id="applyCalibration">Apply</button>
  `;

  document.body.appendChild(controlsDiv);

  // Add calibration toggle button
  const button = document.createElement("button");
  button.id = "calibrationToggleBtn";
  button.textContent = "Calibrate MNI";
  button.style.position = "absolute";
  button.style.bottom = "20px";
  button.style.right = "410px"; // Position to the left of the regions toggle
  button.style.zIndex = "100";
  button.style.padding = "8px 12px";
  button.style.backgroundColor = "#333";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";

  button.addEventListener("click", function () {
    const controlsDiv = document.getElementById("calibrationControls");
    controlsDiv.style.display =
      controlsDiv.style.display === "none" ? "block" : "none";
  });

  document.body.appendChild(button);

  // Add event listeners for calibration controls
  document.getElementById("mniScale").addEventListener("input", function () {
    document.getElementById("mniScaleValue").textContent = parseFloat(
      this.value
    ).toFixed(2);
  });

  document.getElementById("mniOffsetX").addEventListener("input", function () {
    document.getElementById("mniOffsetXValue").textContent = parseFloat(
      this.value
    ).toFixed(2);
  });

  document.getElementById("mniOffsetY").addEventListener("input", function () {
    document.getElementById("mniOffsetYValue").textContent = parseFloat(
      this.value
    ).toFixed(2);
  });

  document.getElementById("mniOffsetZ").addEventListener("input", function () {
    document.getElementById("mniOffsetZValue").textContent = parseFloat(
      this.value
    ).toFixed(2);
  });

  document
    .getElementById("applyCalibration")
    .addEventListener("click", function () {
      // Update brain regions with new calibration
      addBrainRegions();
    });
  */
}

// Function to add test points based on MNI coordinates
function addTestPoints() {
  // Clear any existing test point markers
  while (testPointsGroup.children.length > 0) {
    testPointsGroup.remove(testPointsGroup.children[0]);
  }

  // Get the brain model's bounding box to scale appropriately
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Position the test points group at the center of the brain
  testPointsGroup.position.copy(center);

  // Create a material for the test point markers (cyan color)
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 1.0,
    depthTest: false, // Make markers visible through the brain
  });

  // Add each test point
  testPoints.forEach((point) => {
    const [name, mniX, mniY, mniZ] = point;

    // Convert MNI coordinates to model coordinates
    const modelCoords = mniToModelCoordinates(mniX, mniY, mniZ, maxDim);

    // Create a sphere to mark the point
    const markerGeometry = new THREE.SphereGeometry(maxDim * 0.03, 12, 12); // Slightly smaller than brain regions
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(modelCoords.x, modelCoords.y, modelCoords.z);

    // Add the marker to the test points group
    testPointsGroup.add(marker);

    // Add a label with the point name
    addTestPointLabel(name, modelCoords, maxDim);
  });

  // Add a toggle button for test points if it doesn't exist yet
  if (!document.getElementById("testPointsToggleBtn")) {
    addTestPointsToggle();
  }
}

// Function to add a label for a test point
function addTestPointLabel(text, position, maxDim) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 64;

  // Set background to semi-transparent black for better readability
  context.fillStyle = "rgba(0, 0, 0, 0.7)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(0, 255, 255, 0.8)"; // Cyan border
  context.lineWidth = 2;
  context.strokeRect(0, 0, canvas.width, canvas.height);

  // Draw text
  context.font = "20px Arial"; // Slightly smaller than brain region labels
  context.fillStyle = "#00ffff"; // Cyan text
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create sprite material with the texture
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false, // Make labels visible through the brain
  });

  // Create sprite and position it
  const sprite = new THREE.Sprite(material);
  sprite.position.set(position.x, position.y + maxDim * 0.06, position.z); // Position above the marker
  sprite.scale.set(0.7, 0.18, 1); // Slightly smaller than brain region labels

  // Add to test points group
  testPointsGroup.add(sprite);

  return sprite;
}

// Add a toggle button for test points
function addTestPointsToggle() {
  // Don't add the button to keep the UI clean
  return;

  // Original code commented out
  /*
  const button = document.createElement("button");
  button.id = "testPointsToggleBtn";
  button.textContent = "Show Test Points";
  button.style.position = "absolute";
  button.style.bottom = "20px";
  button.style.right = "540px"; // Position to the left of the calibration button
  button.style.zIndex = "100";
  button.style.padding = "8px 12px";
  button.style.backgroundColor = "#333";
  button.style.color = "#00ffff"; // Cyan text to match the markers
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "14px";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";

  button.addEventListener("click", function () {
    testPointsGroup.visible = !testPointsGroup.visible;
    this.textContent = testPointsGroup.visible
      ? "Hide Test Points"
      : "Show Test Points";
    forceRender();
  });

  document.body.appendChild(button);
  */
}

// Function to update the brain model's opacity
function updateBrainOpacity(opacity) {
  brainOpacity = opacity;

  // Update the material of all meshes in the brain model
  object.traverse(function (child) {
    if (child.isMesh) {
      // Make sure material is set to be transparent
      child.material.transparent = true;
      child.material.opacity = opacity;
      child.material.needsUpdate = true;
    }
  });

  // Force a render to show the changes
  forceRender();
}

// Add a transparency control slider
function addTransparencyControl() {
  const controlDiv = document.createElement("div");
  controlDiv.id = "transparencyControl";
  controlDiv.style.position = "absolute";
  controlDiv.style.bottom = "20px";
  controlDiv.style.left = "50%";
  controlDiv.style.transform = "translateX(-50%)"; // Center horizontally
  controlDiv.style.zIndex = "100";
  controlDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  controlDiv.style.padding = "10px 15px";
  controlDiv.style.borderRadius = "4px";
  controlDiv.style.color = "white";
  controlDiv.style.fontFamily = "Arial, sans-serif";
  controlDiv.style.fontSize = "16px";
  controlDiv.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";

  controlDiv.innerHTML = `
    <div style="display: flex; align-items: center;">
      <label style="margin-right: 10px;">Brain Opacity: </label>
      <input type="range" id="opacitySlider" min="0" max="1" step="0.05" value="1" style="width: 150px;">
      <span id="opacityValue" style="margin-left: 10px; min-width: 40px; text-align: right;">1.00</span>
    </div>
  `;

  document.body.appendChild(controlDiv);

  // Add event listener for the opacity slider
  document
    .getElementById("opacitySlider")
    .addEventListener("input", function () {
      const opacity = parseFloat(this.value);
      document.getElementById("opacityValue").textContent = opacity.toFixed(2);
      updateBrainOpacity(opacity);
    });
}

// Add a toggle button for voxel test region
function addVoxelToggle() {
  const button = document.createElement("button");
  button.id = "voxelToggleBtn";
  button.textContent = "Show DLPFC Region";
  button.style.position = "absolute";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "100";
  button.style.padding = "10px 15px";
  button.style.backgroundColor = "#2196F3"; // Blue color
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontSize = "16px";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  button.style.transition = "all 0.3s ease";

  let voxelsVisible = false;

  button.addEventListener("click", function () {
    voxelsVisible = !voxelsVisible;

    if (voxelsVisible) {
      if (dlpfcVoxels) {
        // Display DLPFC voxels
        displayDLPFCVoxels();
        button.style.backgroundColor = "#f44336"; // Red color
        button.textContent = "Hide DLPFC Region";
      } else {
        console.error("DLPFC voxels data not loaded yet");
        // Fallback to test region if DLPFC data not available
        voxelSystem.fillTestRegion();
        button.style.backgroundColor = "#f44336"; // Red color
        button.textContent = "Hide Brain Activity";
      }
    } else {
      // Clear all voxels
      voxelSystem.clearAllVoxels();
      button.style.backgroundColor = "#2196F3"; // Blue color
      button.textContent = "Show DLPFC Region";
    }

    // Force a render
    forceRender();
  });

  // Add hover effect
  button.addEventListener("mouseover", function () {
    this.style.backgroundColor = voxelsVisible ? "#d32f2f" : "#0b7dda"; // Darker shade on hover
    this.style.boxShadow = "0 6px 12px rgba(0,0,0,0.3)";
  });

  button.addEventListener("mouseout", function () {
    this.style.backgroundColor = voxelsVisible ? "#f44336" : "#2196F3"; // Return to original color
    this.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  });

  document.body.appendChild(button);
}

// Function to display DLPFC voxels
function displayDLPFCVoxels() {
  if (!dlpfcVoxels || !dlpfcVoxels.coordinates) {
    console.error("DLPFC MNI coordinates not available");
    return;
  }

  // Clear any existing voxels
  voxelSystem.clearAllVoxels();

  console.log(`Total DLPFC MNI coordinates: ${dlpfcVoxels.coordinates.length}`);
  console.log(`Description: ${dlpfcVoxels.description}`);
  console.log(`Space: ${dlpfcVoxels.space}`);
  console.log(
    `Voxel grid size: ${voxelSystem.gridSizeX} x ${voxelSystem.gridSizeY} x ${voxelSystem.gridSizeZ}`
  );

  // Create a custom material for DLPFC voxels
  const dlpfcMaterial = new THREE.MeshLambertMaterial({
    color: 0x4287f5, // Blue color
    transparent: true,
    opacity: 0.7,
  });

  // Get the brain model's bounding box to scale appropriately
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Calculate the center of the brain model's voxel grid
  const centerX = Math.floor(voxelSystem.gridSizeX / 2);
  const centerY = Math.floor(voxelSystem.gridSizeY / 2);
  const centerZ = Math.floor(voxelSystem.gridSizeZ / 2);

  console.log(`Grid center: ${centerX}, ${centerY}, ${centerZ}`);
  console.log(`Brain size: ${size.x}, ${size.y}, ${size.z}`);
  console.log(`Max dimension: ${maxDim}`);

  // Define different transformation approaches to map MNI coordinates to voxel grid
  const transformations = [
    // Approach 1: Standard MNI mapping with adjusted offsets for DLPFC
    {
      name: "Standard MNI with DLPFC offsets",
      transform: (mniX, mniY, mniZ) => {
        const scaleFactor = maxDim / 200;
        // Adjust offsets to move DLPFC more frontal and lateral
        const offsetX = 0; // No additional X offset
        const offsetY = 0.2 * maxDim; // Move forward (anterior)
        const offsetZ = 0.1 * maxDim; // Move up slightly

        return {
          x: mniX * scaleFactor + centerX,
          y: mniZ * scaleFactor + centerY + offsetY, // Map MNI Z to model Y (vertical)
          z: -mniY * scaleFactor + centerZ + offsetZ, // Map MNI Y to model Z (with negation)
        };
      },
    },

    // Approach 2: Rotated mapping to better align with brain orientation
    {
      name: "Rotated mapping",
      transform: (mniX, mniY, mniZ) => {
        const scaleFactor = maxDim / 200;
        // Rotate coordinates to better align with brain orientation
        return {
          x: mniX * scaleFactor + centerX,
          y: (mniZ * 0.7 - mniY * 0.3) * scaleFactor + centerY, // Rotate to move DLPFC more anterior
          z: (-mniY * 0.7 - mniZ * 0.3) * scaleFactor + centerZ, // Rotate to move DLPFC more superior
        };
      },
    },

    // Approach 3: Scaled mapping with emphasis on frontal and lateral positioning
    {
      name: "Frontal-lateral emphasis",
      transform: (mniX, mniY, mniZ) => {
        const scaleFactor = maxDim / 180; // Slightly larger scale
        // Emphasize lateral (X) and anterior (Y) positioning
        return {
          x: mniX * 1.2 * scaleFactor + centerX, // Emphasize lateral positioning
          y: mniZ * 0.8 * scaleFactor + centerY + 0.25 * maxDim, // Move forward
          z: -mniY * 0.8 * scaleFactor + centerZ, // Standard vertical mapping
        };
      },
    },

    // Approach 4: Direct anatomical positioning based on brain dimensions
    {
      name: "Direct anatomical positioning",
      transform: (mniX, mniY, mniZ) => {
        // For left DLPFC (negative X values)
        if (mniX < 0) {
          return {
            x: centerX - 0.35 * voxelSystem.gridSizeX, // Left lateral position
            y: centerY + 0.3 * voxelSystem.gridSizeY, // Anterior position
            z: centerZ + 0.2 * voxelSystem.gridSizeZ, // Superior position
          };
        }
        // For right DLPFC (positive X values)
        else {
          return {
            x: centerX + 0.35 * voxelSystem.gridSizeX, // Right lateral position
            y: centerY + 0.3 * voxelSystem.gridSizeY, // Anterior position
            z: centerZ + 0.2 * voxelSystem.gridSizeZ, // Superior position
          };
        }
      },
    },

    // Approach 5: Adjusted MNI mapping with non-linear transformation
    {
      name: "Non-linear transformation",
      transform: (mniX, mniY, mniZ) => {
        const scaleFactor = maxDim / 200;
        // Apply non-linear transformation to better match brain anatomy
        const signX = Math.sign(mniX);
        const absX = Math.abs(mniX);

        // Enhance lateral positioning for more extreme X values
        const adjustedX = signX * (absX + Math.pow(absX / 50, 2) * 20);

        // Move anterior coordinates more forward
        const adjustedY = mniY + Math.pow(Math.max(0, mniY) / 50, 2) * 30;

        return {
          x: adjustedX * scaleFactor + centerX,
          y: mniZ * scaleFactor + centerY + 0.2 * maxDim,
          z: -adjustedY * scaleFactor + centerZ,
        };
      },
    },

    // Approach 6: Anatomical positioning with MNI-based variation
    {
      name: "Anatomical positioning with variation",
      transform: (mniX, mniY, mniZ) => {
        const scaleFactor = maxDim / 250; // Smaller scale factor
        const baseX = centerX + (mniX < 0 ? -0.3 : 0.3) * voxelSystem.gridSizeX;
        const baseY = centerY + 0.3 * voxelSystem.gridSizeY;
        const baseZ = centerZ + 0.2 * voxelSystem.gridSizeZ;

        // Add variation based on MNI coordinates
        return {
          x: baseX + mniX * 0.1 * scaleFactor, // Small variation in X
          y: baseY + mniZ * 0.1 * scaleFactor, // Small variation in Y
          z: baseZ + -mniY * 0.1 * scaleFactor, // Small variation in Z
        };
      },
    },
  ];

  // Test each transformation approach
  const results = [];

  transformations.forEach((approach, index) => {
    const voxelKeys = [];
    let mappedCount = 0;

    // Process each MNI coordinate
    dlpfcVoxels.coordinates.forEach((coord) => {
      const [mniX, mniY, mniZ] = coord;

      // Apply the transformation
      const transformed = approach.transform(mniX, mniY, mniZ);

      // Convert to grid indices
      const gridX = Math.round(transformed.x);
      const gridY = Math.round(transformed.y);
      const gridZ = Math.round(transformed.z);

      // Create the voxel key
      const key = `${gridX},${gridY},${gridZ}`;
      voxelKeys.push(key);

      // Check if this key exists in the voxel system
      if (voxelSystem.voxelGrid[key]) {
        mappedCount++;
      }
    });

    results.push({
      index,
      name: approach.name,
      keys: voxelKeys,
      mappedCount,
    });

    console.log(
      `Approach ${index + 1} (${approach.name}): ${mappedCount} voxels mapped`
    );
  });

  // Find the approach with the most mapped voxels
  let bestApproach = results[0];

  results.forEach((result) => {
    if (result.mappedCount > bestApproach.mappedCount) {
      bestApproach = result;
    }
  });

  console.log(
    `Using approach ${bestApproach.index + 1} (${bestApproach.name}) with ${
      bestApproach.mappedCount
    } mapped voxels`
  );

  // If no approach mapped enough voxels, create anatomically correct regions
  if (bestApproach.mappedCount < 10) {
    console.log(
      "Not enough voxels mapped. Creating anatomically correct DLPFC regions."
    );

    // Create voxels directly in the brain model at the DLPFC location
    const directKeys = [];

    // Left DLPFC region - more frontal and lateral
    const leftDLPFC = {
      minX: centerX - Math.floor(voxelSystem.gridSizeX * 0.45), // More lateral
      maxX: centerX - Math.floor(voxelSystem.gridSizeX * 0.25),
      minY: centerY + Math.floor(voxelSystem.gridSizeY * 0.2), // More anterior
      maxY: centerY + Math.floor(voxelSystem.gridSizeY * 0.4),
      minZ: centerZ + Math.floor(voxelSystem.gridSizeZ * 0.1), // Slightly superior
      maxZ: centerZ + Math.floor(voxelSystem.gridSizeZ * 0.3),
    };

    // Right DLPFC region - more frontal and lateral
    const rightDLPFC = {
      minX: centerX + Math.floor(voxelSystem.gridSizeX * 0.25), // More lateral
      maxX: centerX + Math.floor(voxelSystem.gridSizeX * 0.45),
      minY: centerY + Math.floor(voxelSystem.gridSizeY * 0.2), // More anterior
      maxY: centerY + Math.floor(voxelSystem.gridSizeY * 0.4),
      minZ: centerZ + Math.floor(voxelSystem.gridSizeZ * 0.1), // Slightly superior
      maxZ: centerZ + Math.floor(voxelSystem.gridSizeZ * 0.3),
    };

    // Function to create a spherical region of voxels
    function createSphericalRegion(region) {
      const centerX = (region.minX + region.maxX) / 2;
      const centerY = (region.minY + region.maxY) / 2;
      const centerZ = (region.minZ + region.maxZ) / 2;

      const radiusX = (region.maxX - region.minX) / 2;
      const radiusY = (region.maxY - region.minY) / 2;
      const radiusZ = (region.maxZ - region.minZ) / 2;

      for (let x = region.minX; x <= region.maxX; x++) {
        for (let y = region.minY; y <= region.maxY; y++) {
          for (let z = region.minZ; z <= region.maxZ; z++) {
            // Calculate distance from center (normalized by radii to create an ellipsoid)
            const dx = (x - centerX) / radiusX;
            const dy = (y - centerY) / radiusY;
            const dz = (z - centerZ) / radiusZ;

            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // If within the ellipsoid
            if (distance <= 1.0) {
              const key = `${x},${y},${z}`;
              directKeys.push(key);
            }
          }
        }
      }
    }

    // Create both DLPFC regions
    createSphericalRegion(leftDLPFC);
    createSphericalRegion(rightDLPFC);

    console.log(
      `Created ${directKeys.length} voxel keys for anatomical DLPFC regions`
    );

    // Use these keys instead
    bestApproach = {
      index: -1,
      name: "Anatomical DLPFC regions",
      keys: directKeys,
      mappedCount: 0, // Will be updated during processing
    };
  }

  // Now activate the voxels in batches
  const batchSize = 100;
  let currentIndex = 0;
  let mappedVoxelCount = 0;

  function processBatch() {
    const endIndex = Math.min(
      currentIndex + batchSize,
      bestApproach.keys.length
    );

    for (let i = currentIndex; i < endIndex; i++) {
      const key = bestApproach.keys[i];

      // Check if the key exists in the voxel system's grid
      if (voxelSystem.voxelGrid[key]) {
        voxelSystem.activateVoxel(key, dlpfcMaterial);
        mappedVoxelCount++;
      }
    }

    currentIndex = endIndex;

    // If there are more voxels to process, schedule the next batch
    if (currentIndex < bestApproach.keys.length) {
      setTimeout(processBatch, 0);
    } else {
      console.log(
        `Displayed ${mappedVoxelCount} of ${bestApproach.keys.length} DLPFC voxels using approach "${bestApproach.name}"`
      );
      forceRender();
    }
  }

  // Start processing the first batch
  processBatch();
}

// Add a color picker for the brain
function addColorPicker() {
  const colorPickerDiv = document.createElement("div");
  colorPickerDiv.id = "colorPickerControl";
  colorPickerDiv.style.position = "absolute";
  colorPickerDiv.style.bottom = "70px";
  colorPickerDiv.style.left = "50%";
  colorPickerDiv.style.transform = "translateX(-50%)"; // Center horizontally
  colorPickerDiv.style.zIndex = "100";
  colorPickerDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  colorPickerDiv.style.padding = "10px 15px";
  colorPickerDiv.style.borderRadius = "4px";
  colorPickerDiv.style.color = "white";
  colorPickerDiv.style.fontFamily = "Arial, sans-serif";
  colorPickerDiv.style.fontSize = "16px";
  colorPickerDiv.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";

  colorPickerDiv.innerHTML = `
    <div style="display: flex; align-items: center; flex-wrap: wrap;">
      <label style="margin-right: 10px;">Brain Color: </label>
      <input type="color" id="brainColorPicker" value="#dddddd" style="width: 50px; height: 30px; cursor: pointer; margin-right: 15px;">
      <div style="display: flex; gap: 5px; margin-left: 5px;">
        <button class="colorPreset" data-color="#dddddd" style="width: 25px; height: 25px; background-color: #dddddd; border: 1px solid #fff; border-radius: 3px; cursor: pointer;"></button>
        <button class="colorPreset" data-color="#a9cce3" style="width: 25px; height: 25px; background-color: #a9cce3; border: 1px solid #fff; border-radius: 3px; cursor: pointer;"></button>
        <button class="colorPreset" data-color="#f5cba7" style="width: 25px; height: 25px; background-color: #f5cba7; border: 1px solid #fff; border-radius: 3px; cursor: pointer;"></button>
        <button class="colorPreset" data-color="#d2b4de" style="width: 25px; height: 25px; background-color: #d2b4de; border: 1px solid #fff; border-radius: 3px; cursor: pointer;"></button>
        <button class="colorPreset" data-color="#abebc6" style="width: 25px; height: 25px; background-color: #abebc6; border: 1px solid #fff; border-radius: 3px; cursor: pointer;"></button>
      </div>
    </div>
  `;

  document.body.appendChild(colorPickerDiv);

  // Add event listener for the color picker
  document
    .getElementById("brainColorPicker")
    .addEventListener("input", function () {
      const color = this.value;
      updateBrainColor(color);
    });

  // Add event listeners for preset color buttons
  document.querySelectorAll(".colorPreset").forEach((button) => {
    button.addEventListener("click", function () {
      const color = this.getAttribute("data-color");
      document.getElementById("brainColorPicker").value = color;
      updateBrainColor(color);
    });
  });
}

// Function to update the brain model's color
function updateBrainColor(colorHex) {
  // Convert hex string to THREE.Color
  const color = new THREE.Color(colorHex);

  // Update the material of all meshes in the brain model
  object.traverse(function (child) {
    if (child.isMesh) {
      child.material.color = color;
      child.material.needsUpdate = true;
    }
  });

  // Force a render to show the changes
  forceRender();
}

// Function to load DLPFC voxels from JSON file
function loadDLPFCVoxels() {
  fetch("../experiment/dlpfc_mni_coordinates.json")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("DLPFC MNI coordinates loaded:", data);
      dlpfcVoxels = data;
    })
    .catch((error) => {
      console.error("Error loading DLPFC MNI coordinates:", error);
    });
}

init();
animate();
