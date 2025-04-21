import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RepeatWrapping } from 'three';
import { Sphere, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { latLongToVector3 } from './utils';

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
}

// Main Europa Sphere Component
const EuropaSphere = React.forwardRef<
    { addMarker: (lat: number, long: number, title: string, description: string) => void },
    EuropaSphereProps
>(({
    layerVisibility = { gridLines: true, equator: true, poles: true, poi: true, orientationMarkers: true },
    isMarkerMode = false,
    onMarkerPlaced
}, ref) => {
    // Reference to the mesh for animations and raycasting
    const meshRef = useRef<THREE.Mesh>(null);
    const radius = 1;

    const { camera, gl, invalidate } = useThree();

    // State to track if context is lost
    const [contextLost, setContextLost] = useState(false);

    // State to track if user has interacted with orbit controls
    const [userHasInteracted, setUserHasInteracted] = useState(false);

    // State for marker scale (calculated once for all markers)
    const [markerScale, setMarkerScale] = useState(MAX_MARKER_SIZE);

    // State to track intersection point
    const [intersectionPoint, setIntersectionPoint] = useState<THREE.Vector3 | null>(null);

    // State to track current mouse position
    const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);

    // State to track if calculation is needed
    const [needsCalculation, setNeedsCalculation] = useState(false);

    // Debounced mouse position setter
    const debouncedSetMousePos = useMemo(() =>
        debounce((x: number, y: number) => {
            setMousePos({ x, y });
            setNeedsCalculation(true);
        }, 5)
        , [setMousePos, setNeedsCalculation]);

    // Use useMemo for texture loading to prevent reloads
    const texture = useMemo(() => {
        console.log('Europa texture loading');

        const tex = new THREE.TextureLoader().load('/textures/Dh_europa_texture.webp', (loadedTexture) => {
            // Configure texture when loaded
            loadedTexture.colorSpace = THREE.SRGBColorSpace;
            loadedTexture.wrapS = RepeatWrapping;
            loadedTexture.wrapT = RepeatWrapping;

            // Force a re-render after texture is loaded
            invalidate();
            console.log('Texture loaded and configured');
        });

        return tex;
    }, [invalidate]); // Only depend on invalidate function

    // Pre-calculate pole and POI positions
    const positions = useMemo(() => ({
        // Orientation markers
        northPole: latLongToVector3(90, 0, radius),
        southPole: latLongToVector3(-90, 0, radius),
        origin: latLongToVector3(0, 0, radius),          // Prime meridian at equator
        east90: latLongToVector3(0, 90, radius),         // 90°E at equator
        west90: latLongToVector3(0, -90, radius),        // 90°W at equator
        antiMeridian: latLongToVector3(0, 180, radius),  // 180° at equator
        northeast: latLongToVector3(45, 45, radius),     // 45°N, 45°E
        southwest: latLongToVector3(-45, -45, radius),   // 45°S, 45°W

        // Europa Forever War locations
        iceTrenches: latLongToVector3(9, -146, radius),     // Conamara Chaos - Ice Trenches
        cemetery: latLongToVector3(-26, -271, radius),      // Pwyll Crater - Cemetery
        iceTunnels: latLongToVector3(-48, -181, radius),    // Thera Macula - Ice Tunnels
        crashSite: latLongToVector3(-17, -334, radius),     // Callanish Crater - Crash Site
        charonsCrossing: latLongToVector3(10, 220, radius),  // Argadnel Regio - Charon's Crossing (approximate)
        equator0: latLongToVector3(0, 0, radius),
        equator90E: latLongToVector3(0, 90, radius),
        equator180: latLongToVector3(0, 180, radius),
        equator90W: latLongToVector3(0, 270, radius),
        north45: latLongToVector3(45, 0, radius)
    }), [radius]);

    useEffect(() => {
        if (needsCalculation) {
            // Only perform calculation if mouse position is available
            if (!mousePos || !meshRef.current) return;
            
            // Get the canvas dimensions
            const canvas = gl.domElement;
            const rect = canvas.getBoundingClientRect();
            
            // Create normalized device coordinates (-1 to 1)
            const ndcX = ((mousePos.x - rect.left) / rect.width) * 2 - 1;
            const ndcY = -((mousePos.y - rect.top) / rect.height) * 2 + 1;
            
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
            
            // Ray-sphere intersection calculation
            // For a ray p(t) = rayOrigin + t*rayDir and a sphere with center spherePos and radius r:
            // We need to solve |p(t) - spherePos|^2 = r^2
            
            // Vector from sphere center to ray origin (this is the correct vector for the formula)
            const centerToOrigin = rayOrigin.clone().sub(spherePosition);
            
            // Coefficients of quadratic equation - using standard ray-sphere intersection formula
            const a = rayDirection.dot(rayDirection); // Always 1 for normalized direction
            const b = 2 * centerToOrigin.dot(rayDirection);
            const c = centerToOrigin.dot(centerToOrigin) - radius * radius;
            
            // Calculate discriminant
            const discriminant = b * b - 4 * a * c;
            
            // Dump calculation state
            console.log("Ray-sphere intersection calculation state:", JSON.stringify({
                rayOrigin: rayOrigin.toArray(),
                rayDirection: rayDirection.toArray(),
                spherePosition: spherePosition.toArray(),
                radius,
                centerToOrigin: centerToOrigin.toArray(),
                a,
                b, 
                c,
                discriminant
            }, null, 2));
            
            if (discriminant >= 0) {
                // Ray intersects sphere
                // Calculate both intersection points
                const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
                const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
                
                console.log("t1", t1);
                console.log("t2", t2);
                
                // Based on our diagnostics, we need to flip our logic:
                // When both t values are negative, use the less negative one (closest to zero)
                let t = Math.min(t1, t2);
                console.log("t selected", t);
                
                // Calculate the intersection point in world space
                const intersectionPoint = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(t));
                
                // Calculate normal at intersection (direction from sphere center to intersection)
                const normal = intersectionPoint.clone().sub(spherePosition).normalize();
                
                // Final position is exactly on the sphere surface
                const finalPosition = spherePosition.clone().add(normal.multiplyScalar(radius));
                
                console.log("finalPosition", finalPosition);
                console.log("normal", normal);
                
                setIntersectionPoint(finalPosition);
            } else {
                setIntersectionPoint(null);
            }
            
            // Reset the calculation flag
            setNeedsCalculation(false);
        }
    }, [camera, gl.domElement, mousePos, needsCalculation, radius]);

    // Handle pointer movement - only update the mouse position, actual calculation happens in useAnimationFrame
    const handlePointerMove = useCallback((event: ThreeEvent<PointerEvent>) => {
        if (!meshRef.current) return;
        debouncedSetMousePos(event.clientX, event.clientY);
    }, [debouncedSetMousePos]);

    // Handle WebGL context loss and restoration with forced context restore
    useEffect(() => {
        const canvas = gl.domElement;
        const renderer = gl;

        const handleContextLost = (event: Event) => {
            event.preventDefault(); // Critical to allow context restoration
            console.log('WebGL context lost - attempting to restore...');
            setContextLost(true);

            // Force context restoration after a small timeout
            setTimeout(() => {
                try {
                    // @ts-ignore - forceContextRestore is not in the type definitions but exists in THREE
                    renderer.forceContextRestore();
                    console.log('Context restore forced');
                } catch (e) {
                    console.error('Failed to force context restore:', e);
                }
            }, 10);
        };

        const handleContextRestored = () => {
            console.log('WebGL context restored');
            setContextLost(false);

            // Force scene to update on context restoration
            invalidate();

            // Re-apply texture if we have it stored
            if (texture && meshRef.current) {
                const material = meshRef.current.material as THREE.MeshStandardMaterial;
                if (material) {
                    material.map = texture;
                    material.needsUpdate = true;
                }
            }
        };

        canvas.addEventListener('webglcontextlost', handleContextLost);
        canvas.addEventListener('webglcontextrestored', handleContextRestored);

        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [gl, invalidate, texture]);

    // Force the scene to re-render periodically if we're in a problematic state
    useEffect(() => {
        if (contextLost) {
            const interval = setInterval(() => {
                invalidate();
            }, 500);

            return () => clearInterval(interval);
        }
    }, [contextLost, invalidate]);

    // Optimize rotation animation: slower rotation and skip if context is lost
    useFrame((_, delta) => {
        if (meshRef.current && !isMarkerMode && !contextLost && !userHasInteracted) {
            // Use time delta for smoother animation independent of frame rate
            meshRef.current.rotation.y += 0.1 * delta;

            // Force scene update
            invalidate();
        }
    });

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

    // Simple stub for addMarker - this will be properly implemented later
    const addMarker = useCallback((lat: number, long: number, title: string, description: string) => {
        console.log(`Stub: Would add marker at ${lat}°, ${long}° with title "${title}"`);
        // No-op for now - will be implemented in future
    }, []);

    // Expose addMarker function to parent component
    React.useImperativeHandle(ref, () => ({
        addMarker
    }));

    // Add a listener for orbit control interaction
    useEffect(() => {
        const handleOrbitStart = () => {
            setUserHasInteracted(true);
            console.log('User interacted with orbit controls, auto-rotation disabled');
        };

        // Listen for control events from orbit controls
        window.addEventListener('orbit-controls-change', handleOrbitStart);

        // Also listen for pointerdown/mousedown events on the canvas as a fallback
        const canvas = gl.domElement;
        const handlePointerDown = (e: PointerEvent) => {
            if (e.button === 1 || e.button === 2) {
                setUserHasInteracted(true);
                console.log('User right-clicked or middle-clicked, auto-rotation disabled');
            }
        };

        // Handle wheel events for zooming
        const handleWheel = () => {
            setUserHasInteracted(true);
            console.log('User zoomed with wheel, auto-rotation disabled');
        };

        // Handle touch events for mobile users
        const handleTouch = (e: TouchEvent) => {
            // If it's a multi-touch gesture (pinch/zoom or rotation)
            if (e.touches.length > 1) {
                setUserHasInteracted(true);
                console.log('User performed multi-touch gesture, auto-rotation disabled');
            }
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('touchstart', handleTouch);

        return () => {
            window.removeEventListener('orbit-controls-change', handleOrbitStart);
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('touchstart', handleTouch);
        };
    }, [gl]);

    // Display a message if context is lost
    if (contextLost) {
        return (
            <group>
                <Billboard>
                    <Text
                        position={[0, 0, 0]}
                        fontSize={0.2}
                        color="red"
                        anchorX="center"
                        anchorY="middle"
                    >
                        WebGL context lost. Please reload the page.
                    </Text>
                </Billboard>
            </group>
        );
    }

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
                >
                    <Sphere args={[radius, 48, 48]}>
                        <meshStandardMaterial
                            map={texture}
                            metalness={0.1}
                            roughness={0.7}
                            emissive="#444444"
                            emissiveIntensity={0.1}
                        />
                    </Sphere>

                    {/* Only render grid lines if visible */}
                    {layerVisibility.gridLines && (
                        <GridLines radius={radius} showEquator={layerVisibility.equator} />
                    )}

                    {/* Poles */}
                    {layerVisibility.poles && (
                        <>
                            <PoleMarker
                                directionVector={positions.northPole.clone().normalize()}
                                label={{
                                    title: "North Pole",
                                    location: "90°N, 0°E"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                            <PoleMarker
                                directionVector={positions.southPole.clone().normalize()}
                                label={{
                                    title: "South Pole",
                                    location: "90°S, 0°E"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                        </>
                    )}

                    {/* POI markers */}
                    {layerVisibility.poi && (
                        <>
                            <POIMarker
                                directionVector={positions.iceTrenches.clone().normalize()}
                                label={{
                                    title: "Ice Trenches",
                                    description: "A disrupted terrain region with ridge-like features",
                                    location: "Conamara Chaos (9°N, 146°W)"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                            <POIMarker
                                directionVector={positions.cemetery.clone().normalize()}
                                label={{
                                    title: "Cemetery",
                                    description: "An impact site with chaotic terrain",
                                    location: "Pwyll Crater (26°S, 271°W)"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                            <POIMarker
                                directionVector={positions.iceTunnels.clone().normalize()}
                                label={{
                                    title: "Ice Tunnels",
                                    description: "A chaos region suggesting subsurface activity",
                                    location: "Thera Macula (48°S, 181°W)"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                            <POIMarker
                                directionVector={positions.crashSite.clone().normalize()}
                                label={{
                                    title: "Crash Site",
                                    description: "A multi-ring impact structure with fractured ice",
                                    location: "Callanish Crater (17°S, 334°W)"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />
                            <POIMarker
                                directionVector={positions.charonsCrossing.clone().normalize()}
                                label={{
                                    title: "Charon's Crossing",
                                    description: "A flat, smooth region suitable for an outpost",
                                    location: "Argadnel Regio (10°N, 220°E)"
                                }}
                                sphereRef={meshRef as any}
                                scale={markerScale}
                                radius={radius}
                            />

                            {/* Orientation markers */}
                            {layerVisibility.orientationMarkers && (
                                <>
                                    <POIMarker
                                        directionVector={positions.equator0.clone().normalize()}
                                        label={{
                                            title: "Equator 0°",
                                            location: "0°N, 0°E",
                                            description: "Prime meridian at equator"
                                        }}
                                        sphereRef={meshRef as any}
                                        scale={markerScale}
                                        radius={radius}
                                    />
                                    <POIMarker
                                        directionVector={positions.equator90E.clone().normalize()}
                                        label={{
                                            title: "Equator 90°E",
                                            location: "0°N, 90°E",
                                            description: "Eastern point on equator"
                                        }}
                                        sphereRef={meshRef as any}
                                        scale={markerScale}
                                        radius={radius}
                                    />
                                    <POIMarker
                                        directionVector={positions.equator180.clone().normalize()}
                                        label={{
                                            title: "Equator 180°",
                                            location: "0°N, 180°E",
                                            description: "Anti-meridian at equator"
                                        }}
                                        sphereRef={meshRef as any}
                                        scale={markerScale}
                                        radius={radius}
                                    />
                                    <POIMarker
                                        directionVector={positions.equator90W.clone().normalize()}
                                        label={{
                                            title: "Equator 90°W",
                                            location: "0°N, 270°E",
                                            description: "Western point on equator"
                                        }}
                                        sphereRef={meshRef as any}
                                        scale={markerScale}
                                        radius={radius}
                                    />
                                    <POIMarker
                                        directionVector={positions.north45.clone().normalize()}
                                        label={{
                                            title: "45°N",
                                            location: "45°N, 0°E",
                                            description: "Northern hemisphere reference"
                                        }}
                                        sphereRef={meshRef as any}
                                        scale={markerScale}
                                        radius={radius}
                                    />
                                </>
                            )}
                        </>
                    )}

                    {/* Intersection point indicator */}
                    {intersectionPoint && (
                        <mesh position={intersectionPoint}>
                            <sphereGeometry args={[0.02, 16, 16]} />
                            <meshBasicMaterial color="#00ff00" transparent={true} opacity={0.8} depthTest={false} />
                        </mesh>
                    )}
                </mesh>
            </group>
        </>
    );
});

export default EuropaSphere; 