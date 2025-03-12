import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

# Sample MNI coordinates [x, y, z] in mm
# Format: [structure_name, x, y, z]
brain_regions = [
    ["Visual Cortex", 10, -85, 5],
    ["Motor Cortex", 30, -15, 60],
    ["Broca's Area", -45, 20, 15],
    ["Anterior Commissure", 0, 0, 0],  # Origin point
    ["Wernicke's Area", -52, -54, 22],
    ["Hippocampus", 28, -24, -12]
]

# Extract coordinates and names
names = [region[0] for region in brain_regions]
x_coords = [region[1] for region in brain_regions]
y_coords = [region[2] for region in brain_regions]
z_coords = [region[3] for region in brain_regions]

# Create a 3D plot
fig = plt.figure(figsize=(10, 8))
ax = fig.add_subplot(111, projection='3d')

# Plot each point
scatter = ax.scatter(x_coords, y_coords, z_coords, c=range(len(names)), 
                    cmap='viridis', s=100, marker='o')

# Add labels for each point
for i, name in enumerate(names):
    ax.text(x_coords[i], y_coords[i], z_coords[i], name, fontsize=9)

# Mark the origin (Anterior Commissure) more distinctly
ax.scatter([0], [0], [0], color='red', s=200, marker='*')
ax.text(0, 0, 0, "  Origin (AC)", fontsize=12, color='red')

# Add axes labels
ax.set_xlabel('X (Left → Right) [mm]')
ax.set_ylabel('Y (Posterior → Anterior) [mm]')
ax.set_zlabel('Z (Inferior → Superior) [mm]')

# Set title
plt.title('Brain Regions in MNI Coordinate Space', fontsize=14)

# Add a grid for better spatial reference
ax.grid(True)

# Set equal aspect ratio to avoid distortion
# This makes the brain look more anatomically correct
ax.set_box_aspect([1, 1, 1])

# Show the plot
plt.tight_layout()
plt.show()
