import type { Coordinate } from './deviationDetector';

export type JourneyStatus = 'IDLE' | 'ACTIVE' | 'CHECKIN_MISSED' | 'SOS_ACTIVE';

export interface TimelineEvent {
  time: string; // HH:MM:SS
  event: string;
}

export interface JourneyState {
  status: JourneyStatus;
  routeName: string;
  routeCoordinates: Coordinate[];
  currentLocation: Coordinate | null;
  currentLocationIndex: number;
  expectedArrivalTime: string;
  checkInCountdown: number; // in seconds
  checkInInterval: number;  // in seconds (default 60s for demo speed)
  lastCheckInTime: string | null;
  timeline: TimelineEvent[];
  sosState: boolean;
}

export const INITIAL_JOURNEY_STATE: JourneyState = {
  status: 'IDLE',
  routeName: '',
  routeCoordinates: [],
  currentLocation: null,
  currentLocationIndex: 0,
  expectedArrivalTime: '',
  checkInCountdown: 0,
  checkInInterval: 60,
  lastCheckInTime: null,
  timeline: [],
  sosState: false,
};

/**
 * Formats a Date object to HH:MM:SS
 */
export function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0];
}

/**
 * Starts a new safety journey.
 */
export function startJourney(
  state: JourneyState,
  routeName: string,
  coordinates: Coordinate[],
  eta: string,
  checkInInterval = 60
): JourneyState {
  const nowStr = formatTime(new Date());
  return {
    ...state,
    status: 'ACTIVE',
    routeName,
    routeCoordinates: coordinates,
    currentLocation: coordinates[0] || null,
    currentLocationIndex: 0,
    expectedArrivalTime: eta,
    checkInInterval,
    checkInCountdown: checkInInterval,
    lastCheckInTime: nowStr,
    sosState: false,
    timeline: [
      { time: nowStr, event: `Journey started along route: ${routeName}. ETA: ${eta}` }
    ]
  };
}

/**
 * Simulates ticking the check-in timer down.
 * If timer hits 0, transition to CHECKIN_MISSED.
 */
export function tickCheckIn(state: JourneyState, elapsedSeconds = 1): JourneyState {
  if (state.status !== 'ACTIVE') return state;

  const nextCountdown = Math.max(0, state.checkInCountdown - elapsedSeconds);
  const nowStr = formatTime(new Date());

  if (nextCountdown === 0) {
    return {
      ...state,
      status: 'CHECKIN_MISSED',
      checkInCountdown: 0,
      timeline: [
        ...state.timeline,
        { time: nowStr, event: 'Alert: Scheduled check-in was missed!' }
      ]
    };
  }

  return {
    ...state,
    checkInCountdown: nextCountdown
  };
}

/**
 * Confirms check-in (resets the check-in timer).
 */
export function confirmCheckIn(state: JourneyState): JourneyState {
  if (state.status !== 'ACTIVE' && state.status !== 'CHECKIN_MISSED') return state;

  const nowStr = formatTime(new Date());
  return {
    ...state,
    status: 'ACTIVE',
    checkInCountdown: state.checkInInterval,
    lastCheckInTime: nowStr,
    timeline: [
      ...state.timeline,
      { time: nowStr, event: 'User successfully checked in as SAFE.' }
    ]
  };
}

/**
 * Triggers an SOS event.
 */
export function triggerSos(state: JourneyState): JourneyState {
  const nowStr = formatTime(new Date());
  return {
    ...state,
    status: 'SOS_ACTIVE',
    sosState: true,
    checkInCountdown: 0,
    timeline: [
      ...state.timeline,
      { time: nowStr, event: 'CRITICAL: SOS active. Emergency protocol initiated.' }
    ]
  };
}

/**
 * Cancels or recovers from SOS.
 */
export function recoverFromSos(state: JourneyState, resume = false): JourneyState {
  const nowStr = formatTime(new Date());
  if (resume && state.routeCoordinates.length > 0) {
    return {
      ...state,
      status: 'ACTIVE',
      sosState: false,
      checkInCountdown: state.checkInInterval,
      timeline: [
        ...state.timeline,
        { time: nowStr, event: 'SOS deactivated. Resumed journey.' }
      ]
    };
  } else {
    return {
      ...state,
      status: 'IDLE',
      sosState: false,
      routeName: '',
      routeCoordinates: [],
      currentLocation: null,
      currentLocationIndex: 0,
      expectedArrivalTime: '',
      checkInCountdown: 0,
      lastCheckInTime: null,
      timeline: [
        ...state.timeline,
        { time: nowStr, event: 'SOS deactivated. Journey ended.' }
      ]
    };
  }
}

/**
 * Ends the journey.
 */
export function endJourney(state: JourneyState): JourneyState {
  const nowStr = formatTime(new Date());
  return {
    ...state,
    status: 'IDLE',
    currentLocation: null,
    currentLocationIndex: 0,
    checkInCountdown: 0,
    timeline: [
      ...state.timeline,
      { time: nowStr, event: 'Journey ended by user.' }
    ]
  };
}

/**
 * Simulates moving the user to the next coordinate on the route path.
 */
export function advanceSimulationStep(state: JourneyState): JourneyState {
  if (state.status !== 'ACTIVE' && state.status !== 'CHECKIN_MISSED') return state;
  if (state.routeCoordinates.length === 0) return state;

  const nextIndex = (state.currentLocationIndex + 1) % state.routeCoordinates.length;
  const nextLoc = state.routeCoordinates[nextIndex];
  const nowStr = formatTime(new Date());

  const reachedDestination = nextIndex === state.routeCoordinates.length - 1;

  if (reachedDestination) {
    return {
      ...state,
      currentLocation: nextLoc,
      currentLocationIndex: nextIndex,
      status: 'IDLE',
      checkInCountdown: 0,
      timeline: [
        ...state.timeline,
        { time: nowStr, event: `Arrived safely at destination: ${state.routeName}` }
      ]
    };
  }

  return {
    ...state,
    currentLocation: nextLoc,
    currentLocationIndex: nextIndex,
  };
}
