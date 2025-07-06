import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';
import { useEffect, useMemo, useRef } from 'react';
import { POI } from '../../../types';

// Create a shader material for the Voronoi diagram
// Note: Shader linter will complain about 'position' being undeclared, but it's provided by Three.js
const VoronoiShaderMaterial = shaderMaterial(
  {
    // Define uniforms according to Three.js and drei docs
    poiPositions: { value: new Float32Array(64 * 3) },
    poiColors: { value: new Float32Array(64 * 3) },
    numPOIs: 0,
    baseTexture: null,
    opacity: 0.5,
    showVoronoi: true,
    debugMode: false,                    // Toggle debug visualization
    gridDensity: 10.0,                   // Number of grid lines (for debugging)
    borderWidth: 0.0025                  // Width of voronoi borders (0.0025 = thin lines)
  },
  // Vertex shader
  /* glsl */`
    varying vec3 vPosition;
    varying vec2 vUv;
    
    void main() {
      vPosition = position; // 'position' is provided by Three.js, ignore linter error
      vUv = uv; // 'uv' is also provided by Three.js
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  /* glsl */`
    precision highp float;
    uniform sampler2D baseTexture;
    uniform vec3 poiPositions[64]; // Max number of POIs we can handle
    uniform vec3 poiColors[64];
    uniform int numPOIs;
    uniform float opacity;
    uniform bool showVoronoi;
    uniform bool debugMode;
    uniform float gridDensity;
    uniform float borderWidth;
    
    varying vec3 vPosition;
    varying vec2 vUv;
    
    // Convert from 3D position on the sphere to lat/long
    vec2 sphereToLatLong(vec3 position) {
      vec3 normalized = normalize(position);
      
      // Calculate latitude (phi) and longitude (theta)
      float lat = acos(normalized.y) * (180.0 / 3.14159265) - 90.0; // -90 to 90
      float lng = atan(normalized.z, normalized.x) * (180.0 / 3.14159265); // -180 to 180
      
      return vec2(lat, lng);
    }
    
    // Draw grid lines based on lat/long
    vec4 drawLatLongGrid(vec2 latLong, vec4 color, float gridSize) {
      float latLine = abs(sin(latLong.x * 3.14159265 / 180.0 * gridSize));
      float lngLine = abs(sin(latLong.y * 3.14159265 / 180.0 * gridSize));
      
      // Major lines at 0, 90, 180, 270, etc.
      bool isMajorLat = abs(mod(latLong.x + 90.0, 90.0)) < 1.0;
      bool isMajorLng = abs(mod(latLong.y + 180.0, 90.0)) < 1.0;
      
      if (isMajorLat || isMajorLng) {
        return vec4(1.0, 1.0, 1.0, 1.0); // White for major lines
      }
      
      if (latLine < 0.05 || lngLine < 0.05) {
        return vec4(0.7, 0.7, 0.7, 1.0); // Gray for minor grid lines
      }
      
      return color;
    }
    
    // Draw markers for POI positions
    bool isNearPOI(vec3 position, float threshold) {
      for (int i = 0; i < 64; i++) {
        if (i >= numPOIs) break;
        
        float dist = distance(normalize(position), poiPositions[i]);
        if (dist < threshold) {
          return true;
        }
      }
      return false;
    }
    
    void main() {
      // Sample the base texture
      vec4 baseColor = texture2D(baseTexture, vUv);
      vec4 finalColor = baseColor;
      
      // Normalize position
      vec3 normalizedPos = normalize(vPosition);
      
      // Debug mode - show lat/long grid
      if (debugMode) {
        // Convert 3D position to lat/long
        vec2 latLong = sphereToLatLong(normalizedPos);
        
        // Draw grid based on lat/long
        finalColor = drawLatLongGrid(latLong, baseColor, gridDensity);
        
        // Mark POI positions
        if (isNearPOI(normalizedPos, 0.02)) {
          finalColor = vec4(1.0, 0.0, 0.0, 1.0); // Red marker for POIs
        }
        
        gl_FragColor = finalColor;
        return;
      }
      
      // Regular Voronoi processing
      if (showVoronoi && numPOIs > 0) {
        // Find the closest POI
        float minDist = 10.0; // Start with a large value
        int closestIndex = 0;
        
        // Also track the second closest POI
        float secondMinDist = 10.0;
        
        for (int i = 0; i < 64; i++) {
          if (i >= numPOIs) break;
          
          // Calculate geodesic distance (angle) on the sphere using dot product
          float dist = 1.0 - dot(normalizedPos, poiPositions[i]);
          
          if (dist < minDist) {
            secondMinDist = minDist;
            minDist = dist;
            closestIndex = i;
          } else if (dist < secondMinDist) {
            secondMinDist = dist;
          }
        }
        
        // Get the color of the closest POI
        vec3 cellColor = poiColors[closestIndex];
        
        // Cell border effect - more intelligent border detection
        bool isBorder = false;
        
        // Find distances to all other POIs
        for (int i = 0; i < 64; i++) {
          if (i >= numPOIs || i == closestIndex) continue;
          
          float dist = 1.0 - dot(normalizedPos, poiPositions[i]);
          float distDiff = dist - minDist;
          
          // Use a fixed width border that doesn't depend on POI proximity
          if (distDiff < borderWidth) {
            isBorder = true;
            break;
          }
        }
        
        if (isBorder) {
          // Draw cell borders in a darker color
          gl_FragColor = vec4(mix(baseColor.rgb, vec3(0.0, 0.0, 0.0), 0.7), 1.0);
        } else {
          // Blend the cell color with the base texture
          gl_FragColor = vec4(mix(baseColor.rgb, cellColor, opacity), 1.0);
        }
      } else {
        gl_FragColor = baseColor;
      }
    }
  `
);

// Extend the JSX element pool with our new material
extend({ VoronoiShaderMaterial });

// Create a type-safe component to use instead of direct JSX
interface VoronoiMaterialProps {
  pois: POI[];
  baseTexture: THREE.Texture;
  opacity?: number;
  visible?: boolean;
  debug?: boolean;
  gridSize?: number;
  borderWidth?: number;
}

const VoronoiMaterial: React.FC<VoronoiMaterialProps> = ({ 
  pois, 
  baseTexture, 
  opacity = 0.3,
  visible = true,
  debug = false,
  gridSize = 10,
  borderWidth = 0.0025
}) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  // Convert POIs to position and color data
  const { positions, colors, count } = useMemo(() => {
    // Max number of POIs we can handle in the shader
    const MAX_POIS = 64;
    const filteredPOIs = pois
      .filter(poi => poi.type === 'poi' || poi.type === 'custom')
      .slice(0, MAX_POIS);
    
    // Helper function to convert category to color
    const categoryToColor = (category?: string): THREE.Color => {
      switch(category) {
        case 'terrain': return new THREE.Color('#7cba00');
        case 'impact': return new THREE.Color('#f05f22');
        case 'landmark': return new THREE.Color('#00a2ff');
        case 'navigation': return new THREE.Color('#ffd700');
        case 'orientation': return new THREE.Color('#e066ff');
        case 'custom': return new THREE.Color('#ff3333');
        case 'user': return new THREE.Color('#ff3333');
        default: return new THREE.Color('#ffffff');
      }
    };
    
    // Create flat arrays for the shader uniforms
    // Using Float32Array for better performance and compatibility with shaders
    const positionArray = new Float32Array(MAX_POIS * 3);
    const colorArray = new Float32Array(MAX_POIS * 3);
    
    // Fill with actual data
    filteredPOIs.forEach((poi, index) => {
      // Convert lat/lng to 3D position on unit sphere
      const phi = (90 - poi.lat) * (Math.PI / 180);
      const theta = (poi.lng + 180) * (Math.PI / 180);
      
      // Using coordinate conversion with inverted X and Z to match texture orientation
      const x = -Math.sin(phi) * Math.cos(theta); // Note the negative sign
      const y = Math.cos(phi);
      const z = -Math.sin(phi) * Math.sin(theta); // Note the negative sign
      
      // Create a normalized vector
      const vec = new THREE.Vector3(x, y, z).normalize();
      
      // Set position data in the flat array
      positionArray[index * 3] = vec.x;
      positionArray[index * 3 + 1] = vec.y;
      positionArray[index * 3 + 2] = vec.z;
      
      // Convert color and set in the flat array
      const color = categoryToColor(poi.category);
      colorArray[index * 3] = color.r;
      colorArray[index * 3 + 1] = color.g;
      colorArray[index * 3 + 2] = color.b;
    });
    
    return { 
      positions: positionArray, 
      colors: colorArray, 
      count: filteredPOIs.length 
    };
  }, [pois]);
  
  // Create the material instance - following drei's documentation
  const material = useMemo(() => {
    return new VoronoiShaderMaterial();
  }, []);
  
  // Update the shader uniforms when props change
  useEffect(() => {
    if (materialRef.current) {
      // For arrays, we need to update the .value property
      materialRef.current.uniforms.poiPositions.value = positions;
      materialRef.current.uniforms.poiColors.value = colors;
      materialRef.current.uniforms.numPOIs.value = count;
      materialRef.current.uniforms.baseTexture.value = baseTexture;
      materialRef.current.uniforms.opacity.value = opacity;
      materialRef.current.uniforms.showVoronoi.value = visible;
      materialRef.current.uniforms.debugMode.value = debug;
      materialRef.current.uniforms.gridDensity.value = gridSize;
      materialRef.current.uniforms.borderWidth.value = borderWidth;
      materialRef.current.needsUpdate = true;
    }
  }, [positions, colors, count, baseTexture, opacity, visible, debug, gridSize, borderWidth]);
  
  // Use a primitive with our material instance
  return (
    <primitive 
      object={material} 
      ref={materialRef}
      attach="material"
      key={VoronoiShaderMaterial.key} // For hot-reloading support
    />
  );
};

export default VoronoiMaterial; 