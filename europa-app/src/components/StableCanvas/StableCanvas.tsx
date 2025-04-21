import React, { useRef, useLayoutEffect, forwardRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';

// Importing the AutoInvalidate component
import AutoInvalidate from './components/AutoInvalidate';

/**
 * A wrapper around R3F Canvas that helps prevent context loss during development
 * by managing the canvas lifecycle more carefully.
 */
const StableCanvas = forwardRef<HTMLCanvasElement, any>(
  ({ children, onCreated, ...props }, ref) => {
    // Track whether we're in first mount or remount
    const [mounted, setMounted] = useState(false);
    // Store a stable version of children
    const childrenRef = useRef(children);
    
    // Use layout effect to update children ref without triggering re-renders
    useLayoutEffect(() => {
      childrenRef.current = children;
    }, [children]);
    
    // Track canvas element to handle context manually if needed
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // On first mount
    useEffect(() => {
      if (!mounted) {
        console.log('StableCanvas: First mount');
        setMounted(true);
      }
      
      // Forward ref
      if (ref) {
        if (typeof ref === 'function') {
          ref(canvasRef.current);
        } else {
          ref.current = canvasRef.current;
        }
      }
      
      return () => {
        console.log('StableCanvas: Unmounting');
      };
    }, [mounted, ref]);
    
    // Custom onCreated handler to take more control of the GL context
    const handleCreated = (state: any) => {
      // Ensure canvas doesn't get garbage collected between remounts
      if (canvasRef.current) {
        // Set a flag on the canvas to mark it as "ours"
        // @ts-ignore
        canvasRef.current.__stable = true;
      }
      
      // Prevent context from being lost
      const canvas = state.gl.domElement;
      canvas.addEventListener('webglcontextlost', (e: Event) => {
        console.log('StableCanvas: Context lost, preventing default');
        e.preventDefault();
      });
      
      // Set render priority high
      state.gl.setClearColor('#000000', 0);
      state.gl.autoClear = true;
      
      // Call original onCreated if provided
      if (onCreated) {
        onCreated(state);
      }
    };
    
    return (
      <Canvas
        ref={canvasRef}
        onCreated={handleCreated}
        {...props}
        // Prevent unnecessary re-renders
        frameloop={mounted ? 'demand' : 'always'}
        // These settings help prevent context loss
        gl={{
          powerPreference: 'high-performance',
          antialias: true,
          stencil: false,
          depth: true,
          alpha: false,
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false,
          // Critical for preventing context loss in development
          // This tells Three.js not to dispose the WebGL context on unmount
          ...(props.gl || {}),
          dispose: false
        }}
      >
        {/* Only render children when mounted to prevent double initialization */}
        {mounted && children}
        
        {/* Auto-invalidate to ensure we keep rendering */}
        <AutoInvalidate />
      </Canvas>
    );
  }
);

export default StableCanvas; 