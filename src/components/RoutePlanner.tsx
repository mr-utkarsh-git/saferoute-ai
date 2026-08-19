import React, { useState, useEffect } from 'react';
import { Navigation, Clock, ShieldCheck, Shield } from 'lucide-react';
import type { Coordinate } from '../services/deviationDetector';
import { calculateRiskScore, classifyRiskLevel } from '../services/riskEngine';
import type { RiskFactors } from '../services/riskEngine';

interface RoutePlannerProps {
  onStartJourney: (routeName: string, coordinates: Coordinate[], eta: string) => void;
  activeJourney: boolean;
  communityReportsCount: number;
}

interface RouteOption {
  id: string;
  name: string;
  duration: number; // minutes
  distance: number; // km
  factors: RiskFactors;
  coordinates: Coordinate[];
}

export const RoutePlanner: React.FC<RoutePlannerProps> = ({
  onStartJourney,
  activeJourney,
  communityReportsCount
}) => {
  const [source, setSource] = useState('Central Library');
  const [destination, setDestination] = useState('Green Hostel Block B');
  const [travelMode, setTravelMode] = useState('walking');
  const [time, setTime] = useState('22:00');
  const [selectedRouteId, setSelectedRouteId] = useState('route-a');
  const [routes, setRoutes] = useState<RouteOption[]>([]);

  // Coordinates base points
  const baseLat = 12.9716;
  const baseLng = 77.5946;

  // Generate route options whenever inputs change
  useEffect(() => {
    // Generate coordinate segments dynamically for simulation
    const routeAPoints: Coordinate[] = [
      { lat: baseLat, lng: baseLng },
      { lat: baseLat + 0.001, lng: baseLng + 0.001 },
      { lat: baseLat + 0.002, lng: baseLng + 0.002 },
      { lat: baseLat + 0.003, lng: baseLng + 0.003 },
      { lat: baseLat + 0.004, lng: baseLng + 0.004 },
    ];

    const routeBPoints: Coordinate[] = [
      { lat: baseLat, lng: baseLng },
      { lat: baseLat + 0.001, lng: baseLng + 0.0005 },
      { lat: baseLat + 0.002, lng: baseLng + 0.001 },
      { lat: baseLat + 0.003, lng: baseLng + 0.0015 },
      { lat: baseLat + 0.004, lng: baseLng + 0.002 },
    ];

    const routeCPoints: Coordinate[] = [
      { lat: baseLat, lng: baseLng },
      { lat: baseLat + 0.0015, lng: baseLng },
      { lat: baseLat + 0.003, lng: baseLng },
      { lat: baseLat + 0.004, lng: baseLng + 0.0005 },
    ];

    // Determine time-of-day risk component (0-100)
    let timeRisk = 10;
    try {
      const hours = parseInt(time.split(':')[0], 10);
      if (hours >= 20 || hours < 5) timeRisk = 85;
      else if (hours >= 17 || hours < 20) timeRisk = 45;
    } catch {
      timeRisk = 10;
    }

    // Community Reports add risk to all routes, particularly unlit/isolated ones
    const reportRiskOffset = Math.min(25, communityReportsCount * 5);

    const routeA: RouteOption = {
      id: 'route-a',
      name: 'Grand Avenue Link (Recommended Safest)',
      duration: 16,
      distance: 1.8,
      factors: {
        incidentReports: Math.max(0, 10 + reportRiskOffset * 0.2),
        lighting: 15,
        activity: 10, // low value means high activity
        isolation: 10,
        timeOfDay: timeRisk * 0.5,
        recentSignals: 10
      },
      coordinates: routeAPoints
    };

    const routeB: RouteOption = {
      id: 'route-b',
      name: 'Residential Alley & Lane',
      duration: 11,
      distance: 1.2,
      factors: {
        incidentReports: Math.max(0, 30 + reportRiskOffset * 0.6),
        lighting: 45,
        activity: 50,
        isolation: 40,
        timeOfDay: timeRisk * 0.8,
        recentSignals: 20
      },
      coordinates: routeBPoints
    };

    const routeC: RouteOption = {
      id: 'route-c',
      name: 'Industrial Backpath (Shortest)',
      duration: 7,
      distance: 0.8,
      factors: {
        incidentReports: Math.max(0, 70 + reportRiskOffset),
        lighting: 85,
        activity: 90, // very deserted
        isolation: 85,
        timeOfDay: timeRisk,
        recentSignals: 40
      },
      coordinates: routeCPoints
    };

    setRoutes([routeA, routeB, routeC]);
  }, [time, communityReportsCount]);

  const handleStart = () => {
    const selectedRoute = routes.find(r => r.id === selectedRouteId);
    if (!selectedRoute) return;

    // Calculate dynamic ETA
    const now = new Date();
    now.setMinutes(now.getMinutes() + selectedRoute.duration);
    const etaStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

    onStartJourney(selectedRoute.name, selectedRoute.coordinates, etaStr);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <Navigation size={18} />
          Route Safety Planner
        </h2>
        <span className="demo-banner">Demo Safety Data</span>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="source-select">Starting Point</label>
          <input
            id="source-select"
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={activeJourney}
          />
        </div>
        <div className="form-group">
          <label htmlFor="destination-select">Destination</label>
          <input
            id="destination-select"
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            disabled={activeJourney}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="time-select">Departure Time</label>
          <input
            id="time-select"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={activeJourney}
          />
        </div>
        <div className="form-group">
          <label htmlFor="mode-select">Travel Mode</label>
          <select
            id="mode-select"
            value={travelMode}
            onChange={(e) => setTravelMode(e.target.value)}
            disabled={activeJourney}
          >
            <option value="walking">🚶 Walking</option>
            <option value="cycling">🚴 Cycling</option>
            <option value="transit">🚌 Public Transit</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
        <label>Available Route Profiles</label>
        <div className="route-list" role="radiogroup" aria-label="Route options list">
          {routes.map((route) => {
            const riskScore = calculateRiskScore(route.factors);
            const riskLevel = classifyRiskLevel(riskScore);
            const isSelected = selectedRouteId === route.id;

            let badgeClass = 'status-safe';
            if (riskLevel === 'CAUTION') badgeClass = 'status-caution';
            else if (riskLevel === 'ELEVATED RISK') badgeClass = 'status-elevated';
            else if (riskLevel === 'HIGH RISK') badgeClass = 'status-high';

            return (
              <div
                key={route.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={activeJourney ? -1 : 0}
                className={`route-item ${isSelected ? 'selected' : ''}`}
                onClick={() => !activeJourney && setSelectedRouteId(route.id)}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !activeJourney) {
                    e.preventDefault();
                    setSelectedRouteId(route.id);
                  }
                }}
                style={{ opacity: activeJourney && !isSelected ? 0.5 : 1, cursor: activeJourney ? 'not-allowed' : 'pointer' }}
              >
                <div>
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {route.id === 'route-a' && <Shield size={16} style={{ color: 'var(--color-safe)' }} />}
                    {route.name}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {route.duration} min
                    </span>
                    <span>📍 {route.distance} km</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  <span className={`status-badge ${badgeClass}`}>
                    {riskScore} / 100 {riskLevel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!activeJourney ? (
        <button
          onClick={handleStart}
          className="btn-primary"
          style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <ShieldCheck size={18} />
          Start Safety Journey
        </button>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.5rem' }}>
          🔒 Journey is in progress. Safety features are active.
        </div>
      )}
    </div>
  );
};
