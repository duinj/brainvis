import numpy as np
import matplotlib.pyplot as plt
from nilearn import datasets, plotting, image
import json
import os

# Create output directory
os.makedirs('brodmann_areas', exist_ok=True)

# Fetch the Talairach atlas with Brodmann areas level
atlas = datasets.fetch_atlas_talairach(level_name='ba')
atlas_img = atlas.maps
atlas_labels = atlas.labels

# Process each Brodmann area
for i, label in enumerate(atlas_labels):
    if i == 0:  # Skip the background (index 0)
        continue
        
    area_name = label.decode('utf-8') if isinstance(label, bytes) else label
    print(f"Processing {area_name}")
    
    # Create a mask for this Brodmann area
    area_mask = image.math_img(f"img == {i}", img=atlas_img)
    
    # Get the data as numpy array
    area_data = area_mask.get_fdata()
    

    
    # Export voxel coordinates
    non_zero = np.where(area_data > 0)
    voxels = []
    for j in range(len(non_zero[0])):
        voxels.append([
            int(non_zero[0][j]),
            int(non_zero[1][j]),
            int(non_zero[2][j])
        ])
    
    # Create metadata
    voxel_data = {
        'area': area_name,
        'shape': area_data.shape,
        'voxels': voxels
    }
    
    # Save to JSON file
    with open(f"brodmann_areas/{area_name.replace(' ', '_')}_voxels.json", 'w') as f:
        json.dump(voxel_data, f)
    
    # Export MNI coordinates
    affine = area_mask.affine
    mni_coords = []
    for j in range(len(non_zero[0])):
        voxel = [non_zero[0][j], non_zero[1][j], non_zero[2][j], 1]
        mni = np.dot(affine, voxel)[:3]
        mni_coords.append([float(mni[0]), float(mni[1]), float(mni[2])])
    
    # Create metadata
    mni_data = {
        'area': area_name,
        'description': f'Brodmann Area {area_name} from Talairach atlas',
        'space': 'MNI152',
        'coordinates': mni_coords
    }
    
    # Save to JSON file
    with open(f"brodmann_areas/{area_name.replace(' ', '_')}_mni.json", 'w') as f:
        json.dump(mni_data, f)
    
    print(f"Exported {len(voxels)} voxels and MNI coordinates for {area_name}")

print("All Brodmann areas processed successfully!")
