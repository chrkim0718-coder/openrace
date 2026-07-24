export interface CarState {
  lat: number;
  lng: number;
  heading: number; // degrees, 0 = north, clockwise
  speed: number; // km/h
  steerAngle: number; // visual wheel steer -1 to 1
  turbo: boolean; // currently boosting
}

export interface KeysPressed {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  turbo: boolean;
}

export type WeatherMode = 'day' | 'night' | 'rain' | 'snow';

export interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}
