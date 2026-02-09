import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { LOCATIONS } from './constants';
import { fetchRainfallData } from './services/weatherService';
import { ProcessedData, Location } from './types';
import Scene from './components/Scene';

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [weatherData, setWeatherData] = useState<ProcessedData[]>([]);
  const [loading, setLoading] = useState(false);

  const totalRain = weatherData.reduce((sum, d) => sum + d.value, 0);
  const maxRain = weatherData.length > 0 ? Math.max(...weatherData.map(d => d.value)) : 0;
  const rainyDays = weatherData.filter(d => d.value > 0).length;

  useEffect(() => {
    if (!selectedLocation) return;
    const loadData = async () => {
      setLoading(true);
      const data = await fetchRainfallData(selectedLocation.lat, selectedLocation.lon);
      setWeatherData(data);
      setLoading(false);
    };
    loadData();
  }, [selectedLocation]);

  return (
    <div className="app-container">
      {/* 3D Canvas */}
      <div className="canvas-layer">
        <Canvas gl={{ antialias: true, alpha: false }} dpr={[1, 2]} frameloop="always">
          <color attach="background" args={['#030610']} />
          <Suspense fallback={null}>
            <Scene data={weatherData} loading={loading} />
          </Suspense>
        </Canvas>
      </div>

      {/* UI Overlay */}
      <div className="ui-overlay">
        {/* Header */}
        <header className="header">
          <div className="brand">
            <h1 className="brand-title">
              <span className="brand-light">RAIN</span><span className="brand-accent">SCAPE</span>
            </h1>
            <div className="brand-subtitle">
              <span className="brand-line"></span>
              <span>ATMOSPHERIC DATA VISUALIZATION</span>
              <span className="brand-line"></span>
            </div>
          </div>
          
          <div className="controls">
            <div className="select-wrapper">
              <select 
                className="location-select"
                value={selectedLocation?.name || ""}
                onChange={(e) => {
                  const loc = LOCATIONS.find(l => l.name === e.target.value);
                  if (loc) setSelectedLocation(loc);
                }}
              >
                <option value="" disabled>Select Location...</option>
                {LOCATIONS.map(loc => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name.toUpperCase()}
                  </option>
                ))}
              </select>
              <svg className="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </header>

        {/* Stats barselectedLocation &&  */}
        {!loading && weatherData.length > 0 && (
          <div className="stats-bar">
            <div className="stat">
              <span className="stat-value">{totalRain.toFixed(1)}<span className="stat-unit">mm</span></span>
              <span className="stat-label">TOTAL</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">{maxRain.toFixed(1)}<span className="stat-unit">mm</span></span>
              <span className="stat-label">PEAK</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">{rainyDays}<span className="stat-unit">/{weatherData.length}</span></span>
              <span className="stat-label">RAINY DAYS</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          <div className="footer-left">
            {selectedLocation && (
              <>
                <span className="coord">{selectedLocation.lat.toFixed(4)}°N</span>
                <span className="coord-sep">/</span>
                <span className="coord">{selectedLocation.lon.toFixed(4)}°E</span>
              </>
            )}
          </div>
          <div className="footer-center">
            <span className="created-by">Created by Shahnab</span>
          </div>
          <div className="footer-right">
            <span className="source-badge">
              <span className="source-dot"></span>
              {loading ? 'SYNCING' : 'LIVE'}
            </span>
            <span className="source-text">OPEN-METEO</span>
          </div>
        </footer>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-overlay">
          <div className="loader">
            <div className="loader-ring"></div>
            <div className="loader-ring loader-ring-2"></div>
            <span className="loader-text">FETCHING DATA</span>
          </div>
        </div>
      )}
    </div>
  );
}