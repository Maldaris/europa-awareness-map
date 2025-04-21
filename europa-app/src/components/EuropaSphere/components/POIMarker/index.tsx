import React, { useRef, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { vectorToLatLong, latLongToVector3 } from '../../utils';
import { MarkerCategory } from '../../../../types';

// Export the interface so it can be imported elsewhere
export interface POIMarkerProps {
  position?: THREE.Vector3;
  directionVector?: THREE.Vector3; // Add normalized direction vector as alternative positioning
  label: {
    title: string;
    description?: string;
    location?: string;
  };
  sphereRef: React.RefObject<THREE.Mesh> | any; // Make more flexible
  showCoordinates?: boolean;
  lat?: number;
  long?: number;
  scale?: number; // Add scale prop
  radius?: number; // Optional radius for the sphere
  color?: string; // Color for the marker
  ringColor?: string; // Color for the ring
  ringOpacity?: number; // Opacity for the ring
  category?: string; // Category for shape selection
  markerShape?: 'cube' | 'sphere' | 'cone' | 'cylinder' | 'tetrahedron' | 'octahedron' | 'dodecahedron' | 'icosahedron'; // Shape for center marker
}

// Constants for marker scaling - keeping these for fallback
const MIN_MARKER_SIZE = 0.01;
const MAX_MARKER_SIZE = 0.04;
const MIN_CAMERA_DISTANCE = 1.5;
const MAX_CAMERA_DISTANCE = 4;

// Create a custom right angle prism geometry
const createRightAnglePrism = (size: number) => {
  const geometry = new THREE.BufferGeometry();
  
  // Define the vertices for a right angle prism (triangular prism with one 90° angle)
  // The right angle will be at the origin (0,0,0) to point at the center of the POI
  const vertices = new Float32Array([
    // Front face (triangular)
    0, 0, 0,      // right angle vertex
    size, 0, 0,   // base right vertex
    0, size, 0,   // base top vertex
    
    // Back face (triangular)
    0, 0, size,    // right angle vertex
    size, 0, size, // base right vertex
    0, size, size, // base top vertex
    
    // Rectangle face 1 (bottom)
    0, 0, 0,
    size, 0, 0,
    size, 0, size,
    0, 0, size,
    
    // Rectangle face 2 (hypotenuse)
    size, 0, 0,
    size, 0, size,
    0, size, size,
    0, size, 0,
    
    // Rectangle face 3 (side)
    0, 0, 0,
    0, 0, size,
    0, size, size,
    0, size, 0
  ]);
  
  // Define indices to create the faces
  const indices = [
    // Front triangular face
    0, 1, 2,
    
    // Back triangular face
    3, 5, 4,
    
    // Three rectangular faces
    6, 7, 8, 6, 8, 9,     // Bottom face
    10, 11, 12, 10, 12, 13, // Hypotenuse face
    14, 15, 16, 14, 16, 17  // Side face
  ];
  
  // Set the attributes
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  
  // Compute normals for correct lighting
  geometry.computeVertexNormals();
  
  return geometry;
};

// Function to determine marker shape based on category
const getMarkerGeometry = (shape: string, size: number): THREE.BufferGeometry => {
  switch (shape) {
    case 'cube':
      return new THREE.BoxGeometry(size, size, size);
    case 'sphere':
      return new THREE.SphereGeometry(size * 0.5, 16, 16);
    case 'cone':
      return new THREE.ConeGeometry(size * 0.5, size, 16);
    case 'cylinder':
      return new THREE.CylinderGeometry(size * 0.4, size * 0.4, size * 0.8, 16);
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(size * 0.6);
    case 'octahedron':
      return new THREE.OctahedronGeometry(size * 0.6);
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(size * 0.6);
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(size * 0.6);
    default:
      // Default to prism
      return createRightAnglePrism(size * 0.8);
  }
};

// Map category to default shape if not explicitly specified
const getCategoryShape = (category?: string): string => {
  // Always return octahedron regardless of category
  return 'octahedron';
};

// Map category to color if no color is provided
const getCategoryColor = (category?: string): string => {
  if (!category) return "#ff3333"; // Default red
  
  const colorMap: Record<string, string> = {
    [MarkerCategory.TERRAIN]: "#7cba00", // Green
    [MarkerCategory.IMPACT]: "#f05f22", // Orange
    [MarkerCategory.LANDMARK]: "#00a2ff", // Blue
    [MarkerCategory.NAVIGATION]: "#ffd700", // Gold
    [MarkerCategory.ORIENTATION]: "#e066ff", // Purple
    [MarkerCategory.CUSTOM]: "#ff3333", // Red
    [MarkerCategory.USER]: "#ff3333"  // Red
  };
  
  return colorMap[category] || "#ff3333"; // Default to red if category not in map
};

/**
 * Marker for Points of Interest on the sphere
 * Features a torus ring with a customizable marker shape pointing toward the center
 * Scales based on camera distance
 * Can be positioned using either:
 * 1. A normalized direction vector (preferred)
 * 2. A position Vector3
 * 3. lat/long coordinates
 */
const POIMarker: React.FC<POIMarkerProps> = ({ 
  position, 
  directionVector,
  label, 
  sphereRef,
  showCoordinates = true,
  lat,
  long,
  scale, // Add scale prop
  radius = 1, // Default radius is 1
  color, // Remove default value
  ringColor, // Remove default value
  ringOpacity = 0.6, // Default ring opacity is 60%
  category,
  markerShape
}) => {
  // Determine actual color to use based on category if no color provided
  const actualColor = useMemo(() => {
    return color || getCategoryColor(category);
  }, [color, category]);
  
  // Determine actual ring color (default to same as marker color if not provided)
  const actualRingColor = useMemo(() => {
    return ringColor || actualColor;
  }, [ringColor, actualColor]);
  
  // Calculate the actual position based on available inputs
  const actualPosition = useMemo(() => {
    // Priority 1: Use normalized direction vector if provided
    if (directionVector) {
      // Ensure the vector is normalized
      const normalizedDir = directionVector.clone().normalize();
      // Scale by radius to get the position on the sphere's surface
      return normalizedDir.multiplyScalar(radius);
    }
    
    // Priority 2: Use provided position directly
    if (position) {
      return position;
    }
    
    // Priority 3: Calculate from lat/long if provided
    if (lat !== undefined && long !== undefined) {
      return latLongToVector3(lat, long, radius);
    }
    
    // Fallback - should never happen due to prop validation
    console.error("POIMarker: No valid positioning method provided");
    return new THREE.Vector3(0, 0, 0);
  }, [directionVector, position, lat, long, radius]);
  
  // Create a normalized direction vector for rotation (pointing from center to marker)
  const normalizedDirection = useMemo(() => {
    return actualPosition.clone().normalize();
  }, [actualPosition]);
  
  // Calculate the rotation quaternion to orient the prism toward the center
  const markerRotation = useMemo(() => {
    // Create a quaternion that rotates from the default orientation to point toward the center
    const quaternion = new THREE.Quaternion();
    
    // The default "up" direction
    const up = new THREE.Vector3(0, 1, 0);
    
    // Calculate the direction to the center (reverse of normalizedDirection)
    const toCenter = normalizedDirection.clone().negate();
    
    // Create a rotation that aligns the up vector with our direction
    quaternion.setFromUnitVectors(up, toCenter);
    
    return quaternion;
  }, [normalizedDirection]);
  
  // Calculate rotation quaternion for torus to align with sphere surface
  const torusRotation = useMemo(() => {
    const quaternion = new THREE.Quaternion();
    
    // Torus normal is along Z axis by default
    const torusNormal = new THREE.Vector3(0, 0, 1);
    
    // We want to align the torus normal with the sphere's normal at this point
    quaternion.setFromUnitVectors(torusNormal, normalizedDirection);
    
    return quaternion;
  }, [normalizedDirection]);
  
  // Determine actual shape to use
  const actualShape = useMemo(() => {
    return markerShape || getCategoryShape(category);
  }, [markerShape, category]);
  
  // Reference for the marker objects
  const markerGroupRef = useRef<THREE.Group>(null);
  const torusRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  
  // Access camera for scaling calculation (only used if scale prop not provided)
  const { camera } = useThree();
  
  // State to track hover state
  const [hovered, setHovered] = useState(false);
  
  // State for marker scale
  const [markerScale, setMarkerScale] = useState(MAX_MARKER_SIZE);
  
  // State to track cursor position for optimal label placement
  const [cursorPosition, setCursorPosition] = useState<{ x: number, y: number } | null>(null);
  
  // Update scale based on camera distance on each frame, but only if scale prop not provided
  useFrame(() => {
    if (scale !== undefined) {
      // Use the provided scale prop
      setMarkerScale(scale);
      return;
    }
    
    // Calculate distance between camera and marker position (fallback)
    const distanceToCamera = camera.position.distanceTo(actualPosition);
    
    // Calculate scale factor based on distance (direct relationship)
    // Clamp between min and max camera distances
    const clampedDistance = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distanceToCamera));
    
    // Map distance to scale (closer = smaller, further = larger)
    const normalizedDistance = (clampedDistance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE);
    const size = MIN_MARKER_SIZE + normalizedDistance * (MAX_MARKER_SIZE - MIN_MARKER_SIZE);
    
    // Update the marker scale state (used by the geometry)
    setMarkerScale(size);
  });
  
  // Make the marker pulse when hovered
  useFrame(({ clock }) => {
    if (hovered) {
      if (torusRef.current) {
        // Make the torus pulse by scaling it slightly
        const pulseFactor = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.1;
        torusRef.current.scale.set(pulseFactor, pulseFactor, pulseFactor);
      }
      
      if (markerRef.current) {
        // Also make the marker shape pulse with a slight offset
        const pulseFactor = (scale || MIN_MARKER_SIZE) + Math.min(MAX_MARKER_SIZE - MIN_MARKER_SIZE, Math.sin(clock.getElapsedTime() * 5) * 0.08);
        markerRef.current.scale.set(pulseFactor, pulseFactor, pulseFactor);
      }
    } else {
      // Spin the marker when not hovered
      if (markerRef.current) {
        // Rotate around the marker's axis (which points toward the center)
        // This rotation is relative to the marker's local space
        markerRef.current.rotation.z += 0.01;
      }
   }
  });
  
  // Calculate coordinates from direction vector or position if not provided
  const coords = useMemo(() => {
    if (lat !== undefined && long !== undefined) {
      return { lat, long };
    }
    
    // If we have a direction vector, use it directly for more accurate coordinates
    if (directionVector) {
      return vectorToLatLong(directionVector, 1); // Using radius=1 since it's normalized
    }
    
    // Fallback to position
    return vectorToLatLong(actualPosition, radius);
  }, [directionVector, actualPosition, lat, long, radius]);
  
  // Event handlers for hover with cursor position capture
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    
    // Set initial cursor position
    setCursorPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
    setCursorPosition(null);
  };
  
  // Update cursor position for label placement
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (hovered) {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    }
  };
  
  // Actual marker size calculations
  const sizes = useMemo(() => {
    const baseSize = markerScale * 3; // Base size for all elements
    return {
      torus: {
        radius: baseSize * 0.6,
        tube: baseSize * 0.1
      },
      marker: baseSize * 0.4
    };
  }, [markerScale]);
  
  return (
    <group 
      position={actualPosition} 
      ref={markerGroupRef}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onPointerMove={handlePointerMove}
    >
      {/* Torus ring around the marker */}
      <mesh 
        ref={torusRef}
        quaternion={torusRotation}
      >
        <torusGeometry args={[sizes.torus.radius, sizes.torus.tube, 16, 32]} />
        <meshStandardMaterial 
          color={actualRingColor} 
          transparent={true} 
          opacity={0.5}
          emissive={actualRingColor}
          emissiveIntensity={hovered ? 6 : 4}
        />
      </mesh>
      
      {/* Customizable marker shape */}
      <mesh 
        ref={markerRef}
        quaternion={markerRotation}
        scale={[sizes.marker, sizes.marker, sizes.marker]}
        position={normalizedDirection.clone().multiplyScalar(markerScale * 0.5)} // Offset slightly from surface
      >
        <primitive attach="geometry" object={getMarkerGeometry(actualShape, 1)} />
        <meshStandardMaterial 
          color={actualColor} 
          emissive={actualColor}
          emissiveIntensity={hovered ? 0.2 : 0.05}
          metalness={0.1}
          roughness={0.4}
          flatShading={false}
        />
      </mesh>
      
      {/* HTML-based label that always stays above cursor */}
      {hovered && cursorPosition && (
        <Html
          className="marker-label"
          prepend
          style={{
            position: 'absolute',
            transform: 'translate(-50%, -120%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: '6px 10px',
            borderRadius: '4px',
            color: 'white',
            whiteSpace: 'nowrap',
            fontSize: '12px',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 10
          }}
        >
          <div>
            <h3>{label.title}</h3>
            {label.description && <p>{label.description}</p>}
            {category && <p>Type: {category}</p>}
            {label.location ? <p>Location: {label.location}</p> : <p>Coordinates: {coords.lat.toFixed(1)}°, {coords.long.toFixed(1)}°</p>}
          </div>
        </Html>
      )}
    </group>
  );
};

export default React.memo(POIMarker); 