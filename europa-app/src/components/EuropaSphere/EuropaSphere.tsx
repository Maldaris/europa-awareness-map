import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RepeatWrapping } from 'three';
import { Sphere, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { latLongToVector3, vectorToLatLong } from './utils';
import { usePOIs } from '../../context/POIContext';
import { POI } from '../../types';

// Import the extracted components
import GridLines from './components/GridLines';
import POIMarker from './components/POIMarker';
import PoleMarker from './components/PoleMarker';
import Jupiter from './components/Jupiter';
import Skybox from './components/Skybox';

// Constants for marker scaling
const MIN_MARKER_SIZE = 0.005;
const MAX_MARKER_SIZE = 0.04;
const MIN_CAMERA_DISTANCE = 1.5;
const MAX_CAMERA_DISTANCE = 4;

// Constants for Jupiter-Europa proportions
// Jupiter's diameter is ~46x that of Europa
const JUPITER_SCALE_FACTOR = 46;
// Distance: Europa orbits Jupiter at approximately 671,000 km
// For visualization, we'll use a scaled distance that works for the scene
const JUPITER_DISTANCE = 100; // Scaled distance for visual purposes

// Custom marker type
interface CustomMarker {
    id: string;
    normalizedPosition: THREE.Vector3;
    title: string;
    description: string;
}

// Debounce helper function
const debounce = <T extends (...args: any[]) => any>(fn: T, ms = 50) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
};

interface EuropaSphereProps {
    layerVisibility?: {
        gridLines: boolean;
        equator: boolean;
        poles: boolean;
        poi: boolean;
        orientationMarkers: boolean;
    };
    isMarkerMode?: boolean;
    onMarkerPlaced?: (lat: number, long: number) => void;
    terrainHeight?: number; // Control the terrain elevation scale
}

// Main Europa Sphere Component
const EuropaSphere = React.forwardRef<
    { addMarker: (lat: number, long: number, title: string, description: string, category: string) => void },
    EuropaSphereProps
