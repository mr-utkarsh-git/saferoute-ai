import type { RiskLevel } from './riskEngine';
import type { DeviationState } from './deviationDetector';

export interface SafetyContext {
  currentTime: string;
  routeName: string;
  routeRiskScore: number;
  routeRiskLevel: RiskLevel;
  lighting: number;        // 0-100
  activity: number;        // 0-100
  isolation: number;       // 0-100
  communityReportsCount: number;
  journeyStatus: 'IDLE' | 'ACTIVE' | 'CHECKIN_MISSED' | 'SOS_ACTIVE';
  expectedArrivalTime: string;
  checkInStatus: 'SAFE' | 'PENDING' | 'MISSED';
  deviationState: DeviationState;
  deviationDistance: number;
  sosState: boolean;
  userType: 'Student' | 'Woman' | 'Hostel Resident' | 'Solo Traveller' | 'Night-Shift Worker' | 'Other';
}

export interface AiSafetyResponse {
  situationAssessment: string;
  riskLevel: RiskLevel;
  reasoning: string;
  recommendedAction: string;
  escalationRecommendation: string;
  isRealAi: boolean; // Tells the UI if it used Gemini or Local Rule Engine
}

/**
 * Deterministic local fallback generator when Gemini API is unavailable or fails.
 */
export function generateLocalSafetyRecommendation(context: SafetyContext): AiSafetyResponse {
  const {
    currentTime,
    routeRiskScore,
    routeRiskLevel,
    lighting,
    activity,
    isolation,
    deviationState,
    deviationDistance,
    sosState,
    userType,
    journeyStatus
  } = context;

  // 1. Determine local assessment based on SOS, Deviation, and Risk factors
  if (sosState || journeyStatus === 'SOS_ACTIVE') {
    return {
      situationAssessment: "EMERGENCY: SOS Beacon Activated.",
      riskLevel: "HIGH RISK",
      reasoning: "The user has triggered an SOS alert or missed their check-in for an extended period.",
      recommendedAction: "Find a secure, public area immediately if possible. Standby for trusted contact contact. Do not move into dark alleys.",
      escalationRecommendation: "Emergency contact protocols are active. Demo notification sent to trusted contacts.",
      isRealAi: false
    };
  }

  if (journeyStatus === 'CHECKIN_MISSED') {
    return {
      situationAssessment: "WARNING: Expected Check-in time has been missed.",
      riskLevel: "HIGH RISK",
      reasoning: "A scheduled safety check-in countdown completed without user confirmation.",
      recommendedAction: "Please tap 'I'm Safe' immediately to check in, or prepare to contact your trusted relations.",
      escalationRecommendation: "If no response within 60 seconds, trusted contacts will receive a demo escalation alert.",
      isRealAi: false
    };
  }

  // Handle route deviation
  if (deviationState === 'HIGH') {
    return {
      situationAssessment: "ALERT: Major Route Deviation Detected in high-risk conditions.",
      riskLevel: "HIGH RISK",
      reasoning: `You are ${deviationDistance}m away from your selected safe path. Combine this with a route risk score of ${routeRiskScore}/100.`,
      recommendedAction: "Turn back toward the designated path immediately. Stay on main, well-lit roads.",
      escalationRecommendation: "Keep phone active. If you feel unsafe, activate the SOS button now.",
      isRealAi: false
    };
  }

  if (deviationState === 'WARNING') {
    return {
      situationAssessment: "CAUTION: Minor Route Deviation Detected.",
      riskLevel: "CAUTION",
      reasoning: `You have moved ${deviationDistance}m away from the recommended path.`,
      recommendedAction: "We recommend checking your map and returning to the planned path to avoid unlit or isolated sections.",
      escalationRecommendation: "Monitor deviation closely. No contact escalation needed yet.",
      isRealAi: false
    };
  }

  // Base on time and environment
  const isLate = isTimeLate(currentTime);
  const isIsolatedOrDark = lighting > 50 || activity > 60 || isolation > 50;

  let situationAssessment = `Travelling as a ${userType} along ${context.routeName || 'selected route'}.`;
  let riskLevel = routeRiskLevel;
  let reasoning = `Route has a calculated risk of ${routeRiskScore}/100.`;
  let recommendedAction = "Proceed with normal travel. SafeRoute is active and monitoring.";
  let escalationRecommendation = "No escalation required. Maintain active check-ins.";

  if (isLate && isIsolatedOrDark) {
    riskLevel = routeRiskScore > 50 ? 'HIGH RISK' : 'ELEVATED RISK';
    situationAssessment = `Late-night travel in low-activity / poorly-lit environment as a ${userType}.`;
    reasoning = `Lighting is poor (${lighting}%) and pedestrian activity is low (${activity}%). Time is ${currentTime}.`;
    recommendedAction = "Keep your head up, avoid wearing earphones, and stay near well-lit storefronts. Prepare to check in shortly.";
    escalationRecommendation = "Advise sharing live demo link with a trusted contact before entering poorly-lit zones.";
  } else if (isLate) {
    situationAssessment = `Late-night travel context for ${userType}.`;
    reasoning = `Calculated route risk is ${routeRiskScore}/100. It is late at night (${currentTime}).`;
    recommendedAction = "Stick to populated avenues. Avoid shortcuts through parks or residential lanes.";
    escalationRecommendation = "Ensure trusted contacts are informed of your ETA.";
  } else if (isIsolatedOrDark) {
    situationAssessment = `Isolated or poorly-lit route segments detected.`;
    reasoning = `Street lighting is low (${lighting}%) or isolation index is high (${isolation}%).`;
    recommendedAction = "Accelerate pace. Stay alert and watch for safe spaces (open shops, kiosks).";
    escalationRecommendation = "No immediate escalation, but set check-in interval to 5 minutes.";
  }

  return {
    situationAssessment,
    riskLevel,
    reasoning,
    recommendedAction,
    escalationRecommendation,
    isRealAi: false
  };
}

