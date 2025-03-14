import json
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

def plot_brain_voxels_grid(json_file, alpha=0.3, edge_width=0.1):
    """
    Plot brain voxels from a JSON file as a 3D grid with the exact dimensions.
    Only voxels present in the JSON file will be filled.
    
    Parameters:
    -----------
    json_file : str
        Path to the JSON file containing voxel coordinates
    alpha : float
        Transparency of voxels (default: 0.3)
    edge_width : float
        Width of the edges (default: 0.1)
    """
    # Load the voxel data from JSON
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Extract voxel coordinates and shape
    voxels = data['voxels']
    shape = data.get('shape', None)
    
    if not shape:
        # If shape is not provided, determine it from the max coordinates
        voxels_array = np.array(voxels)
        shape = tuple(np.max(voxels_array, axis=0) + 1)
    
    print(f"Brain volume shape: {shape}")
    
    # Create an empty 3D array with the exact dimensions of the brain volume
    voxel_array = np.zeros(shape, dtype=bool)
    
    # Fill the array with the voxels from the JSON
    print("Filling voxel array...")
    for voxel in voxels:
        x, y, z = voxel
        voxel_array[x, y, z] = True
    
    print(f"Total voxels filled: {np.sum(voxel_array)}")
    
    # Create a new figure with 3D projection
    fig = plt.figure(figsize=(14, 12))
    ax = fig.add_subplot(111, projection='3d')
    
    # Create a colormap based on z-coordinate
    colors = np.zeros(voxel_array.shape + (4,))
    
    # Fill colors for each voxel
    print("Creating color map...")
    for voxel in voxels:
        x, y, z = voxel
        # Normalize z to the range [0, 1]
        z_norm = z / shape[2]
        # Create a gradient color based on z position
        colors[x, y, z, 0] = z_norm  # Red increases with z
        colors[x, y, z, 1] = 0.5  # Fixed green
        colors[x, y, z, 2] = 1.0 - z_norm  # Blue decreases with z
        colors[x, y, z, 3] = alpha  # Alpha (transparency)
    
    # Plot the voxels
    print("Plotting voxels (this may take a while)...")
    ax.voxels(voxel_array, facecolors=colors, edgecolor='k', linewidth=edge_width)
    
    # Set labels
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    
    # Set title
    ax.set_title(f'3D Brain Voxel Visualization\n({np.sum(voxel_array)} voxels shown)')
    
    # Add information about the data
    plt.figtext(0.02, 0.02, f'Brain volume dimensions: {shape}\nTotal voxels: {len(voxels)}', fontsize=10)
    
    # Enable interactive rotation
    plt.tight_layout()
    plt.show()
    
    return fig, ax

# For larger datasets, we might need to downsample to make visualization feasible
def plot_brain_voxels_downsampled(json_file, downsample_factor=2, alpha=0.3, edge_width=0.1):
    """
    Plot brain voxels from a JSON file as a 3D grid with downsampled dimensions.
    
    Parameters:
    -----------
    json_file : str
        Path to the JSON file containing voxel coordinates
    downsample_factor : int
        Factor by which to downsample the volume (default: 2)
    alpha : float
        Transparency of voxels (default: 0.3)
    edge_width : float
        Width of the edges (default: 0.1)
    """
    # Load the voxel data from JSON
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Extract voxel coordinates and shape
    voxels = data['voxels']
    original_shape = data.get('shape', None)
    
    if not original_shape:
        # If shape is not provided, determine it from the max coordinates
        voxels_array = np.array(voxels)
        original_shape = tuple(np.max(voxels_array, axis=0) + 1)
    
    # Calculate the downsampled shape
    downsampled_shape = tuple(dim // downsample_factor for dim in original_shape)
    print(f"Original shape: {original_shape}")
    print(f"Downsampled shape: {downsampled_shape}")
    
    # Create an empty 3D array with the downsampled dimensions
    voxel_array = np.zeros(downsampled_shape, dtype=bool)
    
    # Downsample the voxels
    print("Downsampling voxels...")
    for voxel in voxels:
        x, y, z = voxel
        # Convert to downsampled coordinates
        x_down = x // downsample_factor
        y_down = y // downsample_factor
        z_down = z // downsample_factor
        
        # Make sure we're within bounds
        if (x_down < downsampled_shape[0] and 
            y_down < downsampled_shape[1] and 
            z_down < downsampled_shape[2]):
            voxel_array[x_down, y_down, z_down] = True
    
    print(f"Total downsampled voxels: {np.sum(voxel_array)}")
    
    # Create a new figure with 3D projection
    fig = plt.figure(figsize=(14, 12))
    ax = fig.add_subplot(111, projection='3d')
    
    # Create a colormap based on z-coordinate
    colors = np.zeros(voxel_array.shape + (4,))
    
    # Fill colors for each voxel
    print("Creating color map...")
    for x in range(downsampled_shape[0]):
        for y in range(downsampled_shape[1]):
            for z in range(downsampled_shape[2]):
                if voxel_array[x, y, z]:
                    # Normalize z to the range [0, 1]
                    z_norm = z / downsampled_shape[2]
                    # Create a gradient color based on z position
                    colors[x, y, z, 0] = z_norm  # Red increases with z
                    colors[x, y, z, 1] = 0.5  # Fixed green
                    colors[x, y, z, 2] = 1.0 - z_norm  # Blue decreases with z
                    colors[x, y, z, 3] = alpha  # Alpha (transparency)
    
    # Plot the voxels
    print("Plotting voxels...")
    ax.voxels(voxel_array, facecolors=colors, edgecolor='k', linewidth=edge_width)
    
    # Set labels
    ax.set_xlabel('X')
    ax.set_ylabel('Y')
    ax.set_zlabel('Z')
    
    # Set title
    ax.set_title(f'3D Brain Voxel Visualization (Downsampled {downsample_factor}x)\n({np.sum(voxel_array)} voxels shown)')
    
    # Add information about the data
    plt.figtext(0.02, 0.02, 
                f'Original dimensions: {original_shape}\n'
                f'Downsampled dimensions: {downsampled_shape}\n'
                f'Downsample factor: {downsample_factor}x\n'
                f'Original voxels: {len(voxels)}\n'
                f'Displayed voxels: {np.sum(voxel_array)}', 
                fontsize=10)
    
    # Enable interactive rotation
    plt.tight_layout()
    plt.show()
    
    return fig, ax

# Example usage
if __name__ == "__main__":
    # Choose which method to use based on the size of your data
    use_downsampling = True  # Set to False to use full resolution (may be very slow)
    
    # Plot voxel coordinates (adjust the filename as needed)
    try:
        if use_downsampling:
            # For large brain volumes, downsampling is recommended
            downsample_factor = 4  # Adjust as needed
            fig, ax = plot_brain_voxels_downsampled('whole_brain_atlas_voxels.json', 
                                                   downsample_factor=downsample_factor)
        else:
            # For full resolution (warning: may be very slow and memory-intensive)
            fig, ax = plot_brain_voxels_grid('whole_brain_atlas_voxels.json')
    except FileNotFoundError:
        print("Voxel file not found. Make sure to run the extraction script first.")
