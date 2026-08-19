import { describe, it, expect } from 'vitest';
import {
  calculateRiskScore,
  classifyRiskLevel,
  DEFAULT_RISK_WEIGHTS
} from '../services/riskEngine';
import type { RiskFactors } from '../services/riskEngine';
import {
  detectDeviation
} from '../services/deviationDetector';
import type { Coordinate } from '../services/deviationDetector';
import {
  startJourney,
  tickCheckIn,
  confirmCheckIn,
  triggerSos,
  recoverFromSos,
  advanceSimulationStep,
  INITIAL_JOURNEY_STATE
} from '../services/journeyManager';
import type { JourneyState } from '../services/journeyManager';
import {
  validateCommunityReport,
  validateTrustedContact,
  sanitizeString
} from '../services/validation';
import {
  generateLocalSafetyRecommendation
} from '../services/aiService';
import type { SafetyContext } from '../services/aiService';

describe('SafeRoute AI Core Safety Suite', () => {

  // 1. Risk Score Calculation Tests
  describe('Risk Score Calculation', () => {
    it('should compute score correctly using weighted default formula', () => {
      const factors: RiskFactors = {
        incidentReports: 50,
        lighting: 80,
        activity: 40,
        isolation: 70,
        timeOfDay: 90,
        recentSignals: 30
      };
      
      // Expected: 50*0.30 + 80*0.20 + 40*0.15 + 70*0.15 + 90*0.10 + 30*0.10
      // 15 + 16 + 6 + 10.5 + 9 + 3 = 59.5 => rounded to 60
      const score = calculateRiskScore(factors, DEFAULT_RISK_WEIGHTS);
      expect(score).toBe(60);
    });

    it('should clamp scores to minimum of 0 and maximum of 100', () => {
      const lowFactors: RiskFactors = {
        incidentReports: 0, lighting: 0, activity: 0, isolation: 0, timeOfDay: 0, recentSignals: 0
      };
      const highFactors: RiskFactors = {
        incidentReports: 100, lighting: 100, activity: 100, isolation: 100, timeOfDay: 100, recentSignals: 100
      };
      expect(calculateRiskScore(lowFactors)).toBe(0);
      expect(calculateRiskScore(highFactors)).toBe(100);
    });
  });

  // 2. Risk Classification Tests
  describe('Risk Classification', () => {
    it('should correctly classify risk levels based on scores', () => {
      expect(classifyRiskLevel(10)).toBe('SAFE');
      expect(classifyRiskLevel(25)).toBe('SAFE');
      expect(classifyRiskLevel(35)).toBe('CAUTION');
      expect(classifyRiskLevel(50)).toBe('CAUTION');
      expect(classifyRiskLevel(60)).toBe('ELEVATED RISK');
      expect(classifyRiskLevel(75)).toBe('ELEVATED RISK');
      expect(classifyRiskLevel(80)).toBe('HIGH RISK');
      expect(classifyRiskLevel(100)).toBe('HIGH RISK');
    });

    it('should prioritize SOS ACTIVE status over numeric risk level', () => {
      expect(classifyRiskLevel(10, true)).toBe('SOS ACTIVE');
      expect(classifyRiskLevel(95, true)).toBe('SOS ACTIVE');
    });
  });

  // 3. Route Recommendation Test (Mocking safety/speed balance logic)
  describe('Route Recommendation Tradeoffs', () => {
    it('should prefer a safer route over a slightly faster but high-risk route', () => {
      // Mock routes representation
      const routes = [
        { name: 'Route A (Safe but long)', risk: 20, duration: 18 },
        { name: 'Route B (Moderate)', risk: 50, duration: 12 },
        { name: 'Route C (Dangerous but fast)', risk: 80, duration: 10 }
      ];

      // Recommendation algorithm selects the route that minimizes: Risk * 1.5 + Duration * 1.0
      const selectBestRoute = (rList: typeof routes) => {
        return rList.reduce((best, current) => {
          const bestScore = best.risk * 1.5 + best.duration;
          const currentScore = current.risk * 1.5 + current.duration;
          return currentScore < bestScore ? current : best;
        });
      };

      const recommended = selectBestRoute(routes);
      expect(recommended.name).toBe('Route A (Safe but long)');
    });
  });

  // 4. Route Deviation Detection Tests
  describe('Route Deviation Detection', () => {
    const mockRoute: Coordinate[] = [
      { lat: 12.9716, lng: 77.5946 }, // Point 1
      { lat: 12.9726, lng: 77.5956 }, // Point 2
      { lat: 12.9736, lng: 77.5966 }  // Point 3
    ];

    it('should return NORMAL when current location is close to path', () => {
      const currentLoc = { lat: 12.9716, lng: 77.5946 }; // exactly on Point 1
      const report = detectDeviation(currentLoc, mockRoute, 20);
      expect(report.state).toBe('NORMAL');
      expect(report.distance).toBe(0);
    });

    it('should trigger WARNING when user exceeds warning threshold', () => {
      // Offset by approx 70m
      const offLoc = { lat: 12.9720, lng: 77.5951 }; 
      const report = detectDeviation(offLoc, mockRoute, 20, 50, 120);
      expect(report.state).toBe('WARNING');
      expect(report.distance).toBeGreaterThanOrEqual(50);
    });

    it('should trigger HIGH when deviation is severe or combined with high risk zone', () => {
      const offLoc = { lat: 12.9720, lng: 77.5951 }; // ~60m off
      // Safe zone => warning
      const normalReport = detectDeviation(offLoc, mockRoute, 20, 50, 120);
      expect(normalReport.state).toBe('WARNING');

      // Elevated risk zone (risk >= 50) => transitions WARNING to HIGH
      const highReport = detectDeviation(offLoc, mockRoute, 60, 50, 120);
      expect(highReport.state).toBe('HIGH');
    });
  });

  // 5. Check-In State Transition Tests
  describe('Check-In State Transitions', () => {
    it('should transition from IDLE to ACTIVE when starting a journey', () => {
      const routePoints = [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }];
      const state = startJourney(INITIAL_JOURNEY_STATE, 'Home Path', routePoints, '22:30', 60);

      expect(state.status).toBe('ACTIVE');
      expect(state.routeName).toBe('Home Path');
      expect(state.checkInCountdown).toBe(60);
      expect(state.lastCheckInTime).not.toBeNull();
      expect(state.timeline.length).toBe(1);
    });

    it('should reset countdown timer when confirming check-in', () => {
      let state = startJourney(INITIAL_JOURNEY_STATE, 'Home Path', [{ lat: 0, lng: 0 }], '22:30', 60);
      state = { ...state, checkInCountdown: 15 }; // count down to 15s

      const checkedInState = confirmCheckIn(state);
      expect(checkedInState.status).toBe('ACTIVE');
      expect(checkedInState.checkInCountdown).toBe(60); // restored to interval
    });
  });

  // 6. Missed Check-In Detection Tests
  describe('Missed Check-In Detection', () => {
    it('should transition to CHECKIN_MISSED when countdown hits 0', () => {
      let state = startJourney(INITIAL_JOURNEY_STATE, 'Home Path', [{ lat: 0, lng: 0 }], '22:30', 60);
      
      // Simulate ticking down remaining 60 seconds
      state = tickCheckIn(state, 60);
      
      expect(state.status).toBe('CHECKIN_MISSED');
      expect(state.checkInCountdown).toBe(0);
      expect(state.timeline[state.timeline.length - 1].event).toContain('check-in was missed');
    });
  });

  // 7. SOS State Transition Tests
  describe('SOS State Transitions', () => {
    it('should trigger SOS active and update state flags immediately', () => {
      let state = startJourney(INITIAL_JOURNEY_STATE, 'Home Path', [{ lat: 0, lng: 0 }], '22:30', 60);
      state = triggerSos(state);

      expect(state.status).toBe('SOS_ACTIVE');
      expect(state.sosState).toBe(true);
      expect(state.timeline[state.timeline.length - 1].event).toContain('SOS active');
    });

    it('should recover from SOS back to ACTIVE if requested to resume', () => {
      let state = startJourney(INITIAL_JOURNEY_STATE, 'Home Path', [{ lat: 0, lng: 0 }], '22:30', 60);
      state = triggerSos(state);

      const recovered = recoverFromSos(state, true);
      expect(recovered.status).toBe('ACTIVE');
      expect(recovered.sosState).toBe(false);
    });
  });

  // 8. Alert Escalation Simulation
  describe('Alert Escalation Simulation', () => {
    it('should generate correct escalation message when check-in is missed', () => {
      const context: SafetyContext = {
        currentTime: '23:30',
        routeName: 'Campus Link',
        routeRiskScore: 40,
        routeRiskLevel: 'CAUTION',
        lighting: 30,
        activity: 40,
        isolation: 20,
        communityReportsCount: 0,
        journeyStatus: 'CHECKIN_MISSED',
        expectedArrivalTime: '23:45',
        checkInStatus: 'MISSED',
        deviationState: 'NORMAL',
        deviationDistance: 0,
        sosState: false,
        userType: 'Student'
      };

      const assessment = generateLocalSafetyRecommendation(context);
      expect(assessment.riskLevel).toBe('HIGH RISK');
      expect(assessment.escalationRecommendation).toContain('trusted contacts');
    });
  });

  // 9. Community Report Validation Tests
  describe('Community Report Validation', () => {
    it('should validate valid report inputs successfully', () => {
      const report = {
        category: 'poor lighting',
        severity: 4,
        description: 'Streetlights are broken for 2 blocks.',
        location: 'Sector 4 Hostel Lane'
      };

      const result = validateCommunityReport(report);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should fail validation with descriptive errors for invalid inputs', () => {
      const invalidReport = {
        category: 'crime wave', // invalid category
        severity: 6, // invalid severity (>5)
        description: 'Bad', // too short
        location: '' // empty location
      };

      const result = validateCommunityReport(invalidReport);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(4);
    });

    it('should sanitize HTML tokens correctly to prevent XSS injection', () => {
      const dirtyHtml = '<script>alert("XSS")</script>';
      const clean = sanitizeString(dirtyHtml);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });
  });

  // 10. Trusted Contact Validation Tests
  describe('Trusted Contact Validation', () => {
    it('should validate correctly when name, relation, and email/phone are valid', () => {
      const contact = {
        name: 'Jane Doe',
        relationship: 'Mother',
        email: 'jane@example.com',
        phone: '+1234567890'
      };

      const result = validateTrustedContact(contact);
      expect(result.isValid).toBe(true);
    });

    it('should fail if both email and phone are empty', () => {
      const contact = {
        name: 'Jane Doe',
        relationship: 'Mother',
        email: '',
        phone: ''
      };

      const result = validateTrustedContact(contact);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('at least an email address or a phone number');
    });

    it('should fail if phone format is illegal', () => {
      const contact = {
        name: 'Jane Doe',
        relationship: 'Mother',
        email: '',
        phone: 'abcdef' // letters not allowed in phone validation
      };

      const result = validateTrustedContact(contact);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid phone number format');
    });
  });

  // 11. Contextual AI Recommendation Engine Fallback Tests
  describe('Contextual AI Recommendation Engine Fallback', () => {
    it('should generate appropriate guidance for late night + low lighting route context', () => {
      const context: SafetyContext = {
        currentTime: '23:30', // Late night
        routeName: 'Back Alley',
        routeRiskScore: 65,
        routeRiskLevel: 'ELEVATED RISK',
        lighting: 75, // Poor lighting
        activity: 80, // Low activity
        isolation: 70,
        communityReportsCount: 2,
        journeyStatus: 'ACTIVE',
        expectedArrivalTime: '23:50',
        checkInStatus: 'PENDING',
        deviationState: 'NORMAL',
        deviationDistance: 0,
        sosState: false,
        userType: 'Solo Traveller'
      };

      const advice = generateLocalSafetyRecommendation(context);
      expect(advice.situationAssessment).toContain('Late-night travel');
      expect(advice.recommendedAction).toContain('earphones'); // standard safety warning
      expect(advice.isRealAi).toBe(false);
    });
  });

  // 12. Edge Cases Tests
  describe('Edge Cases', () => {
    it('should handle zero route coordinates gracefully in deviation check', () => {
      const report = detectDeviation({ lat: 0, lng: 0 }, [], 10);
      expect(report.state).toBe('NORMAL');
      expect(report.distance).toBe(0);
    });

    it('should handle zero coordinates in journey state advance simulation', () => {
      let state: JourneyState = { ...INITIAL_JOURNEY_STATE, status: 'ACTIVE' };
      state = advanceSimulationStep(state);
      expect(state.currentLocationIndex).toBe(0);
      expect(state.currentLocation).toBeNull();
    });
  });
});
