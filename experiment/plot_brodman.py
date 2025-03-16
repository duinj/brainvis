import numpy as np
import json
import os
import matplotlib.pyplot as plt
from nilearn import datasets, plotting, image

# Create output directories
os.makedirs('brain_region_jsons', exist_ok=True)
os.makedirs('brain_region_images', exist_ok=True)

# Function to create an individual plot for a region and save it
def create_region_image(region_mask, area_name, atlas_name):
    fig = plt.figure(figsize=(10, 8))
    display = plotting.plot_roi(
        region_mask, 
        title=f"{area_name}",
        colorbar=True,
        draw_cross=False,
        black_bg=True,
        figure=fig
    )
    
    # Save the individual plot
    filename = f"brain_region_images/{area_name.replace(' ', '_').replace('/', '_')}.png"
    plt.savefig(filename, dpi=300, bbox_inches='tight')
    plt.close(fig)
    return filename

# Process Brodmann areas from Talairach atlas
print("Processing Brodmann areas from Talairach atlas...")
try:
    # Fetch the Talairach atlas with Brodmann areas
    talairach_atlas = datasets.fetch_atlas_talairach(level_name='ba')
    atlas_img = talairach_atlas.maps
    atlas_labels = talairach_atlas.labels
    atlas_data = atlas_img.get_fdata()
    atlas_affine = atlas_img.affine
    
    # Create index data
    brodmann_index = {
        "description": "Index of all Brodmann areas from Talairach atlas",
        "total_areas": len(atlas_labels) - 1,  # Subtract 1 for background
        "areas": []
    }
    
    for i, label in enumerate(atlas_labels):
        if i == 0:  # Skip the background (index 0)
            continue
            
        area_name = label.decode('utf-8') if isinstance(label, bytes) else label
        print(f"Processing Brodmann Area {area_name}")
        
        # Create a mask for this Brodmann area
        area_mask = image.math_img(f"img == {i}", img=atlas_img)
        
        # Get voxel coordinates
        area_data = area_mask.get_fdata()
        non_zero = np.where(area_data > 0)
        voxels = []
        for j in range(len(non_zero[0])):
            voxels.append([
                int(non_zero[0][j]),
                int(non_zero[1][j]),
                int(non_zero[2][j])
            ])
        
        # Create voxel metadata
        voxel_data = {
            'area': area_name,
            'shape': area_data.shape,
            'voxels': voxels
        }
        
        # Save voxel data to JSON file
        voxel_filename = f"{area_name.replace(' ', '_')}_voxels.json"
        with open(f"brain_region_jsons/{voxel_filename}", 'w') as f:
            json.dump(voxel_data, f)
        
        # Convert to MNI coordinates
        mni_coords = []
        for j in range(len(non_zero[0])):
            voxel = [non_zero[0][j], non_zero[1][j], non_zero[2][j], 1]
            mni = np.dot(atlas_affine, voxel)[:3]
            mni_coords.append([float(mni[0]), float(mni[1]), float(mni[2])])
        
        # Create MNI metadata
        mni_data = {
            'area': area_name,
            'description': f'Brodmann Area {area_name} from Talairach atlas',
            'space': 'MNI152',
            'coordinates': mni_coords
        }
        
        # Save MNI data to JSON file
        mni_filename = f"{area_name.replace(' ', '_')}_mni.json"
        with open(f"brain_region_jsons/{mni_filename}", 'w') as f:
            json.dump(mni_data, f)
        
        # Create and save image
        image_filename = create_region_image(area_mask, area_name, "Talairach")
        image_filename = os.path.basename(image_filename)
        
        # Add to index
        brodmann_index["areas"].append({
            "index": i,
            "name": area_name,
            "voxel_filename": voxel_filename,
            "mni_filename": mni_filename,
            "image_filename": image_filename
        })
        
        print(f"Exported data for {area_name}")
    
    # Save Brodmann index to JSON file
    with open("brain_region_jsons/brodmann_index.json", 'w') as f:
        json.dump(brodmann_index, f, indent=2)
    
    print("Brodmann areas index created successfully!")
    
