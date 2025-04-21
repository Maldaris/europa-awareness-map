import React, { useState, useEffect, useMemo } from 'react';
import '../styles/UIOverlay.css';
import { MarkerCategory, MarkerCategoryLabels } from '../types';

interface UIOverlayProps {
  layerVisibility: {
    gridLines: boolean;
    equator: boolean;
    poles: boolean;
    poi: boolean;
  };
  onLayerToggle: (layer: string, visible: boolean) => void;
  onMarkerModeToggle: () => void;
  isMarkerMode: boolean;
  onCreateMarker: (title: string, description: string, category: string) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
  layerVisibility,
  onLayerToggle,
  onMarkerModeToggle,
  isMarkerMode,
  onCreateMarker
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMarkerTitle, setNewMarkerTitle] = useState('');
  const [newMarkerDescription, setNewMarkerDescription] = useState('');
  const [newMarkerCategory, setNewMarkerCategory] = useState<string>(MarkerCategory.LANDMARK);

  // Define which categories to show in the dropdown
  const visibleCategories = useMemo(() => {
    // Filter out USER and ORIENTATION, keep other categories
    return Object.entries(MarkerCategoryLabels)
      .filter(([key]) => 
        key !== MarkerCategory.USER && 
        key !== MarkerCategory.ORIENTATION
      )
      .map(([key, value]) => ({
        value: key,
        // Change "Custom Marker" label to "Other"
        label: key === MarkerCategory.CUSTOM ? 'Other' : value
      }));
  }, []);

  // Open modal when marker data is available
  useEffect(() => {
    if (isMarkerMode) {
      const handleMarkerClick = () => {
        setIsModalOpen(true);
      };
      
      window.addEventListener('marker-selected', handleMarkerClick as EventListener);
      
      return () => {
        window.removeEventListener('marker-selected', handleMarkerClick as EventListener);
      };
    }
  }, [isMarkerMode]);

  const handleLayerToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    onLayerToggle(name, checked);
  };

  const handleMarkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMarkerTitle.trim()) {
      onCreateMarker(newMarkerTitle, newMarkerDescription, newMarkerCategory);
      setNewMarkerTitle('');
      setNewMarkerDescription('');
      setNewMarkerCategory(MarkerCategory.LANDMARK);
      setIsModalOpen(false);
    }
  };

  const handleCancelMarker = () => {
    setIsModalOpen(false);
    onMarkerModeToggle(); // Exit marker mode
  };

  return (
    <>
      <div className="ui-overlay">
        <div className="layer-controls">
          <h3>Layers</h3>
          <div className="control-item">
            <input 
              type="checkbox" 
              id="gridLines"
              name="gridLines"
              checked={layerVisibility.gridLines}
              onChange={handleLayerToggle}
            />
            <label htmlFor="gridLines">Grid Lines</label>
          </div>
          <div className="control-item">
            <input 
              type="checkbox" 
              id="equator"
              name="equator"
              checked={layerVisibility.equator}
              onChange={handleLayerToggle}
            />
            <label htmlFor="equator">Equator</label>
          </div>
          <div className="control-item">
            <input 
              type="checkbox" 
              id="poles"
              name="poles"
              checked={layerVisibility.poles}
              onChange={handleLayerToggle}
            />
            <label htmlFor="poles">Poles</label>
          </div>
          <div className="control-item">
            <input 
              type="checkbox" 
              id="poi"
              name="poi"
              checked={layerVisibility.poi}
              onChange={handleLayerToggle}
            />
            <label htmlFor="poi">Points of Interest</label>
          </div>
        </div>

        <div className="marker-tools">
          <h3>Tools</h3>
          <button 
            className={`marker-button ${isMarkerMode ? 'active' : ''}`}
            onClick={onMarkerModeToggle}
          >
            {isMarkerMode ? 'Cancel Marker' : 'Add Marker'}
          </button>
          {isMarkerMode && (
            <div className="hint-text">
              Click on the globe to place a marker
            </div>
          )}
        </div>
      </div>

      {/* Modal for creating a new marker */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>New Marker</h2>
            <form onSubmit={handleMarkerSubmit}>
              <div className="form-group">
                <label htmlFor="markerTitle">Title</label>
                <input
                  type="text"
                  id="markerTitle"
                  value={newMarkerTitle}
                  onChange={(e) => setNewMarkerTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="markerDescription">Description</label>
                <textarea
                  id="markerDescription"
                  value={newMarkerDescription}
                  onChange={(e) => setNewMarkerDescription(e.target.value)}
                  rows={4}
                ></textarea>
              </div>
              <div className="form-group">
                <label htmlFor="markerCategory">Category</label>
                <select
                  id="markerCategory"
                  value={newMarkerCategory}
                  onChange={(e) => setNewMarkerCategory(e.target.value)}
                  required
                >
                  {visibleCategories.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-buttons">
                <button type="button" onClick={handleCancelMarker}>
                  Cancel
                </button>
                <button type="submit">Create Marker</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default UIOverlay; 