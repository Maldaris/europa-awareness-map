import React, { useRef, useMemo, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { vectorToLatLong, latLongToVector3 } from '../../utils';

// Export the interface so it can be imported elsewhere
export interface PoleMarkerProps {
  position?: THREE.Vector3;
  directionVector?: THREE.Vector3; // Add normalized direction vector as alternative positioning
  label: string | {
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
const MIN_MARKER_SIZE = 0.15;  // Min height of cylinder
const MAX_MARKER_SIZE = 0.25;  // Max height of cylinder
const MIN_CAMERA_DISTANCE = 1.5;  // When zoomed in close
const MAX_CAMERA_DISTANCE = 4;    // When zoomed out far

/**
 * Marker for the poles (North & South) on the sphere
 * Features a cyan cylinder with an HTML label that shows on hover
 * Scales based on camera distance
 * Can be positioned using either:
 * 1. A normalized direction vector (preferred)
 * 2. A position Vector3
 * 3. lat/long coordinates
 */
const PoleMarker: React.FC<PoleMarkerProps> = ({ 
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
    console.error("PoleMarker: No valid positioning method provided");
    return new THREE.Vector3(0, 0, 0);
  }, [directionVector, position, lat, long, radius]);
  
  // Reference for the marker object
  const markerRef = useRef<THREE.Mesh>(null);
  
  // Access camera for scaling calculation
  const { camera } = useThree();
  
  // State to track hover state
  const [hovered, setHovered] = useState(false);
  
  // State for marker height
  const [markerHeight, setMarkerHeight] = useState(0.2);
  
  // State to track cursor position for optimal label placement
  const [cursorPosition, setCursorPosition] = useState<{ x: number, y: number } | null>(null);
  
  // Update scale based on camera distance on each frame
  useFrame(() => {
    if (!markerRef.current) return;
    
    if (scale !== undefined) {
      // Use the provided scale prop
      setMarkerHeight(scale);
      return;
    }
    
    // Calculate distance between camera and marker position
    const distanceToCamera = camera.position.distanceTo(actualPosition);
    
    // Calculate scale factor based on distance (direct relationship)
    // Clamp between min and max camera distances
    const clampedDistance = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distanceToCamera));
    
    // Map distance to scale (closer = smaller, further = larger)
    const normalizedDistance = (clampedDistance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE);
    const height = MIN_MARKER_SIZE + normalizedDistance * (MAX_MARKER_SIZE - MIN_MARKER_SIZE);
    
    // Update the marker height state (used by the geometry)
    setMarkerHeight(height);
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
    
  // Format the label with coordinates if requested
  const displayLabel = useMemo(() => {
    const title = typeof label === 'string' ? label : label.title;
    const description = typeof label === 'object' ? label.description : null;
    const location = typeof label === 'object' ? label.location : null;
    
    let display = title;
    
    if (showCoordinates && !location) {
      display += ` (${coords.lat.toFixed(1)}°, ${coords.long.toFixed(1)}°)`;
    }
    
    return (
      <div>
        <div style={{ fontWeight: 'bold' }}>{display}</div>
        {description && <div style={{ fontSize: '10px', opacity: 0.8 }}>{description}</div>}
        {location && <div style={{ fontSize: '10px', opacity: 0.8 }}>{location}</div>}
      </div>
    );
  }, [label, showCoordinates, coords]);
  
  // Event handlers for hover
  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    // Store cursor position for label placement
    setCursorPosition({ x: e.clientX, y: e.clientY });
  };
  
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
    setCursorPosition(null);
  };
  
  // Adjust position when cursor moves while hovering
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (hovered) {
      setCursorPosition({ x: e.clientX, y: e.clientY });
    }
  };
  
  return (
    <group position={actualPosition}>
      {/* The pole cylinder */}
      <mesh 
        ref={markerRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerMove={handlePointerMove}
      >
        <cylinderGeometry args={[0.02, 0.02, markerHeight, 8]} />
        <meshStandardMaterial 
          color={hovered ? "#60f0ff" : "cyan"} 
          emissive={hovered ? "#60f0ff" : "#20e0ff"} 
          emissiveIntensity={hovered ? 0.8 : 0.5} 
        />
      </mesh>
      
      {/* HTML-based label that shows on hover */}
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
            color: 'cyan',
            whiteSpace: 'nowrap',
            fontSize: '12px',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 10
          }}
        >
          {displayLabel}
        </Html>
      )}
    </group>
  );
};

export default React.memo(PoleMarker); 