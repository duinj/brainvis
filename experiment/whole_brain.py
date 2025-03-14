import numpy as np
import matplotlib.pyplot as plt
from nilearn import datasets, plotting, image
import json

# Extract whole brain voxels from Harvard-Oxford atlas
def extract_whole_brain_from_atlas():
    # Load the Harvard-Oxford atlas
    atlas = datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm')
    atlas_img = atlas.maps
    atlas_labels = atlas.labels
    
    # Print all available regions
    print(f"Available regions in the atlas: {atlas_labels[1:]}")  # Skip the first label (background)
    
    # Create a mask for the whole brain (all non-zero values in the atlas)
    whole_brain_mask = image.math_img(
        "img > 0", 
        img=atlas_img
    )
    
    # Get the data as a numpy array
    whole_brain_data = whole_brain_mask.get_fdata()
    
    # Plot to verify
    display = plotting.plot_roi(
        whole_brain_mask, 
        title="Whole Brain",
        draw_cross=False
    )
    plt.show()
    
    # Export as sparse representation (coordinates of non-zero voxels)
    def export_sparse_matrix(matrix):
        # Find non-zero voxels
        non_zero = np.where(matrix > 0)
        
        # Create list of coordinates
        voxels = []
        for i in range(len(non_zero[0])):
            voxels.append([
                int(non_zero[0][i]),
                int(non_zero[1][i]),
                int(non_zero[2][i])
            ])
        
        # Create metadata
        data = {
            'shape': matrix.shape,
            'voxels': voxels
        }
        
        # Save to JSON file
        with open('whole_brain_atlas_voxels.json', 'w') as f:
            json.dump(data, f)
        
        print(f"Exported {len(voxels)} voxels to whole_brain_atlas_voxels.json")
        return data
    
    # Export the sparse matrix
    sparse_data = export_sparse_matrix(whole_brain_data)
    
    # Also export with MNI coordinates
    def export_mni_coordinates(mask_img, matrix):
        # Find non-zero voxels
        non_zero = np.where(matrix > 0)
        
        # Get affine transformation
        affine = mask_img.affine
        
        # Convert voxel indices to MNI coordinates
        mni_coords = []
        for i in range(len(non_zero[0])):
            voxel = [non_zero[0][i], non_zero[1][i], non_zero[2][i], 1]
            mni = np.dot(affine, voxel)[:3]
            mni_coords.append([float(mni[0]), float(mni[1]), float(mni[2])])
        
        # Create metadata
        data = {
            'description': 'Whole Brain from Harvard-Oxford atlas',
            'space': 'MNI152',
            'coordinates': mni_coords
        }
        
        # Save to JSON file
        with open('whole_brain_mni_coordinates.json', 'w') as f:
            json.dump(data, f)
        
        print(f"Exported {len(mni_coords)} MNI coordinates to whole_brain_mni_coordinates.json")
        return data
    
    # Export MNI coordinates
    mni_data = export_mni_coordinates(whole_brain_mask, whole_brain_data)
    
    return sparse_data, mni_data, display

# Extract and export the whole brain voxels
sparse_data, mni_data, display = extract_whole_brain_from_atlas()
