import numpy as np
import matplotlib.pyplot as plt
from nilearn import datasets, plotting, image

# 1. Using a predefined atlas to identify DLPFC
def plot_dlpfc_from_atlas():
    # Load the Harvard-Oxford atlas
    atlas = datasets.fetch_atlas_harvard_oxford('cort-maxprob-thr25-2mm')
    atlas_img = atlas.maps
    atlas_labels = atlas.labels
    
    # Find the Middle Frontal Gyrus (often used as proxy for DLPFC)
    mfg_indices = [i for i, label in enumerate(atlas_labels) 
                  if 'Middle Frontal Gyrus' in str(label)]
    
    # Create a mask for the DLPFC
    mfg_mask = image.math_img(
        f"np.isin(img, {mfg_indices})", 
        img=atlas_img
    )
    
    # Plot on a standard template
    display = plotting.plot_roi(
        mfg_mask, 
        title="DLPFC (Middle Frontal Gyrus)",
        draw_cross=False
    )
    
    return display

# 2. Using specific coordinates from literature
def plot_dlpfc_from_coordinates():
    # DLPFC coordinates from literature (MNI space)
    left_dlpfc = [[-46, 20, 44], [-40, 26, 37], [-44, 36, 20]]
    right_dlpfc = [[46, 20, 44], [40, 26, 37], [44, 36, 20]]
    
    # Create spherical ROIs (10mm radius) around these coordinates
    spheres_img = plotting.cm.binarize(
        plotting.plot_markers(
            left_dlpfc + right_dlpfc, 
            np.ones(len(left_dlpfc + right_dlpfc)) * 10
        )
    )
    
    # Plot on glass brain
    display = plotting.plot_glass_brain(
        spheres_img,
        title='DLPFC Regions',
        display_mode='ortho',
        colorbar=False
    )
    
    # Also show on anatomical template
    display_anat = plotting.plot_roi(
        spheres_img,
        title='DLPFC Regions on MNI Template'
    )
    
    return display, display_anat

# 3. Using NeuroSynth meta-analysis results
def plot_dlpfc_from_neurosynth():
    # Load a term-based meta-analysis map for DLPFC
    # Note: This requires internet connection to download the map
    try:
        from nilearn.datasets import utils
        from nilearn import image
        
        # Download the map (if not already downloaded)
        dlpfc_map_file = utils._fetch_files(
            'dlpfc',
            [('https://neurosynth.org/api/images/terms/dorsolateral+prefrontal/association-test_z_FDR_0.01.nii.gz',
              'dlpfc_association.nii.gz', {})],
            verbose=1
        )[0]
        
        # Load and threshold the map
        dlpfc_map = image.load_img(dlpfc_map_file)
        dlpfc_map_thresholded = image.threshold_img(dlpfc_map, threshold=3.0)
        
        # Plot on glass brain
        display = plotting.plot_glass_brain(
            dlpfc_map_thresholded,
            title='DLPFC Meta-Analysis (NeuroSynth)',
            display_mode='ortho',
            colorbar=True,
            threshold=3.0
        )
        
        # Also show on anatomical template
        display_anat = plotting.plot_stat_map(
            dlpfc_map_thresholded,
            title='DLPFC Meta-Analysis on MNI Template',
            threshold=3.0
        )
        
        return display, display_anat
    
    except Exception as e:
        print(f"Could not download NeuroSynth map: {e}")
        print("Using alternative approach with coordinates instead")
        return plot_dlpfc_from_coordinates()

# 4. Create a custom DLPFC mask with voxel grid
def plot_dlpfc_custom_voxels():
    # Create a blank 3D image in MNI space
    template = datasets.load_mni152_template()
    shape = template.shape
    affine = template.affine
    
    # Create an empty volume
    data = np.zeros(shape)
    
    # DLPFC coordinates
    left_dlpfc_center = [-45, 30, 25]  # approximate center
    right_dlpfc_center = [45, 30, 25]  # approximate center
    
    # Convert MNI coordinates to voxel indices
    def mni_to_voxel(mni_coords, affine):
        # Invert the affine transformation
        inv_affine = np.linalg.inv(affine)
        # Add 1 for homogeneous coordinates
        mni_coords_h = np.append(mni_coords, 1)
        # Apply transformation
        voxel_coords = np.dot(inv_affine, mni_coords_h)[:3]
        # Round to nearest voxel
        return np.round(voxel_coords).astype(int)
    
    # Create spherical ROIs
    radius = 10  # in mm
    voxel_size = np.sqrt(np.sum(affine[:3, :3]**2, axis=0))[0]  # estimate voxel size
    voxel_radius = int(radius / voxel_size)
    
    # Get voxel coordinates for centers
    left_center_voxel = mni_to_voxel(left_dlpfc_center, affine)
    right_center_voxel = mni_to_voxel(right_dlpfc_center, affine)
    
    # Fill in voxels within radius
    for x in range(-voxel_radius, voxel_radius+1):
        for y in range(-voxel_radius, voxel_radius+1):
            for z in range(-voxel_radius, voxel_radius+1):
                # Check if within sphere
                if x**2 + y**2 + z**2 <= voxel_radius**2:
                    # Left DLPFC
                    lx, ly, lz = left_center_voxel + np.array([x, y, z])
                    if (0 <= lx < shape[0] and 0 <= ly < shape[1] and 0 <= lz < shape[2]):
                        data[lx, ly, lz] = 1
                    
                    # Right DLPFC
                    rx, ry, rz = right_center_voxel + np.array([x, y, z])
                    if (0 <= rx < shape[0] and 0 <= ry < shape[1] and 0 <= rz < shape[2]):
                        data[rx, ry, rz] = 1
    
    # Create a new image with this data
    dlpfc_img = image.new_img_like(template, data)
    
    # Plot on glass brain
    display = plotting.plot_glass_brain(
        dlpfc_img,
        title='DLPFC Voxels',
        display_mode='ortho',
        colorbar=False
    )
    
    # Also show on anatomical template
    display_anat = plotting.plot_roi(
        dlpfc_img,
        title='DLPFC Voxels on MNI Template'
    )
    
    return display, display_anat

# Run all visualization methods
print("Method 1: DLPFC from Harvard-Oxford Atlas (Middle Frontal Gyrus)")
display1 = plot_dlpfc_from_atlas()
plt.show()

