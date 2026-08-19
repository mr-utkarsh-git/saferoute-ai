export interface RiskFactors {
  incidentReports: number; // 0 to 100 based on density/severity of reports in the area
  lighting: number;        // 0 to 100 where 0 is well-lit, 100 is pitch black
  activity: number;        // 0 to 100 where 0 is high pedestrian flow, 100 is completely deserted
  isolation: number;       // 0 to 100 where 0 is busy/open street, 100 is dark alleys/isolated spots
  timeOfDay: number;       // 0 to 100 where 0 is broad daylight, 100 is middle of the night (e.g., 2 AM)
  recentSignals: number;   // 0 to 100 where 0 is normal, 100 is high deviation/SOS events active nearby
}

export interface RiskWeightConfig {
  incidentReports: number;
  lighting: number;
  activity: number;
  isolation: number;
  timeOfDay: number;
  recentSignals: number;
}

// Default weights summing up to 1.0 (100%)
export const DEFAULT_RISK_WEIGHTS: RiskWeightConfig = {
  incidentReports: 0.30,
  lighting: 0.20,
  activity: 0.15,
  isolation: 0.15,
  timeOfDay: 0.10,
  recentSignals: 0.10,
};

export type RiskLevel = 'SAFE' | 'CAUTION' | 'ELEVATED RISK' | 'HIGH RISK' | 'SOS ACTIVE';

export interface RiskAnalysis {
  score: number;
  level: RiskLevel;
  breakdown: { [key in keyof RiskFactors]: number };
  explanation: string;
}

/**
 * Calculates a normalized risk score from 0 to 100.
 * Formula: Sum(factor * weight) for all factors.
 */
export function calculateRiskScore(
  factors: RiskFactors,
  weights: RiskWeightConfig = DEFAULT_RISK_WEIGHTS
): number {
  const score =
    factors.incidentReports * weights.incidentReports +
    factors.lighting * weights.lighting +
    factors.activity * weights.activity +
    factors.isolation * weights.isolation +
    factors.timeOfDay * weights.timeOfDay +
    factors.recentSignals * weights.recentSignals;

  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Classifies the risk score into standard SafetyNet categories.
 */
export function classifyRiskLevel(score: number, isSosActivated = false): RiskLevel {
  if (isSosActivated) return 'SOS ACTIVE';
  if (score <= 25) return 'SAFE';
  if (score <= 50) return 'CAUTION';
  if (score <= 75) return 'ELEVATED RISK';
  return 'HIGH RISK';
}

/**
 * Generates a structured human-readable explanation of the risk score based on primary drivers.
 */
export function explainRiskScore(factors: RiskFactors, score: number): string {
  const drivers: string[] = [];

  if (factors.timeOfDay > 60) {
    drivers.push("late-night travel");
  }
  if (factors.lighting > 50) {
    drivers.push("poor street lighting");
  }
  if (factors.activity > 60) {
    drivers.push("low pedestrian activity/deserted streets");
  }
  if (factors.isolation > 60) {
    drivers.push("high physical isolation (narrow paths or alleys)");
  }
  if (factors.incidentReports > 40) {
    drivers.push("elevated community incident reports in the vicinity");
  }
  if (factors.recentSignals > 50) {
    drivers.push("recent active safety alerts or route deviations nearby");
  }

  if (score <= 25) {
    return "This route is classified as SAFE. It features bright lighting, active crowds, and zero recent security alerts.";
  }

  const driverText = drivers.length > 0 
    ? `driven primarily by ${drivers.join(', ')}`
    : "based on standard baseline safety metrics";

  return `This route has an risk score of ${score}/100 (${classifyRiskLevel(score)}), ${driverText}. Exercise appropriate vigilance and consider staying on major avenues.`;
}
