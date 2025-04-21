import React, { useMemo } from 'react';
import * as THREE from 'three';

// Helper function to convert lat/long to 3D coordinates
const latLongToVector3 = (lat: number, long: number, radius: number): THREE.Vector3 => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (long + 180) * (Math.PI / 180);
  
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  
  return new THREE.Vector3(x, y, z);
};

interface GridLinesProps {
  radius: number;
  showEquator?: boolean;
  showDirectionMarkers?: boolean;
}

/**
 * Creates a grid of latitude and longitude lines on the sphere
 * Optionally shows a highlighted equator line
 */
const GridLines: React.FC<GridLinesProps> = ({ 
  radius, 
  showEquator = true,
  showDirectionMarkers = true 
}) => {
  // Create the geometry only once with useMemo
  const gridGeometry = useMemo(() => {
    const latitudeLines = [];
    const longitudeLines = [];
    
    // Create latitude lines (parallels)
    for (let lat = -75; lat <= 75; lat += 25) {
      const points = [];
      for (let long = -180; long <= 180; long += 10) {
        points.push(latLongToVector3(lat, long, radius));
      }
      latitudeLines.push(points);
    }
    
    // Create longitude lines (meridians)
    for (let long = -180; long < 180; long += 30) {
      const points = [];
      for (let lat = -90; lat <= 90; lat += 10) {
        points.push(latLongToVector3(lat, long, radius));
      }
      longitudeLines.push(points);
    }
    
    // Create equator points
    const equatorPoints = Array.from({ length: 37 }, (_, i) => {
      const long = -180 + i * 10;
      return latLongToVector3(0, long, radius);
    });
    
    // Create direction marker positions
    const cardinalPoints = {
      north: latLongToVector3(90, 0, radius * 1.1), // North
      south: latLongToVector3(-90, 0, radius * 1.1), // South
      east: latLongToVector3(0, 90, radius * 1.1), // East
      west: latLongToVector3(0, -90, radius * 1.1) // West
    };
    
    return { latitudeLines, longitudeLines, equatorPoints, cardinalPoints };
  }, [radius]);
  
  return (
    <group>
      {/* Latitude Lines */}
      {gridGeometry.latitudeLines.map((points, i) => (
        <line key={`lat-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
              args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </line>
      ))}
      
      {/* Longitude Lines */}
      {gridGeometry.longitudeLines.map((points, i) => (
        <line key={`long-${i}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={points.length}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
              args={[new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.3} />
        </line>
      ))}
      
      {/* Equator with higher opacity */}
      {showEquator && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={gridGeometry.equatorPoints.length}
              array={new Float32Array(gridGeometry.equatorPoints.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
              args={[new Float32Array(gridGeometry.equatorPoints.flatMap(p => [p.x, p.y, p.z])), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#ffff00" transparent opacity={0.7} />
        </line>
      )}
    </group>
  );
};

export default React.memo(GridLines); 