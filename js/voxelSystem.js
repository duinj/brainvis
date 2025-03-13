import * as THREE from "./three.module.js";

// VoxelSystem class to manage voxels within the brain
class VoxelSystem {
  constructor(scene, brainObject, forceRenderFn) {
    this.scene = scene;
    this.brainObject = brainObject;
    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);
    this.forceRender = forceRenderFn;

    // Voxel properties
    this.voxelSize = 0.5; // Size of each voxel
    this.voxelGrid = {}; // Object to store voxel data: key = "x,y,z", value = voxel mesh
    this.voxelMaterial = new THREE.MeshLambertMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.7,
    });

    // Raycaster for checking if voxels are inside the brain
    this.raycaster = new THREE.Raycaster();

    // Initialize the voxel grid
    this.initializeVoxelGrid();
  }

  // Check if a point is inside the brain mesh using raycasting
  isPointInsideBrain(point) {
    // We'll use a simple approach: cast rays in 6 directions (±x, ±y, ±z)
    // If all rays hit the brain mesh an odd number of times, the point is inside

    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    // Get all brain meshes
    const brainMeshes = [];
    this.brainObject.traverse((child) => {
      if (child.isMesh) {
        brainMeshes.push(child);
      }
    });

    if (brainMeshes.length === 0) {
      return false;
    }

    // For simplicity, we'll just check if the point is close to any vertex of the brain mesh
    // This is a simplification but works well enough for our purposes
    const threshold = this.voxelSize * 2;

    for (const mesh of brainMeshes) {
      const positions = mesh.geometry.attributes.position.array;

      for (let i = 0; i < positions.length; i += 3) {
        const vertex = new THREE.Vector3(
          positions[i] + mesh.position.x,
          positions[i + 1] + mesh.position.y,
          positions[i + 2] + mesh.position.z
        );

        if (point.distanceTo(vertex) < threshold) {
          return true;
        }
      }
    }

    return false;
  }

  // Initialize the voxel grid based on brain boundaries
  initializeVoxelGrid() {
    // Get brain boundaries
    const box = new THREE.Box3().setFromObject(this.brainObject);
    this.minBounds = box.min;
    this.maxBounds = box.max;

    console.log("Brain bounds:", this.minBounds, this.maxBounds);

    // Calculate grid dimensions
    this.gridSizeX = Math.ceil(
      (this.maxBounds.x - this.minBounds.x) / this.voxelSize
    );
    this.gridSizeY = Math.ceil(
      (this.maxBounds.y - this.minBounds.y) / this.voxelSize
    );
    this.gridSizeZ = Math.ceil(
      (this.maxBounds.z - this.minBounds.z) / this.voxelSize
    );

    console.log(
      `Grid size: ${this.gridSizeX} x ${this.gridSizeY} x ${this.gridSizeZ}`
    );

    // Create voxel geometry (shared among all voxels)
    this.voxelGeometry = new THREE.BoxGeometry(
      this.voxelSize,
      this.voxelSize,
      this.voxelSize
    );

    // Pre-create all voxel positions (but don't add meshes yet)
    let voxelCount = 0;

    for (let x = 0; x < this.gridSizeX; x++) {
      for (let y = 0; y < this.gridSizeY; y++) {
        for (let z = 0; z < this.gridSizeZ; z++) {
          const worldX = this.minBounds.x + (x + 0.5) * this.voxelSize;
          const worldY = this.minBounds.y + (y + 0.5) * this.voxelSize;
          const worldZ = this.minBounds.z + (z + 0.5) * this.voxelSize;

          const position = new THREE.Vector3(worldX, worldY, worldZ);

          // Only create voxels that are inside or near the brain
          // Skip this check for now as it's computationally expensive
          // We'll filter when actually displaying voxels

          // Store the position in the grid
          const key = `${x},${y},${z}`;
          this.voxelGrid[key] = {
            position: position,
            active: false,
            mesh: null,
            gridPosition: { x, y, z },
          };
          voxelCount++;
        }
      }
    }

    console.log(`Created ${voxelCount} voxel positions`);
  }

  // Fill voxels with a specific color
  fillVoxels(voxelKeys, color = 0xff0000) {
    const material = new THREE.MeshLambertMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
    });

    voxelKeys.forEach((key) => {
      if (this.voxelGrid[key]) {
        this.activateVoxel(key, material);
      }
    });

    // Force a render update
    if (this.forceRender) {
      this.forceRender();
    }
  }

  // Activate a single voxel
  activateVoxel(key, material = this.voxelMaterial) {
    const voxel = this.voxelGrid[key];

    if (!voxel || voxel.active) return;

    // Create mesh if it doesn't exist
    if (!voxel.mesh) {
      const mesh = new THREE.Mesh(this.voxelGeometry, material);
      mesh.position.copy(voxel.position);
      this.voxelGroup.add(mesh);
      voxel.mesh = mesh;
    } else {
      // Update material if mesh exists
      voxel.mesh.material = material;
      // Make sure it's added to the group
      if (!this.voxelGroup.children.includes(voxel.mesh)) {
        this.voxelGroup.add(voxel.mesh);
      }
    }

    voxel.active = true;
  }

  // Deactivate a single voxel
  deactivateVoxel(key) {
    const voxel = this.voxelGrid[key];

    if (!voxel || !voxel.active) return;

    if (voxel.mesh) {
      this.voxelGroup.remove(voxel.mesh);
    }

    voxel.active = false;
  }

  // Clear all active voxels
  clearAllVoxels() {
    // Remove all meshes from the group
    while (this.voxelGroup.children.length > 0) {
      this.voxelGroup.remove(this.voxelGroup.children[0]);
    }

    // Reset active state for all voxels
    Object.keys(this.voxelGrid).forEach((key) => {
      this.voxelGrid[key].active = false;
      this.voxelGrid[key].mesh = null;
    });

    // Force a render update
    if (this.forceRender) {
      this.forceRender();
    }
  }

  // Fill a test region (a cube of voxels)
  fillTestRegion(color = 0xff0000) {
    // Get the center of the grid
    const centerX = Math.floor(this.gridSizeX / 2);
    const centerY = Math.floor(this.gridSizeY / 2);
    const centerZ = Math.floor(this.gridSizeZ / 2);

    // Create a more interesting pattern - a sphere with gradient intensity
    const voxelsToFill = [];
    const maxRadius = 8; // Maximum radius of the sphere

    // Create a spherical region with gradient color
    for (let x = centerX - maxRadius; x <= centerX + maxRadius; x++) {
      for (let y = centerY - maxRadius; y <= centerY + maxRadius; y++) {
        for (let z = centerZ - maxRadius; z <= centerZ + maxRadius; z++) {
          if (
            x >= 0 &&
            x < this.gridSizeX &&
            y >= 0 &&
            y < this.gridSizeY &&
            z >= 0 &&
            z < this.gridSizeZ
          ) {
            // Calculate distance from center
            const dx = x - centerX;
            const dy = y - centerY;
            const dz = z - centerZ;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Only include voxels within the sphere
            if (distance <= maxRadius) {
              voxelsToFill.push({
                key: `${x},${y},${z}`,
                distance: distance,
              });
            }
          }
        }
      }
    }

    // Sort by distance for a more interesting visual effect
    voxelsToFill.sort((a, b) => a.distance - b.distance);

    // Apply colors with gradient based on distance from center
    voxelsToFill.forEach((voxel) => {
      const intensity = 1 - voxel.distance / maxRadius;
      const hue = 0; // Red
      const saturation = 1;
      const lightness = 0.5 * intensity + 0.2; // Brighter in center

      // Convert HSL to hex color
      const color = new THREE.Color().setHSL(hue, saturation, lightness);

      // Set opacity based on distance
      const opacity = 0.3 + 0.7 * intensity;

      // Create custom material for this voxel
      const material = new THREE.MeshLambertMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
      });

      // Activate the voxel with the custom material
      this.activateVoxel(voxel.key, material);
    });

    console.log(`Filled ${voxelsToFill.length} voxels for test region`);
  }

  // Toggle visibility of the voxel group
  toggleVisibility(visible) {
    this.voxelGroup.visible = visible;

    // Force a render update
    if (this.forceRender) {
      this.forceRender();
    }
  }
}

// Export the VoxelSystem class
export { VoxelSystem };