>(({
    layerVisibility = { gridLines: true, equator: true, poles: true, poi: true, orientationMarkers: true },
    isMarkerMode = false,
    onMarkerPlaced,
    terrainHeight = 0.5
}, ref) => {
    // Reference to the mesh for animations and raycasting
    const meshRef = useRef<THREE.Mesh>(null);
    const radius = 1;
    
    // Access the POI context
    const { pois, isLoading: poisLoading, addPOI, getDirectionVector } = usePOIs();

    const { camera, gl, invalidate } = useThree();
    // State for marker scale (calculated once for all markers)
    const [markerScale, setMarkerScale] = useState(MAX_MARKER_SIZE);

    // State for displacement scale (for terrain height adjustment)
    const [displacementScale, setDisplacementScale] = useState(terrainHeight);

    // State to track intersection point
    const [intersectionPoint, setIntersectionPoint] = useState<THREE.Vector3 | null>(null);

    // State for custom markers
    const [customMarkers, setCustomMarkers] = useState<CustomMarker[]>([]);

    const canvasDomElement = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = gl.domElement;
        canvasDomElement.current = canvas;
    }, [gl]);

    // Use useMemo for texture loading to prevent reloads
    const textures = useMemo(() => {
        console.log('Europa texture loading');

        const colorTex = new THREE.TextureLoader().load('/textures/Dh_europa_texture.webp', (loadedTexture) => {
            // Configure texture when loaded
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.wrapS = RepeatWrapping;
            loadedTexture.wrapT = RepeatWrapping;

            // Force a re-render after texture is loaded
            invalidate();
            console.log('Color texture loaded and configured');
        });

        // Load heightmap texture for displacement
        const heightmapTex = new THREE.TextureLoader().load('/resources/europa-heightmap.jpg', (loadedTexture) => {
            // Configure heightmap texture
            loadedTexture.wrapS = RepeatWrapping;
            loadedTexture.wrapT = RepeatWrapping;
            
            // Force a re-render after texture is loaded
            invalidate();
            console.log('Heightmap texture loaded and configured');
        });

        return { colorTex, heightmapTex };
    }, [invalidate]); // Only depend on invalidate function

    // Filter POIs by type
    const filteredPOIs = useMemo(() => {
        if (poisLoading) return { poles: [], orientationMarkers: [], pois: [] };
        
        return {
            poles: pois.filter(poi => poi.type === 'pole'),
            orientationMarkers: pois.filter(poi => poi.type === 'orientation'),
            pois: pois.filter(poi => poi.type === 'poi' || poi.type === 'custom')
        };
    }, [pois, poisLoading]);

    // Calculate intersection point when needed
    const calculateIntersection = useCallback((mouseX: number, mouseY: number) => {
        if (!meshRef.current) return null;
        
        // Get the canvas dimensions


        if (!canvasDomElement.current) return null;
        
        const canvas = canvasDomElement.current;
        const rect = canvasDomElement.current?.getBoundingClientRect();

        // Account for device pixel ratio and scroll position
        // Get the pixel ratio of the device (for high-DPI screens)
        const pixelRatio = window.devicePixelRatio || 1;
        
        // Get the canvas's actual rendering size (may differ from CSS size)
        const canvasWidth = canvas.width / pixelRatio;
        const canvasHeight = canvas.height / pixelRatio;
        
        // Calculate ratio between canvas CSS size and actual rendering size
        const widthRatio = rect.width / canvasWidth;
        const heightRatio = rect.height / canvasHeight;
        
        // Calculate correct mouse position relative to canvas
        // Adjust for scroll position, canvas position, and any scaling
        const x = ((mouseX - rect.left) / widthRatio);
        const y = ((mouseY - rect.top) / heightRatio);
        
        // Calculate normalized device coordinates (-1 to +1) taking into account pixel ratio
        // Use the actual rendering size of the canvas for this calculation
        const ndcX = (x / canvasWidth) * 2 - 1;
        const ndcY = -(y / canvasHeight) * 2 + 1;
        
        // Get sphere position in world space
        const spherePosition = new THREE.Vector3();
        meshRef.current.getWorldPosition(spherePosition);
        
        // Use raycaster for more reliable ray calculation
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
        
        // The raycaster origin is the camera position
        const rayOrigin = raycaster.ray.origin.clone();
        // The direction is already normalized
        const rayDirection = raycaster.ray.direction.clone();
        
        // Vector from sphere center to ray origin (this is the correct vector for the formula)
        const centerToOrigin = rayOrigin.clone().sub(spherePosition);
        
        // Coefficients of quadratic equation - using standard ray-sphere intersection formula
        const a = rayDirection.dot(rayDirection); // Always 1 for normalized direction
        const b = 2 * centerToOrigin.dot(rayDirection);
        const c = centerToOrigin.dot(centerToOrigin) - radius * radius;
        
        // Calculate discriminant
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant >= 0) {
            // Ray intersects sphere
            // Calculate both intersection points
            const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
            const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
            
            // Select the appropriate t value
            // For a camera outside the sphere looking at it:
            // - The smaller positive t is the entry point (front)
            // - The larger positive t is the exit point (back)
            
            // Choose proper t value - select front intersection if both are positive
            let t;
            if (t1 > 0 && t2 > 0) {
                // Both are positive, camera is outside sphere
                t = Math.min(t1, t2); // Choose the closer (front) intersection
            } else if (t1 > 0) {
                // Only t1 is positive
                t = t1;
            } else if (t2 > 0) {
                // Only t2 is positive
                t = t2;
            } else {
                // Both negative, no valid intersection
                return null;
            }
            
            // Calculate the intersection point in world space
            const intersectionPoint = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(t));
            
            // Calculate normal at intersection (direction from sphere center to intersection)
            const normal = intersectionPoint.clone().sub(spherePosition).normalize();
            
            // Final position is exactly on the sphere surface
            const finalPosition = spherePosition.clone().add(normal.multiplyScalar(radius));
            
            return {
                position: finalPosition,
                normal: normal,
                normalizedPosition: normal.clone()
            };
        }
        
        return null;
    }, [camera, canvasDomElement, radius]);

    // Handle pointer movement - only update the mouse position, actual calculation happens in useAnimationFrame
    const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
        if (!meshRef.current) return;
        const intersection = calculateIntersection(event.clientX, event.clientY);
        if (intersection) {
            setIntersectionPoint(intersection.position);
            invalidate();
        } else {
            setIntersectionPoint(null);
        }
    }, [calculateIntersection, invalidate]);

    // Handle click on the sphere to place a marker
    const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
        if (!isMarkerMode || !meshRef.current) return;
        
        // Calculate intersection
        const intersection = calculateIntersection(event.clientX, event.clientY);
        if (!intersection) return;
        
        // Get lat/long from the normalized position
        const { lat, long } = vectorToLatLong(intersection.normalizedPosition, 1);
        
        // Call the callback with the lat/long
        if (onMarkerPlaced) {
            onMarkerPlaced(lat, long);
            
            // Dispatch marker selected event
            const markerSelectedEvent = new Event('marker-selected');
            window.dispatchEvent(markerSelectedEvent);
        }
    }, [isMarkerMode, calculateIntersection, onMarkerPlaced]);

    // Update displacement scale when terrainHeight prop changes
    useEffect(() => {
        setDisplacementScale(terrainHeight);
    }, [terrainHeight]);
    // Calculate marker scale based on camera distance to center of sphere
    useFrame(({ camera }) => {
        if (!meshRef.current) return;

        // Get the current world position of the sphere
        const sphereWorldPosition = new THREE.Vector3();
        meshRef.current.getWorldPosition(sphereWorldPosition);

        // Calculate distance between camera and sphere center
        const distanceToCamera = camera.position.distanceTo(sphereWorldPosition);

        // Calculate scale factor based on distance
        // Clamp between min and max camera distances
        const clampedDistance = Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, distanceToCamera));

        // Map distance to scale (closer = smaller, further = larger)
        const normalizedDistance = (clampedDistance - MIN_CAMERA_DISTANCE) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE);
        const scale = MIN_MARKER_SIZE + normalizedDistance * (MAX_MARKER_SIZE - MIN_MARKER_SIZE);

        // Update the marker scale state
        setMarkerScale(scale);
    });

    const addMarker = useCallback((lat: number, long: number, title: string, description: string, category: string = 'user') => {
        console.log(`Adding marker at ${lat}°, ${long}° with title "${title}" and category "${category}"`);
        
        // Determine if this should be a special type or a regular POI based on category
        let poiType: 'poi' | 'orientation' | 'pole' | 'custom' = 'poi';
        
        // Map specific categories to types if needed
        if (category === 'orientation') {
            poiType = 'orientation';
        } else if (category === 'custom' || category === 'user') {
            poiType = 'custom';
        }
        
        addPOI({
            title,
            description,
            lat,
            lng: long,
            type: poiType,
            category: category
        });
    }, [addPOI]);

    // Expose addMarker function to parent component
    React.useImperativeHandle(ref, () => ({
        addMarker
    }));

    return (
        <>
            {/* Skybox with Milky Way texture */}
            <Skybox />

            {/* Jupiter in the background */}
            <Jupiter
                radius={radius * JUPITER_SCALE_FACTOR}
                position={[-JUPITER_DISTANCE, 0, -JUPITER_DISTANCE * 2]}
            />

            <group>
                {/* Add ambient light inside the component for consistent lighting */}
                <ambientLight intensity={0.3} />
                <pointLight position={[5, 5, 5]} intensity={0.5} />

                <mesh
                    ref={meshRef}
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                >
                    <Sphere args={[radius, 64, 32]}>
                        <meshStandardMaterial
                            map={textures.colorTex}
                            metalness={0.2}
                            roughness={0.8}
                            emissive="#444444"
                            emissiveIntensity={0.1}
                            displacementMap={textures.heightmapTex}
                            displacementScale={displacementScale}
                            bumpMap={textures.heightmapTex}
                            bumpScale={0.05}
                        />
                    </Sphere>

                    {/* Only render grid lines if visible */}
                    {layerVisibility.gridLines && (
                        <GridLines radius={radius} showEquator={layerVisibility.equator} />
                    )}

                    {/* Poles */}
                    {layerVisibility.poles && !poisLoading && 
                        filteredPOIs.poles.map(poi => (
                            <PoleMarker
                                key={poi.id}
                                directionVector={getDirectionVector(poi, radius)}
                                label={{
                                    title: poi.title,
                                    location: poi.location
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                        ))
                    }

                    {/* POI markers */}
                    {layerVisibility.poi && !poisLoading && 
                        filteredPOIs.pois.map(poi => (
                            <POIMarker
                                key={poi.id}
                                directionVector={getDirectionVector(poi, radius)}
                                label={{
                                    title: poi.title,
                                    description: poi.description,
                                    location: poi.location
                                }}
                                category={poi.category}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                        ))
                    }

                    {/* User created custom markers */}
                    {customMarkers.map(marker => (
                        <POIMarker
                            key={marker.id}
                            directionVector={marker.normalizedPosition}
                            label={{
                                title: marker.title,
                                description: marker.description
                            }}
                            category="custom"
                            sphereRef={meshRef as any}
                            scale={markerScale}
                            radius={radius}
                        />
                    ))}

                    {/* Intersection point indicator - only show when in marker placement mode */}
                    {intersectionPoint && isMarkerMode && (
                        <mesh position={intersectionPoint} renderOrder={1000}>
                            <sphereGeometry args={[0.02, 16, 16]} />
                            <meshBasicMaterial 
                                color="#00ff00" 
                                transparent={true} 
                                opacity={0.8} 
                                depthTest={false}
                                side={THREE.DoubleSide}
                            />
                        </mesh>
                    )}
                </mesh>
            </group>
        </>
    );
});

export default EuropaSphere; 