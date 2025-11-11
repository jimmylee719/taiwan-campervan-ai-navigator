export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface Position {
  latitude: number;
  longitude: number;
}

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
}

export interface Poi {
  name: string;
  address: string;
  lat: number;
  lng: number;
}