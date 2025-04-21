import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { POI, POICollection } from '../types';
import * as THREE from 'three';
import { latLongToVector3 } from '../components/EuropaSphere/utils';

interface POIContextType {
  pois: POI[];
  isLoading: boolean;
  error: string | null;
  addPOI: (poi: Omit<POI, 'id'>) => string;
  updatePOI: (id: string, updates: Partial<POI>) => boolean;
  removePOI: (id: string) => boolean;
  getPOIsByType: (type: POI['type']) => POI[];
  getPOIById: (id: string) => POI | undefined;
  getDirectionVector: (poi: POI, radius?: number) => THREE.Vector3;
}

const POIContext = createContext<POIContextType | undefined>(undefined);

export const POIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pois, setPOIs] = useState<POI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load POIs from JSON file
  useEffect(() => {
    const loadPOIs = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/resources/europa-pois.json');
        if (!response.ok) {
          throw new Error(`Failed to load POIs: ${response.statusText}`);
        }
        
        const data: POICollection = await response.json();
        
        // Validate data
        if (!data.pois || !Array.isArray(data.pois)) {
          throw new Error('Invalid POI data format');
        }
        
        setPOIs(data.pois);
        setError(null);
      } catch (err) {
        console.error('Error loading POIs:', err);
        setError(err instanceof Error ? err.message : 'Unknown error loading POIs');
      } finally {
        setIsLoading(false);
      }
    };

    loadPOIs();
  }, []);

  // Add a new POI
  const addPOI = useCallback((poiData: Omit<POI, 'id'>) => {
    const id = `poi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newPOI: POI = {
      ...poiData,
      id
    };
    
    setPOIs(prevPOIs => [...prevPOIs, newPOI]);
    return id;
  }, []);

  // Update an existing POI
  const updatePOI = useCallback((id: string, updates: Partial<POI>) => {
    let updated = false;
    
    setPOIs(prevPOIs => {
      const index = prevPOIs.findIndex(poi => poi.id === id);
      if (index === -1) return prevPOIs;
      
      updated = true;
      const updatedPOIs = [...prevPOIs];
      updatedPOIs[index] = { ...updatedPOIs[index], ...updates };
      return updatedPOIs;
    });
    
    return updated;
  }, []);

  // Remove a POI
  const removePOI = useCallback((id: string) => {
    let removed = false;
    
    setPOIs(prevPOIs => {
      const index = prevPOIs.findIndex(poi => poi.id === id);
      if (index === -1) return prevPOIs;
      
      removed = true;
      const updatedPOIs = [...prevPOIs];
      updatedPOIs.splice(index, 1);
      return updatedPOIs;
    });
    
    return removed;
  }, []);

  // Get POIs by type
  const getPOIsByType = useCallback((type: POI['type']) => {
    return pois.filter(poi => poi.type === type);
  }, [pois]);

  // Get a POI by ID
  const getPOIById = useCallback((id: string) => {
    return pois.find(poi => poi.id === id);
  }, [pois]);

  // Convert POI to direction vector
  const getDirectionVector = useCallback((poi: POI, radius: number = 1) => {
    // Convert lat/lng to normalized vector
    return latLongToVector3(poi.lat, poi.lng, radius).normalize();
  }, []);

  const contextValue: POIContextType = {
    pois,
    isLoading,
    error,
    addPOI,
    updatePOI,
    removePOI,
    getPOIsByType,
    getPOIById,
    getDirectionVector
  };

  return (
    <POIContext.Provider value={contextValue}>
      {children}
    </POIContext.Provider>
  );
};

// Custom hook to use the POI context
export const usePOIs = () => {
  const context = useContext(POIContext);
  if (context === undefined) {
    throw new Error('usePOIs must be used within a POIProvider');
  }
  return context;
}; 