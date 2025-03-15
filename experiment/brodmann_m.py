import numpy as np
from nilearn import datasets
import json
import os

# Create output directory
os.makedirs('brodmann_areas', exist_ok=True)

# Fetch the Talairach atlas with Brodmann areas level
atlas = datasets.fetch_atlas_talairach(level_name='ba')
atlas_labels = atlas.labels

# Prepare a list to store information about all Brodmann areas
all_areas_info = []

# Process each Brodmann area
for i, label in enumerate(atlas_labels):
    if i == 0:  # Skip the background (index 0)
        continue
        
    area_name = label.decode('utf-8') if isinstance(label, bytes) else label
    safe_filename = area_name.replace(' ', '_').replace('/', '_')
    
    # Store information about this area
    area_info = {
        'index': i,
        'name': area_name,
        'voxel_filename': f"{safe_filename}_voxels.json",
        'mni_filename': f"{safe_filename}_mni.json",
        'image_filename': f"{safe_filename}.png"
    }
    
    all_areas_info.append(area_info)

# Create metadata for the index file
index_data = {
    'description': 'Index of all Brodmann areas from Talairach atlas',
    'total_areas': len(all_areas_info),
    'areas': all_areas_info
}

# Save the index to JSON file
with open("brodmann_areas/index.json", 'w') as f:
    json.dump(index_data, f, indent=2)

print(f"Exported index of {len(all_areas_info)} Brodmann areas to brodmann_areas/index.json")