except Exception as e:
    print(f"Error processing Brodmann areas: {e}")
    print("Continuing with other atlases...")

# Process Harvard-Oxford cortical atlas
print("\nProcessing Harvard-Oxford cortical atlas...")
try:
    atlas_cort = datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm')
    cort_img = atlas_cort.maps
    cort_data = cort_img.get_fdata()
    cort_labels = atlas_cort.labels
    cort_affine = cort_img.affine
    
    # Create index data
    harvard_oxford_cort_index = {
        "description": "Index of all Harvard-Oxford cortical regions",
        "total_areas": len(cort_labels) - 1,  # Subtract 1 for background
        "areas": []
    }
    
    for i, label in enumerate(cort_labels):
        if i == 0:  # Skip the background (index 0)
            continue
            
        area_name = label
        print(f"Processing {area_name}")
        
        # Create a mask for this region
        region_mask = image.math_img(f"img == {i}", img=cort_img)
        
        # Get voxel coordinates
        region_data = region_mask.get_fdata()
        non_zero = np.where(region_data > 0)
        voxels = []
        for j in range(len(non_zero[0])):
            voxels.append([
                int(non_zero[0][j]),
                int(non_zero[1][j]),
                int(non_zero[2][j])
            ])
        
        # Create voxel metadata
        voxel_data = {
            'area': area_name,
            'shape': region_data.shape,
            'voxels': voxels
        }
        
        # Save voxel data to JSON file
        voxel_filename = f"HO_Cort_{area_name.replace(' ', '_').replace('/', '_')}_voxels.json"
        with open(f"brain_region_jsons/{voxel_filename}", 'w') as f:
            json.dump(voxel_data, f)
        
        # Convert to MNI coordinates
        mni_coords = []
        for j in range(len(non_zero[0])):
            voxel = [non_zero[0][j], non_zero[1][j], non_zero[2][j], 1]
            mni = np.dot(cort_affine, voxel)[:3]
            mni_coords.append([float(mni[0]), float(mni[1]), float(mni[2])])
        
        # Create MNI metadata
        mni_data = {
            'area': area_name,
            'description': f'Harvard-Oxford Cortical Region: {area_name}',
            'space': 'MNI152',
            'coordinates': mni_coords
        }
        
        # Save MNI data to JSON file
        mni_filename = f"HO_Cort_{area_name.replace(' ', '_').replace('/', '_')}_mni.json"
        with open(f"brain_region_jsons/{mni_filename}", 'w') as f:
            json.dump(mni_data, f)
        
        # Create and save image
        image_filename = create_region_image(region_mask, f"HO_Cort_{area_name}", "Harvard-Oxford Cortical")
        image_filename = os.path.basename(image_filename)
        
        # Add to index
        harvard_oxford_cort_index["areas"].append({
            "index": i,
            "name": area_name,
            "voxel_filename": voxel_filename,
            "mni_filename": mni_filename,
            "image_filename": image_filename
        })
        
        print(f"Exported data for {area_name}")
    
    # Save Harvard-Oxford cortical index to JSON file
    with open("brain_region_jsons/harvard_oxford_cortical_index.json", 'w') as f:
        json.dump(harvard_oxford_cort_index, f, indent=2)
    
    print("Harvard-Oxford cortical index created successfully!")
    
except Exception as e:
    print(f"Error processing Harvard-Oxford cortical atlas: {e}")

