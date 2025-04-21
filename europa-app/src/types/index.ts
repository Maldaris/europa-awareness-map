// POI data model
export interface POI {
  id: string;
  title: string;
  description: string;
  location?: string;
  lat: number;
  lng: number;
  type: 'poi' | 'orientation' | 'pole' | 'custom';
  category?: string; // For grouping/filtering
  icon?: string; // For custom icons
}

// Marker category enum - maps internal values to human-readable names
export enum MarkerCategory {
  TERRAIN = 'terrain',
  IMPACT = 'impact',
  LANDMARK = 'landmark',
  NAVIGATION = 'navigation',
  ORIENTATION = 'orientation',
  CUSTOM = 'custom',
  USER = 'user'
}

// Human-readable labels for marker categories
export const MarkerCategoryLabels: Record<MarkerCategory, string> = {
  [MarkerCategory.TERRAIN]: 'Terrain Feature',
  [MarkerCategory.IMPACT]: 'Impact Site',
  [MarkerCategory.LANDMARK]: 'Landmark',
  [MarkerCategory.NAVIGATION]: 'Navigation Point',
  [MarkerCategory.ORIENTATION]: 'Orientation Marker',
  [MarkerCategory.CUSTOM]: 'Custom Marker',
  [MarkerCategory.USER]: 'User Marker'
};

// POI collection
export interface POICollection {
  pois: POI[];
  version: string;
  lastUpdated: string;
} 