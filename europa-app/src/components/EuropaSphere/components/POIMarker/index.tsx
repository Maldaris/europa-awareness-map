import React, { useRef, useMemo, useState } from 'react';
import { Billboard, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { vectorToLatLong, latLongToVector3 } from '../../utils';

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
}

// Constants for marker scaling - keeping these for fallback
const MIN_MARKER_SIZE = 0.005;
const MAX_MARKER_SIZE = 0.04;
const MIN_CAMERA_DISTANCE = 1.5;
const MAX_CAMERA_DISTANCE = 4;

/**
 * Marker for Points of Interest on the sphere
 * Features a red dot with an HTML label that shows on hover
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
  radius = 1 // Default radius is 1
}) => {
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
  
  // Reference for the marker object
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
  
  return (
    <group position={actualPosition}>
      {/* The sphere marker */}
      <Billboard>
        <mesh 
          ref={markerRef}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onPointerMove={handlePointerMove}
        >
          <sphereGeometry args={[markerScale, 12, 12]} />
          <meshStandardMaterial 
            color={hovered ? "#ff4040" : "red"} 
            emissive={hovered ? "#ff6060" : "#ff2020"} 
            emissiveIntensity={hovered ? 0.8 : 0.5} 
          />
        </mesh>
      </Billboard>
      
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
            <p>{label.description}</p>
            {label.location ? <p>Location: {label.location}</p> : <p>Coordinates: {coords.lat}°, {coords.long}°</p>}
          </div>
        </Html>
      )}
    </group>
  );
};

export default React.memo(POIMarker); 