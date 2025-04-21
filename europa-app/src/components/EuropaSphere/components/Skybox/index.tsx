import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Skybox component
 * Creates a large sphere around the scene using the Milky Way texture
 */
const Skybox: React.FC = () => {
  // Use useMemo to prevent texture reloading on re-renders
  const texture = useMemo(() => {
    // Only log once during development
    console.log('Skybox texture loading');
    
    const tex = new THREE.TextureLoader().load('/textures/2k_stars_milky_way.jpg', (loadedTexture) => {
      // Configure texture when loaded
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      
      // Important: texture needs to be flipped for interior mapping
      loadedTexture.mapping = THREE.EquirectangularReflectionMapping;
      
      // Since we're viewing from inside, we need to flip the texture
      loadedTexture.flipY = false;
    });
    
    return tex;
  }, []); // Empty dependency array ensures this runs only once
  
  // Create a large sphere with inverted normals
  const skyboxRadius = 1000; // Very large radius to encompass the entire scene
  
  return (
    <mesh>
      <sphereGeometry args={[skyboxRadius, 64, 64]} />
      <meshBasicMaterial 
        map={texture} 
        side={THREE.BackSide} // Important: render the inside of the sphere
      />
    </mesh>
  );
};

export default React.memo(Skybox); // Memoize to prevent unnecessary re-renders 