/**
 * Checks if the given time string (HH:MM) is late night (e.g. after 8 PM or before 6 AM)
 */
function isTimeLate(timeStr: string): boolean {
  if (!timeStr) return false;
  try {
    const parts = timeStr.split(':');
    if (parts.length < 2) return false;
    const hours = parseInt(parts[0], 10);
    return hours >= 20 || hours < 6;
  } catch {
    return false;
  }
}

/**
 * Fetches safety advice from Gemini API if key is available. Falls back to local engine on error or missing key.
 */
export async function getAiSafetyAdvice(context: SafetyContext): Promise<AiSafetyResponse> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

  if (!apiKey) {
    // Return local recommendation if no API key is set
    return generateLocalSafetyRecommendation(context);
  }

  const prompt = `
  You are an AI Safety Assistant embedded in the "SafeRoute AI" personal safety app.
  Analyze the current safety context of the user and output a JSON response matching the following schema.
  
  CONTEXT:
  - Current Time: ${context.currentTime}
  - Route Name: ${context.routeName}
  - Route Risk Score: ${context.routeRiskScore}/100
  - Route Risk Level: ${context.routeRiskLevel}
  - Lighting Level: ${context.lighting}% (higher is darker/worse)
  - Pedestrian/Crowd Activity: ${context.activity}% (higher is fewer people/deserted)
  - Physical Isolation: ${context.isolation}% (higher is more isolated/alleys)
  - Active Community Reports: ${context.communityReportsCount}
  - Journey Status: ${context.journeyStatus}
  - Expected Arrival Time: ${context.expectedArrivalTime}
  - Check-in Status: ${context.checkInStatus}
  - Deviation State: ${context.deviationState} (distance: ${context.deviationDistance}m)
  - SOS State: ${context.sosState}
  - User Type: ${context.userType}
  
  Please provide safety advice. Respond ONLY with a valid JSON object. Do not include markdown code block formatting (like \`\`\`json) in your raw response.
  
  JSON Structure:
  {
    "situationAssessment": "Short summary of the environment and current user situation.",
    "riskLevel": "SAFE" | "CAUTION" | "ELEVATED RISK" | "HIGH RISK" | "SOS ACTIVE",
    "reasoning": "Logical explanation combining risk score, time of day, deviation, and isolation.",
    "recommendedAction": "Highly actionable advice for personal safety (e.g. 'walk on major streets', 'remove headphones', 'move to safe shelter').",
    "escalationRecommendation": "Clear instruction regarding trusted contacts or alert triggers."
  }
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    const cleanedText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText) as Omit<AiSafetyResponse, 'isRealAi'>;

    return {
      situationAssessment: parsed.situationAssessment || "AI Safety Evaluation Complete.",
      riskLevel: parsed.riskLevel || context.routeRiskLevel,
      reasoning: parsed.reasoning || "Standard model weights evaluated.",
      recommendedAction: parsed.recommendedAction || "Proceed with general precautions.",
      escalationRecommendation: parsed.escalationRecommendation || "Keep check-in timer active.",
      isRealAi: true
    };
  } catch (error) {
    console.warn("Gemini API call failed, using local safety rule engine: ", error);
    return generateLocalSafetyRecommendation(context);
  }
}
