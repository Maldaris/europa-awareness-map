import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

interface JupiterProps {
  radius: number;
  position: [number, number, number];
}

/**
 * Jupiter component
 * Renders a large Jupiter sphere with proper texture in the background
 */
const Jupiter: React.FC<JupiterProps> = ({ radius, position }) => {
  // Reference to the mesh for animations
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Use drei's useTexture hook with useMemo to prevent reloading
  const texture = useMemo(() => {
    // Only log once during development
    console.log('Jupiter texture loading');
    
    const tex = new THREE.TextureLoader().load('/textures/2k_jupiter.jpg', (loadedTexture) => {
      // Configure texture when loaded
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.wrapS = THREE.RepeatWrapping;
      loadedTexture.wrapT = THREE.RepeatWrapping;
    });
    
    return tex;
  }, []); // Empty dependency array ensures this runs only once
  
  // Rotate Jupiter very slowly
  useFrame((_, delta) => {
    if (meshRef.current) {
      // Jupiter rotates much faster than Earth or Europa
      // A full rotation takes about 10 hours
      // Using a slow rotation rate for visual effect
      meshRef.current.rotation.y += 0.005 * delta;
    }
  });
  
  return (
    <mesh ref={meshRef} position={position}>
      <Sphere args={[radius, 64, 64]}>
        <meshStandardMaterial 
          map={texture} 
          metalness={0.1}
          roughness={0.7}
          emissive="#331100"
          emissiveIntensity={0.05}
        />
      </Sphere>
    </mesh>
  );
};

export default React.memo(Jupiter); // Memoize to prevent unnecessary re-renders 