import React, { Suspense, useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { OrbitControls } from '@react-three/drei';
import './App.css';
import EuropaSphere from './components/EuropaSphere';
import LoadingScreen from './components/LoadingScreen';
import UIOverlay from './components/UIOverlay';
import StableCanvas from './components/StableCanvas';

// Memoized Canvas component to prevent unnecessary re-renders - now using our stable version
const MemoizedCanvas = memo(({ children, ...props }: any) => (
  <StableCanvas {...props}>{children}</StableCanvas>
));

// Define type for the Europa sphere ref
type EuropaSphereRef = { 
  addMarker: (lat: number, long: number, title: string, description: string) => void 
} | null;

// Define type for SceneContent props
interface SceneContentProps {
  europaSphereRef: React.RefObject<EuropaSphereRef>;
  layerVisibility: {
    gridLines: boolean;
    orientationMarkers: boolean;
    equator: boolean;
    poles: boolean;
    poi: boolean;
  };
  isMarkerMode: boolean;
  onMarkerPlaced: (lat: number, long: number) => void;
}

// Memoized scene content
const SceneContent = memo(({ 
  europaSphereRef, 
  layerVisibility, 
  isMarkerMode, 
  onMarkerPlaced 
}: SceneContentProps) => (
  <>
    {/* Improved lighting setup */}
    <ambientLight intensity={0.4} />
    <directionalLight 
      position={[5, 5, 5]} 
      intensity={1} 
      castShadow 
      shadow-mapSize={[1024, 1024]}
    />
    <directionalLight 
      position={[-5, -5, -5]} 
      intensity={0.3} 
      color="#6666ff"
    />
    <EuropaSphere 
      ref={europaSphereRef}
      layerVisibility={layerVisibility}
      isMarkerMode={isMarkerMode}
      onMarkerPlaced={onMarkerPlaced}
    />
    <OrbitControls 
      enableZoom={true} 
      enablePan={false} 
      enableRotate={true}
      minDistance={2}
      maxDistance={10}
      enableDamping={true}
      dampingFactor={0.05}
      rotateSpeed={0.5}
      zoomSpeed={0.5}
    />
  </>
));

function App() {
  // State for controlling layer visibility - all disabled by default for diagnosis
  const [layerVisibility, setLayerVisibility] = useState({
    gridLines: true,
    equator: true,
    poles: true,
    poi: true,
    orientationMarkers: true
  });
  
  // State for marker creation mode
  const [isMarkerMode, setIsMarkerMode] = useState(false);
  
  // Ref to access EuropaSphere methods
  const europaSphereRef = useRef<EuropaSphereRef>(null);
  
  // State for new marker modal
  const [markerModalData, setMarkerModalData] = useState<{ lat: number, long: number } | null>(null);
  
  // State for modal visibility
  const [showModal, setShowModal] = useState(false);
  
  // Effect to listen for marker-selected events - memoized with useCallback
  const handleMarkerSelected = useCallback((event: any) => {
    if (isMarkerMode) {
      setShowModal(true);
    }
  }, [isMarkerMode]);
  
  useEffect(() => {
    window.addEventListener('marker-selected', handleMarkerSelected);
    
    return () => {
      window.removeEventListener('marker-selected', handleMarkerSelected);
    };
  }, [handleMarkerSelected]);
  
  // Handle layer visibility toggle - memoized with useCallback
  const handleLayerToggle = useCallback((layer: string, visible: boolean) => {
    setLayerVisibility(prev => ({
      ...prev,
      [layer]: visible
    }));
  }, []);
  
  // Toggle marker creation mode - memoized with useCallback
  const toggleMarkerMode = useCallback(() => {
    setIsMarkerMode(prev => {
      // If turning off marker mode, also clear any pending marker data
      if (prev) {
        setMarkerModalData(null);
        setShowModal(false);
      }
      return !prev;
    });
  }, []);
  
  // Handle when a marker position is selected on the globe - memoized with useCallback
  const handleMarkerPlaced = useCallback((lat: number, long: number) => {
    setMarkerModalData({ lat, long });
  }, []);
  
  // Create a new marker - memoized with useCallback
  const createMarker = useCallback((title: string, description: string) => {
    if (markerModalData && europaSphereRef.current) {
      const { lat, long } = markerModalData;
      europaSphereRef.current.addMarker(lat, long, title, description);
      setMarkerModalData(null);
      setIsMarkerMode(false);
      setShowModal(false);
    }
  }, [markerModalData]);

  // Memoize canvas props
  const canvasProps = useMemo(() => ({
    style: { width: '100vw', height: '100vh' },
    dpr: [1, 2], // Limit pixel ratio for better performance
    shadows: true, // Enable shadows
    legacy: false, // Use the modern renderer
    gl: { 
      powerPreference: 'high-performance',
      antialias: true,
      stencil: false,
      depth: true,
      alpha: false,
      preserveDrawingBuffer: true, // Important for context preservation
      dispose: false, // Prevent disposing WebGL context during re-renders
      failIfMajorPerformanceCaveat: false, // Don't fail on performance issues
      logarithmicDepthBuffer: false // Disable logarithmic depth buffer (can cause issues)
    },
    onCreated: (state: any) => {
      // Add debugging information to help identify context loss causes
      state.gl.debug = { checkShaderErrors: true };
      
      // Force initial render to ensure content is displayed
      state.gl.render(state.scene, state.camera);
      
      console.log('Canvas created with renderer:', state.gl.name);
    }
  }), []);

  // Memoize the entire Canvas renderer
  const memoizedCanvas = useMemo(() => (
    <Suspense fallback={<LoadingScreen />}>
      <MemoizedCanvas {...canvasProps}>
        <SceneContent 
          europaSphereRef={europaSphereRef}
          layerVisibility={layerVisibility}
          isMarkerMode={isMarkerMode}
          onMarkerPlaced={handleMarkerPlaced}
        />
      </MemoizedCanvas>
    </Suspense>
  ), [layerVisibility, isMarkerMode, handleMarkerPlaced, canvasProps]);

  return (
    <div className="App">
      <div className="title">Europa 3D Explorer</div>
      {memoizedCanvas}
      
      <UIOverlay
        layerVisibility={layerVisibility}
        onLayerToggle={handleLayerToggle}
        isMarkerMode={isMarkerMode}
        onMarkerModeToggle={toggleMarkerMode}
        onCreateMarker={createMarker}
      />
      
      {/* Marker position information display */}
      {markerModalData && isMarkerMode && !showModal && (
        <div className="marker-info">
          Selected position: {markerModalData.lat.toFixed(2)}°, {markerModalData.long.toFixed(2)}°
          <button 
            onClick={() => setShowModal(true)}
            style={{ marginLeft: '10px', padding: '3px 8px' }}
          >
            Add Marker
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