# Process Harvard-Oxford subcortical atlas
print("\nProcessing Harvard-Oxford subcortical atlas...")
try:
    atlas_sub = datasets.fetch_atlas_harvard_oxford('sub-maxprob-thr25-2mm')
    sub_img = atlas_sub.maps
    sub_data = sub_img.get_fdata()
    sub_labels = atlas_sub.labels
    sub_affine = sub_img.affine
    
    # Create index data
    harvard_oxford_sub_index = {
        "description": "Index of all Harvard-Oxford subcortical regions",
        "total_areas": len(sub_labels) - 1,  # Subtract 1 for background
        "areas": []
    }
    
    for i, label in enumerate(sub_labels):
        if i == 0:  # Skip the background (index 0)
            continue
            
        area_name = label
        print(f"Processing {area_name}")
        
        # Create a mask for this region
        region_mask = image.math_img(f"img == {i}", img=sub_img)
        
        # Get voxel coordinates
        region_data = region_mask.get_fdata()
        non_zero = np.where(region_data > 0)
        voxels = []
        for j in range(len(non_zero[0])):
            voxels.append([
                int(non_zero[0][j]),
                int(non_zero[1][j]),
                int(non_zero[2][j])
            ])
        
        # Create voxel metadata
        voxel_data = {
            'area': area_name,
            'shape': region_data.shape,
            'voxels': voxels
        }
        
        # Save voxel data to JSON file
        voxel_filename = f"HO_Sub_{area_name.replace(' ', '_').replace('/', '_')}_voxels.json"
        with open(f"brain_region_jsons/{voxel_filename}", 'w') as f:
            json.dump(voxel_data, f)
        
        # Convert to MNI coordinates
        mni_coords = []
        for j in range(len(non_zero[0])):
            voxel = [non_zero[0][j], non_zero[1][j], non_zero[2][j], 1]
            mni = np.dot(sub_affine, voxel)[:3]
            mni_coords.append([float(mni[0]), float(mni[1]), float(mni[2])])
        
        # Create MNI metadata
        mni_data = {
            'area': area_name,
            'description': f'Harvard-Oxford Subcortical Region: {area_name}',
            'space': 'MNI152',
            'coordinates': mni_coords
        }
        
        # Save MNI data to JSON file
        mni_filename = f"HO_Sub_{area_name.replace(' ', '_').replace('/', '_')}_mni.json"
        with open(f"brain_region_jsons/{mni_filename}", 'w') as f:
            json.dump(mni_data, f)
        
        # Create and save image
        image_filename = create_region_image(region_mask, f"HO_Sub_{area_name}", "Harvard-Oxford Subcortical")
        image_filename = os.path.basename(image_filename)
        
        # Add to index
        harvard_oxford_sub_index["areas"].append({
            "index": i,
            "name": area_name,
            "voxel_filename": voxel_filename,
            "mni_filename": mni_filename,
            "image_filename": image_filename
        })
        
        print(f"Exported data for {area_name}")
    
    # Save Harvard-Oxford subcortical index to JSON file
    with open("brain_region_jsons/harvard_oxford_subcortical_index.json", 'w') as f:
        json.dump(harvard_oxford_sub_index, f, indent=2)
    
    print("Harvard-Oxford subcortical index created successfully!")
    
except Exception as e:
    print(f"Error processing Harvard-Oxford subcortical atlas: {e}")

# Create a master index of all atlases
print("\nCreating master index of all atlases...")
master_index = {
    "description": "Master index of all brain atlases",
    "atlases": [
        {
            "name": "Brodmann Areas (Talairach)",
            "description": "Brodmann areas from Talairach atlas",
            "index_filename": "brodmann_index.json"
        },
        {
            "name": "Harvard-Oxford Cortical",
            "description": "Harvard-Oxford cortical regions",
            "index_filename": "harvard_oxford_cortical_index.json"
        },
        {
            "name": "Harvard-Oxford Subcortical",
            "description": "Harvard-Oxford subcortical regions",
            "index_filename": "harvard_oxford_subcortical_index.json"
        }
    ]
}

# Save master index to JSON file
with open("brain_region_jsons/master_index.json", 'w') as f:
    json.dump(master_index, f, indent=2)

print("\nAll atlas indices created successfully!")
print("JSON files saved to 'brain_region_jsons' directory.")
print("Images saved to 'brain_region_images' directory.")
