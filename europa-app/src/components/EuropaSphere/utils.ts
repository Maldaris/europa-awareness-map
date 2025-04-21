import * as THREE from 'three';

/**
 * Convert latitude and longitude to 3D Vector3 coordinates
 * 
 * @param lat Latitude in degrees (-90 to 90)
 * @param long Longitude in degrees (-180 to 180)
 * @param radius Sphere radius
 * @returns THREE.Vector3 position
 */
export const latLongToVector3 = (lat: number, long: number, radius: number): THREE.Vector3 => {
  /*
   * COORDINATE CONVERSION: SPHERICAL (LAT/LONG) TO CARTESIAN (X,Y,Z)
   * 
   * Geographic Convention:
   * - Latitude: -90° (South Pole) to 90° (North Pole)
   * - Longitude: -180° to 180° (0° at Prime Meridian, positive east, negative west)
   * 
   * THREE.js Convention:
   * - Y-axis points up (North)
   * - X-axis points right (East at 0° longitude)
   * - Z-axis points out of screen (would be at 90° East longitude)
   * 
   * Steps:
   * 1. Convert lat/long from degrees to radians
   * 2. Use standard spherical to Cartesian formulas:
   *    x = r * cos(lat) * cos(long)
   *    y = r * sin(lat)
   *    z = r * cos(lat) * sin(long)
   * 
   * This creates a coordinate system where:
   * - (0,0,0) is at the center of the sphere
   * - (0,0) lat/long maps to (r,0,0) in Cartesian (on the equator at prime meridian)
   * - (90,0) lat/long maps to (0,r,0) in Cartesian (North Pole)
   * - (-90,0) lat/long maps to (0,-r,0) in Cartesian (South Pole)
   * - (0,90) lat/long maps to (0,0,r) in Cartesian (equator, 90° East)
   */
  
  // Convert degrees to radians
  const latRad = (lat * Math.PI) / 180;
  const longRad = (long * Math.PI) / 180;
  
  // Apply spherical to Cartesian formulas
  const x = radius * Math.cos(latRad) * Math.cos(longRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.sin(longRad);
  
  return new THREE.Vector3(x, y, z);
};

/**
 * Convert a Vector3 position back to latitude and longitude
 * 
 * @param position Vector3 position
 * @param radius Sphere radius (not actually used since we normalize, but kept for API consistency)
 * @returns Object containing lat and long in degrees
 */
export const vectorToLatLong = (position: THREE.Vector3, radius: number): { lat: number, long: number } => {
  /*
   * COORDINATE CONVERSION: CARTESIAN (X,Y,Z) TO SPHERICAL (LAT/LONG)
   * 
   * This is the inverse of the latLongToVector3 conversion
   * 
   * Steps:
   * 1. Normalize the position vector to get a unit vector (length 1)
   * 2. Calculate latitude:
   *    - lat = asin(y)
   *    - Result will be in radians, from -π/2 to π/2
   * 
   * 3. Calculate longitude:
   *    - long = atan2(z, x)
   *    - atan2 handles quadrant determination automatically
   *    - Result will be in radians, from -π to π
   * 
   * 4. Convert radians to degrees
   * 5. Ensure longitude is within -180° to 180° range
   * 
   * Special cases:
   * - At poles (y = ±1), longitude becomes indeterminate
   * - Exact center (0,0,0) is invalid as it's not on the sphere
   */
  
  // Check if position is valid
  if (!position || position.length() === 0) {
    console.error("Cannot convert zero vector or invalid position to lat/long");
    return { lat: 0, long: 0 };
  }
  
  // Use direct calculations with high precision
  // Get a clean copy of the position to avoid modifying the original
  const positionCopy = position.clone();
  
  // Compute the distance from the origin to normalize
  const norm = positionCopy.length();
  
  // Handle coordinates with direct calculations to avoid precision errors
  // These calculations must be performed in the correct order to maintain precision
  const normalizedX = positionCopy.x / norm;
  const normalizedY = positionCopy.y / norm;
  const normalizedZ = positionCopy.z / norm;
  
  // Calculate latitude from normalized Y coordinate (no rounding)
  const latRad = Math.asin(Math.max(-1, Math.min(1, normalizedY)));
  
  // Calculate longitude using high-precision atan2
  // Use direct Math.atan2 without any intermediate steps to prevent quantization
  const longRad = Math.atan2(normalizedZ, normalizedX);
  
  // Convert to degrees with full precision
  const lat = latRad * (180 / Math.PI);
  let long = longRad * (180 / Math.PI);
  
  // Ensure longitude is within the standard -180 to 180 range
  if (long < -180) long += 360;
  if (long > 180) long -= 360;
  
  // Handle the special case of poles where longitude can be unstable
  // At poles, we force longitude to 0 as it's mathematically indeterminate
  if (Math.abs(Math.abs(lat) - 90) < 1e-10) {
    long = 0;
  }
  

  
  return { lat, long };
};

/**
 * Create a debug sphere at a specific lat/long for visual verification
 */
export const createDebugSphere = (lat: number, long: number, radius: number, name: string): THREE.Mesh => {
  /*
   * Creates a small visual sphere marker at the specified lat/long position.
   * Steps:
   * 1. Convert lat/long to Vector3 position using latLongToVector3
   * 2. Create a small sphere geometry
   * 3. Apply a bright, easily visible material
   * 4. Position the sphere at the calculated coordinates
   * 5. Name the sphere for easy identification in debugging
   */
  
  const position = latLongToVector3(lat, long, radius);
  const geometry = new THREE.SphereGeometry(0.02, 12, 12);
  const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.copy(position);
  sphere.name = `debug-${name}-${lat}-${long}`;
  
  return sphere;
};

export interface Marker {
  id: string;
  position: THREE.Vector3;
  directionVector?: THREE.Vector3;
  title: string;
  description: string;
  lat: number;
  long: number;
}