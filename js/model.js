//https://github.com/alperbayram
//alper

/*
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r125/three.min.js" ></script>
    <script src="https://threejs.org/examples/js/controls/OrbitControls.js"></script>


*/
import * as THREE from "./three.module.js";
import { OrbitControls } from "./OrbitControls.js";
import { OBJLoader } from "./OBJLoader.js";

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

  const ambientLight = new THREE.AmbientLight(0x880808, 0.9);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.8);
  camera.add(pointLight);
  scene.add(camera);

  // Create coordinate system first
  coordinateSystem = new THREE.Group();
  scene.add(coordinateSystem);
  coordinateSystem.visible = true; // Ensure it's visible

  // Create brain regions group
  brainRegionsGroup = new THREE.Group();
  scene.add(brainRegionsGroup);

  // Create test points group
  testPointsGroup = new THREE.Group();
  scene.add(testPointsGroup);
  testPointsGroup.visible = false; // Hidden by default

  function loadModel() {
    object.traverse(function (child) {
      if (child.isMesh) child.material.map = texture;
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

      // Add half brain toggle button
      addHalfBrainToggle();
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

  // Add FPS counter
  addFpsCounter();

  // Add quality selector
  addQualitySelector();

  // Add render triggers
  addRenderTriggers();

  // Add calibration controls
  addCalibrationControls();

  // Add transparency control
  addTransparencyControl();
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
  button.textContent = "Toggle Detail";
  button.style.position = "absolute";
  button.style.bottom = "20px";
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
    isHighDetail = !isHighDetail;

    object.traverse(function (child) {
      if (child.isMesh) {
        child.geometry = isHighDetail
          ? child.userData.originalGeometry
          : child.userData.simplifiedGeometry;
      }
    });

    button.textContent = isHighDetail
      ? "Switch to Low Detail"
      : "Switch to High Detail";

    // Force a render to show the changes
    forceRender();
  });

  document.body.appendChild(button);
}

// Add button to toggle half brain view
function addHalfBrainToggle() {
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
}

// Add FPS counter
function addFpsCounter() {
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
}

// Add quality selector
function addQualitySelector() {
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
}

// Add a calibration tool to adjust MNI to model coordinate mapping
function addCalibrationControls() {
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
  controlDiv.style.bottom = "60px";
  controlDiv.style.left = "10px";
  controlDiv.style.zIndex = "100";
  controlDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  controlDiv.style.padding = "10px";
  controlDiv.style.borderRadius = "4px";
  controlDiv.style.color = "white";
  controlDiv.style.fontFamily = "Arial, sans-serif";
  controlDiv.style.fontSize = "14px";

  controlDiv.innerHTML = `
    <div style="display: flex; align-items: center;">
      <label style="margin-right: 10px;">Brain Opacity: </label>
      <input type="range" id="opacitySlider" min="0" max="1" step="0.05" value="1" style="width: 150px;">
      <span id="opacityValue" style="margin-left: 10px;">1.00</span>
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

init();
animate();
