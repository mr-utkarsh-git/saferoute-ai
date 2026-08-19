export interface Coordinate {
  lat: number;
  lng: number;
}

export type DeviationState = 'NORMAL' | 'WARNING' | 'HIGH';

export interface DeviationReport {
  distance: number; // in meters
  state: DeviationState;
  message: string;
}

/**
 * Calculates distance in meters between two coordinates using the Haversine formula.
 */
export function calculateDistance(p1: Coordinate, p2: Coordinate): number {
  const R = 6371e3; // Earth's radius in meters
  const rad = Math.PI / 180;
  const dLat = (p2.lat - p1.lat) * rad;
  const dLng = (p2.lng - p1.lng) * rad;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * rad) * Math.cos(p2.lat * rad) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the minimum distance from a coordinate to a route (array of coordinates).
 * For simplicity and reliability in a hackathon simulation, we measure distance to the closest route waypoint.
 */
export function getMinDistanceToRoute(currentLoc: Coordinate, route: Coordinate[]): number {
  if (!route || route.length === 0) return 0;
  
  let minDistance = Infinity;
  for (const point of route) {
    const dist = calculateDistance(currentLoc, point);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Evaluates deviation state based on current distance, route risk score, and thresholds.
 * Thresholds:
 * - Warning: distance >= warningThreshold (default 50 meters)
 * - High: distance >= criticalThreshold (default 120 meters) OR (distance >= warningThreshold AND routeRisk >= 50)
 */
export function detectDeviation(
  currentLoc: Coordinate,
  route: Coordinate[],
  routeRisk: number,
  warningThreshold = 50,
  criticalThreshold = 120
): DeviationReport {
  if (!route || route.length === 0) {
    return {
      distance: 0,
      state: 'NORMAL',
      message: 'No active route to check deviation.'
    };
  }

  const distance = Math.round(getMinDistanceToRoute(currentLoc, route));

  let state: DeviationState = 'NORMAL';
  let message = 'User is on the planned path.';

  if (distance >= criticalThreshold) {
    state = 'HIGH';
    message = `Critical deviation! User is ${distance}m off-route. Escalate alert if response is missed.`;
  } else if (distance >= warningThreshold) {
    if (routeRisk >= 50) {
      state = 'HIGH';
      message = `High alert! User is ${distance}m off-route in a Caution/Elevated Risk zone.`;
    } else {
      state = 'WARNING';
      message = `Route deviation detected. User is ${distance}m off the planned path.`;
    }
  }

  return {
    distance,
    state,
    message
  };
}
