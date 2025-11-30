export type LocationType = 'cafe' | 'library';

export type BusinessLevel = 'low' | 'moderate' | 'high';

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  lat: number;
  lng: number;
  busyness: BusinessLevel;
  likelihood: number; // 0-100
  openUntil?: string;
  hasWifi: boolean;
}
