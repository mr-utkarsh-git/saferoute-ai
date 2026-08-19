import React from 'react';
import { Map } from 'lucide-react';
import type { Coordinate, DeviationState } from '../services/deviationDetector';
import type { CommunityReportInput } from '../services/validation';

interface SafetyMapProps {
  routeCoordinates: Coordinate[];
  currentLocation: Coordinate | null;
  deviationState: DeviationState;
  reports: Array<CommunityReportInput & { timestamp: string }>;
  routeName: string;
}

export const SafetyMap: React.FC<SafetyMapProps> = ({
  routeCoordinates,
  currentLocation,
  deviationState,
  reports,
  routeName
}) => {
  // Bounding coordinate references
  const baseLat = 12.9716;
  const baseLng = 77.5946;

  // SVG bounding dimensions
  const width = 450;
  const height = 280;

  // Grid coordinates mapping parameters
  const minLat = 12.9710;
  const maxLat = 12.9760;
  const minLng = 77.5940;
  const maxLng = 77.6000;

  // Projects a lat/lng coordinate into SVG viewport pixel coordinates
  const project = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * (width - 40) + 20;
    // Invert y since SVG 0 is at the top
    const y = height - (((lat - minLat) / (maxLat - minLat)) * (height - 40) + 20);
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Pre-defined static landmarks on campus map
  const landmarks = [
    { name: 'Central Library', lat: 12.9716, lng: 77.5946 },
    { name: 'Academic Blocks', lat: 12.9735, lng: 77.5955 },
    { name: 'Girls Hostel Block B', lat: 12.9756, lng: 77.5986 },
    { name: 'Industrial Crossing', lat: 12.9745, lng: 77.5942 },
    { name: 'Sports Field', lat: 12.9722, lng: 77.5975 }
  ];

  // Projected coordinates of the planned route points
  const points = routeCoordinates.map(pt => project(pt.lat, pt.lng));

  // Planned route line string for polyline
  const polylinePoints = points.map(pt => `${pt.x},${pt.y}`).join(' ');

  // Projected coordinate of the current user location
  const userPt = currentLocation ? project(currentLocation.lat, currentLocation.lng) : null;

  // Check if route contains specific hazards/risk characteristics
  const isIndustrial = routeName.includes('Industrial');
  const isResidential = routeName.includes('Residential');

  // Draw simulated unlit zone overlays based on active path
  const hazardZones = [
    { name: 'Campus North Alleyway (Unlit)', lat: 12.9745, lng: 77.5980, radius: 24, type: 'light' },
    { name: 'Industrial Crossing Zone (Deserted)', lat: 12.9740, lng: 77.5942, radius: 30, type: 'isolation' }
  ];

  return (
    <div className="card" style={{ gap: '0.75rem' }}>
      <div className="card-header">
        <h2 className="card-title">
          <Map size={18} style={{ color: '#38bdf8' }} />
          Live Safety Journey Map
        </h2>
        <span className="demo-banner">Dynamic Vector Telemetry</span>
      </div>

      <div style={{ position: 'relative', width: '100%', height: 'auto', backgroundColor: '#0d1324', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" aria-label="Campus safety telemetry map">
          {/* Map Grid background */}
          <defs>
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(41, 53, 79, 0.25)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Landmarks / Campus buildings backgrounds */}
          {landmarks.map((lm, idx) => {
            const pt = project(lm.lat, lm.lng);
            return (
              <g key={idx} opacity="0.6">
                <rect x={pt.x - 12} y={pt.y - 12} width="24" height="24" rx="4" fill="var(--bg-tertiary)" stroke="var(--border-color)" strokeWidth="1" />
                <text x={pt.x} y={pt.y + 24} textAnchor="middle" fill="var(--text-muted)" fontSize="8.5" fontWeight="500">
                  {lm.name}
                </text>
              </g>
            );
          })}

          {/* Simulated Environmental Hazard Zones */}
          {hazardZones.map((zone, idx) => {
            const pt = project(zone.lat, zone.lng);
            const fillColor = zone.type === 'light' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.06)';
            const strokeColor = zone.type === 'light' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.15)';
            return (
              <g key={idx}>
                <circle cx={pt.x} cy={pt.y} r={zone.radius} fill={fillColor} stroke={strokeColor} strokeDasharray="3 3" />
                <circle cx={pt.x} cy={pt.y} r="2" fill={strokeColor} />
              </g>
            );
          })}

          {/* Planned route path polyline */}
          {routeCoordinates.length > 0 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={isIndustrial ? 'var(--color-high)' : isResidential ? 'var(--color-caution)' : 'var(--color-safe)'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
          )}

          {/* Dotted path representing points when user deviates */}
          {userPt && deviationState !== 'NORMAL' && points.length > 0 && (
            <line
              x1={userPt.x}
              y1={userPt.y}
              x2={points[0].x} // draw reference vector back to start path point
              y2={points[0].y}
              stroke="var(--color-high)"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.8"
            />
          )}

          {/* Community safety report pins */}
          {reports.map((rep, idx) => {
            // Generate deterministic mock lat/lng coordinates based on report description to position them on map
            let repLat = baseLat + 0.003;
            let repLng = baseLng + 0.004;
            
            if (rep.location.includes('North') || rep.category.includes('lighting')) {
              repLat = baseLat + 0.0035;
              repLng = baseLng + 0.0035;
            } else if (rep.location.includes('Industrial') || rep.location.includes('Crossing')) {
              repLat = baseLat + 0.0028;
              repLng = baseLng + 0.001;
            } else if (rep.location.includes('Hostel')) {
              repLat = baseLat + 0.005;
              repLng = baseLng + 0.004;
            }

            const repPt = project(repLat, repLng);
            return (
              <g key={idx} cursor="help">
                <title>{`${rep.category}: ${rep.description}`}</title>
                <circle cx={repPt.x} cy={repPt.y} r="6" fill="var(--color-caution)" opacity="0.3" className="sos-pulse-active" />
                <path d={`M ${repPt.x} ${repPt.y - 8} L ${repPt.x - 5} ${repPt.y} L ${repPt.x + 5} ${repPt.y} Z`} fill="var(--color-caution)" />
              </g>
            );
          })}

          {/* Pulsing Active User Marker */}
          {userPt && (
            <g>
              {/* Outer pulsing radar ring */}
              <circle
                cx={userPt.x}
                cy={userPt.y}
                r={deviationState === 'HIGH' ? '18' : '12'}
                fill="none"
                stroke={deviationState === 'HIGH' ? 'var(--color-high)' : deviationState === 'WARNING' ? 'var(--color-caution)' : 'var(--color-safe)'}
                strokeWidth="2"
                opacity="0.6"
              >
                <animate attributeName="r" values="6;20" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
              </circle>

              {/* Solid inner marker circle */}
              <circle
                cx={userPt.x}
                cy={userPt.y}
                r="6"
                fill={deviationState === 'HIGH' ? 'var(--color-high)' : deviationState === 'WARNING' ? 'var(--color-caution)' : 'var(--color-safe)'}
                stroke="white"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Map Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '10px', height: '4px', backgroundColor: 'var(--color-safe)', display: 'inline-block', borderRadius: '2px' }} />
          <span>Grand Avenue (Safe)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '10px', height: '4px', backgroundColor: 'var(--color-high)', display: 'inline-block', borderRadius: '2px' }} />
          <span>Industrial Path (Risk)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-safe)', display: 'inline-block', border: '1.5px solid white' }} />
          <span>User Location (Safe)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <path d="M 0 5 L 10 5" stroke="var(--color-high)" strokeWidth="1.5" strokeDasharray="2 2" style={{ display: 'inline-block', width: '12px' }} />
          <span style={{ marginLeft: '4px' }}>Deviation Vector</span>
        </div>
      </div>
    </div>
  );
};
