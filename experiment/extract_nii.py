import numpy as np
import json
import os
import glob
import nibabel as nib
from nilearn import image

# Create output directories
os.makedirs('roi_jsons', exist_ok=True)
os.makedirs('rois_mni', exist_ok=True)

def process_nii_file(nii_path):
    """Process a single .nii file and return its data"""
    # Extract area name from filename
    area_name = os.path.basename(nii_path).replace('.nii', '').replace('.gz', '')
    print(f"Processing {area_name}")
    
    # Load the NIfTI file
    nii_img = nib.load(nii_path)
    img_data = nii_img.get_fdata()
    affine = nii_img.affine
    
    # Get voxel coordinates
    non_zero = np.where(img_data > 0)
    voxels = []
    mni_coords = []
    
    for i in range(len(non_zero[0])):
        # Store voxel coordinates
        voxels.append([
            int(non_zero[0][i]),
            int(non_zero[1][i]),
            int(non_zero[2][i])
        ])
        
        # Convert to MNI coordinates
        voxel = [non_zero[0][i], non_zero[1][i], non_zero[2][i], 1]
        mni = np.dot(affine, voxel)[:3]
        mni_coords.append([float(mni[0]), float(mni[1]), float(mni[2])])
    
    # Create voxel metadata
    voxel_data = {
        'area': area_name,
        'shape': img_data.shape,
        'voxels': voxels
    }
    
    # Save voxel data
    voxel_filename = f"{area_name}_voxels.json"
    with open(f"roi_jsons/{voxel_filename}", 'w') as f:
        json.dump(voxel_data, f)
    
    # Create MNI metadata
    mni_data = {
        'area': area_name,
        'description': f'ROI: {area_name}',
        'space': 'MNI152',
        'coordinates': mni_coords
    }
    
    # Save MNI data
    mni_filename = f"{area_name}_mni.json"
    with open(f"roi_jsons/{mni_filename}", 'w') as f:
        json.dump(mni_data, f)
    
    return {
        "name": area_name,
        "voxel_filename": voxel_filename,
        "mni_filename": mni_filename
    }

def standardize_to_mni(nii_path):
    """Standardize NIfTI file to 2mm MNI space"""
    print(f"Standardizing {os.path.basename(nii_path)}")
    
    # Load the image
    img = nib.load(nii_path)
    
    # Define target affine for 2mm MNI space
    target_affine = np.array([
        [-2., 0., 0., 90.],
        [0., 2., 0., -126.],
        [0., 0., 2., -72.],
        [0., 0., 0., 1.]
    ])
    
    # Define target shape for 2mm MNI space
    target_shape = (91, 109, 91)
    
    # Resample image to standard MNI space
    mni_img = image.resample_img(
        img,
        target_affine=target_affine,
        target_shape=target_shape,
        interpolation='nearest'  # Use nearest neighbor for ROI masks
    )
    
    return mni_img

def main():
    # First pass: standardize to MNI if needed
    if not os.path.exists('rois_mni') or not os.listdir('rois_mni'):
        print("Standardizing ROIs to MNI space...")
        nii_files = glob.glob('rois/*.nii*')
        
        if not nii_files:
            print("No .nii files found in rois folder!")
            return
        
        for nii_path in nii_files:
            try:
                mni_img = standardize_to_mni(nii_path)
                output_path = os.path.join('rois_mni', os.path.basename(nii_path))
                nib.save(mni_img, output_path)
                print(f"Saved standardized version to {output_path}")
            except Exception as e:
                print(f"Error standardizing {nii_path}: {e}")
    
    # Second pass: process standardized files to JSON
    print("\nProcessing standardized ROIs to JSON...")
    mni_files = glob.glob('rois_mni/*.nii*')
    
    if not mni_files:
        print("No standardized .nii files found!")
        return
    
    # Create index data
    roi_index = {
        "description": "Index of all ROI regions (in MNI space)",
        "total_areas": len(mni_files),
        "areas": []
    }
    
    # Process each standardized file
    for nii_path in mni_files:
        try:
            area_data = process_nii_file(nii_path)
            roi_index["areas"].append(area_data)
            print(f"Successfully processed {area_data['name']}")
        except Exception as e:
            print(f"Error processing {nii_path}: {e}")
    
    # Save index file
    with open("roi_jsons/index.json", 'w') as f:
        json.dump(roi_index, f, indent=2)
    
    print("\nProcessing complete!")
    print(f"Processed {len(roi_index['areas'])} ROI files")
    print("JSON files saved to 'roi_jsons' directory")

if __name__ == "__main__":
    main()
