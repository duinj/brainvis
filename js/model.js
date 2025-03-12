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
let coordinateSystem; // Reference to the coordinate system

// Performance stats
let stats;
let originalGeometry;
let simplifiedGeometry;

// Track if the scene needs rendering
let needsRender = true;

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
  camera.position.z = 30;

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

  function loadModel() {
    object.traverse(function (child) {
      if (child.isMesh) child.material.map = texture;
    });

    scene.add(object);

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

      // Store original geometry for reference
      object.traverse(function (child) {
        if (child.isMesh) {
          originalGeometry = child.geometry;

          // Create simplified geometry with fewer vertices
          simplifyGeometry(child);
        }
      });

      // Add detail toggle button
      addDetailToggle();
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

  // Create a simplified version by sampling vertices
  const positions = geometry.getAttribute("position").array;
  const normals = geometry.getAttribute("normal").array;
  const uvs = geometry.getAttribute("uv")
    ? geometry.getAttribute("uv").array
    : null;

  // Reduce vertex count by sampling (keep every Nth vertex)
  const reduction = 4; // Keep 1/4 of vertices
  const newPositions = [];
  const newNormals = [];
  const newUvs = [];

  for (let i = 0; i < positions.length; i += 9 * reduction) {
    // 9 = 3 vertices (triangle) * 3 components (x,y,z)
    // Keep one triangle out of every 'reduction' triangles
    for (let j = 0; j < 9; j++) {
      if (i + j < positions.length) {
        newPositions.push(positions[i + j]);
        newNormals.push(normals[i + j]);
      }
    }

    if (uvs) {
      for (let j = 0; j < 6; j++) {
        // 6 = 3 vertices * 2 components (u,v)
        if ((i / 3) * 2 + j < uvs.length) {
          newUvs.push(uvs[(i / 3) * 2 + j]);
        }
      }
    }
  }

  // Create new geometry with reduced data
  simplifiedGeometry = new THREE.BufferGeometry();
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

  // Use simplified geometry by default
  mesh.geometry = simplifiedGeometry;
}

// Add button to toggle detail level
function addDetailToggle() {
  const button = document.createElement("button");
  button.textContent = "Toggle Detail";
  button.style.position = "absolute";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "100";
  button.style.padding = "10px";
  button.style.backgroundColor = "#333";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "5px";
  button.style.cursor = "pointer";

  button.addEventListener("click", function () {
    isHighDetail = !isHighDetail;

    object.traverse(function (child) {
      if (child.isMesh) {
        child.geometry = isHighDetail ? originalGeometry : simplifiedGeometry;
      }
    });

    button.textContent = isHighDetail
      ? "Switch to Low Detail"
      : "Switch to High Detail";
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
  selector.style.position = "absolute";
  selector.style.top = "10px";
  selector.style.right = "10px";
  selector.style.zIndex = "100";
  selector.style.padding = "5px";
  selector.style.backgroundColor = "#333";
  selector.style.color = "white";
  selector.style.border = "none";
  selector.style.borderRadius = "5px";

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

    switch (quality) {
      case "low":
        // Very low detail for maximum performance
        object.traverse(function (child) {
          if (child.isMesh) {
            // Use simplified geometry with higher reduction
            const highReduction = simplifyGeometryWithFactor(child, 8);
            child.geometry = highReduction;
          }
        });
        renderer.setPixelRatio(1.0);
        break;

      case "medium":
        // Default simplified geometry
        object.traverse(function (child) {
          if (child.isMesh) {
            child.geometry = simplifiedGeometry;
          }
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        break;

      case "high":
        // Original high detail
        object.traverse(function (child) {
          if (child.isMesh) {
            child.geometry = originalGeometry;
          }
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        break;
    }
  });

  document.body.appendChild(selector);
}

// Function to simplify geometry with a specific reduction factor
function simplifyGeometryWithFactor(mesh, factor) {
  const geometry = originalGeometry;

  // Create a simplified version by sampling vertices
  const positions = geometry.getAttribute("position").array;
  const normals = geometry.getAttribute("normal").array;
  const uvs = geometry.getAttribute("uv")
    ? geometry.getAttribute("uv").array
    : null;

  // Reduce vertex count by sampling (keep every Nth vertex)
  const reduction = factor; // Keep 1/factor of vertices
  const newPositions = [];
  const newNormals = [];
  const newUvs = [];

  for (let i = 0; i < positions.length; i += 9 * reduction) {
    // Keep one triangle out of every 'reduction' triangles
    for (let j = 0; j < 9; j++) {
      if (i + j < positions.length) {
        newPositions.push(positions[i + j]);
        newNormals.push(normals[i + j]);
      }
    }

    if (uvs) {
      for (let j = 0; j < 6; j++) {
        if ((i / 3) * 2 + j < uvs.length) {
          newUvs.push(uvs[(i / 3) * 2 + j]);
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
  button.style.right = "20px"; // Position at right
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

init();
animate();
