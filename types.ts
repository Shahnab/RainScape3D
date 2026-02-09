export interface WeatherData {
  time: string[];
  rain_sum: number[];
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
}

export interface ProcessedData {
  date: string;
  value: number;
  label: string;
}