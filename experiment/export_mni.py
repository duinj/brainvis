import numpy as np
import matplotlib.pyplot as plt
from nilearn import datasets, plotting, image
import json

# Extract DLPFC voxels from Harvard-Oxford atlas
def extract_dlpfc_from_atlas():
    # Load the Harvard-Oxford atlas
    atlas = datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm')
    atlas_img = atlas.maps
    atlas_labels = atlas.labels
    
    # Find the Middle Frontal Gyrus (often used as proxy for DLPFC)
    mfg_indices = [i for i, label in enumerate(atlas_labels) 
                  if 'Middle Frontal Gyrus' in str(label)]
    
    print(f"Found Middle Frontal Gyrus regions: {[atlas_labels[i] for i in mfg_indices]}")
    
    # Create a mask for the DLPFC
    mfg_mask = image.math_img(
        f"np.isin(img, {mfg_indices})", 
        img=atlas_img
    )
    
    # Get the data as a numpy array
    dlpfc_data = mfg_mask.get_fdata()
    
    # Plot to verify
    display = plotting.plot_roi(
        mfg_mask, 
        title="DLPFC (Middle Frontal Gyrus)",
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
        with open('dlpfc_atlas_voxels.json', 'w') as f:
            json.dump(data, f)
        
        print(f"Exported {len(voxels)} voxels to dlpfc_atlas_voxels.json")
        return data
    
    # Export the sparse matrix
    sparse_data = export_sparse_matrix(dlpfc_data)
    
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
            'description': 'DLPFC (Middle Frontal Gyrus) from Harvard-Oxford atlas',
            'space': 'MNI152',
            'coordinates': mni_coords
        }
        
        # Save to JSON file
        with open('dlpfc_mni_coordinates.json', 'w') as f:
            json.dump(data, f)
        
        print(f"Exported {len(mni_coords)} MNI coordinates to dlpfc_mni_coordinates.json")
        return data
    
    # Export MNI coordinates
    mni_data = export_mni_coordinates(mfg_mask, dlpfc_data)
    
    return sparse_data, mni_data, display

# Extract and export the DLPFC voxels
sparse_data, mni_data, display = extract_dlpfc_from_atlas()
