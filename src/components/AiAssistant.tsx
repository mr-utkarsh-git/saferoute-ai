import React, { useState, useEffect } from 'react';
import { Eye, Cpu, Sparkles, UserCheck } from 'lucide-react';
import type { JourneyState } from '../services/journeyManager';
import { getAiSafetyAdvice } from '../services/aiService';
import type { SafetyContext, AiSafetyResponse } from '../services/aiService';
import { classifyRiskLevel } from '../services/riskEngine';
import type { DeviationState } from '../services/deviationDetector';

interface AiAssistantProps {
  journeyState: JourneyState;
  routeRiskScore: number;
  deviationState: DeviationState;
  deviationDistance: number;
  communityReportsCount: number;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  journeyState,
  routeRiskScore,
  deviationState,
  deviationDistance,
  communityReportsCount
}) => {
  const [userType, setUserType] = useState<SafetyContext['userType']>('Student');
  const [aiAdvice, setAiAdvice] = useState<AiSafetyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Compile full safety context and request recommendations
  useEffect(() => {
    const fetchAdvice = async () => {
      setLoading(true);
      
      const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      
      const context: SafetyContext = {
        currentTime,
        routeName: journeyState.routeName || 'Planned Path',
        routeRiskScore,
        routeRiskLevel: classifyRiskLevel(routeRiskScore, journeyState.sosState),
        lighting: journeyState.routeName ? (journeyState.routeName.includes('Industrial') ? 85 : journeyState.routeName.includes('Residential') ? 45 : 15) : 30,
        activity: journeyState.routeName ? (journeyState.routeName.includes('Industrial') ? 90 : journeyState.routeName.includes('Residential') ? 50 : 10) : 30,
        isolation: journeyState.routeName ? (journeyState.routeName.includes('Industrial') ? 85 : journeyState.routeName.includes('Residential') ? 40 : 10) : 30,
        communityReportsCount,
        journeyStatus: journeyState.status,
        expectedArrivalTime: journeyState.expectedArrivalTime || 'N/A',
        checkInStatus: journeyState.status === 'CHECKIN_MISSED' ? 'MISSED' : journeyState.status === 'ACTIVE' ? 'PENDING' : 'SAFE',
        deviationState,
        deviationDistance,
        sosState: journeyState.sosState,
        userType
      };

      const response = await getAiSafetyAdvice(context);
      setAiAdvice(response);
      setLoading(false);
    };

    fetchAdvice();
  }, [
    journeyState.status,
    journeyState.currentLocationIndex,
    journeyState.sosState,
    routeRiskScore,
    deviationState,
    deviationDistance,
    communityReportsCount,
    userType
  ]);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <h2 className="card-title">
          <Sparkles size={18} style={{ color: '#38bdf8' }} />
          AI Safety Companion
        </h2>
        {aiAdvice && (
          <span className="ai-header-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Cpu size={12} />
            {aiAdvice.isRealAi ? 'Gemini 1.5 Flash' : 'Local Safety Engine'}
          </span>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: '0.25rem' }}>
        <label htmlFor="user-profile-select" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <UserCheck size={14} /> Travel Context Profile
        </label>
        <select
          id="user-profile-select"
          value={userType}
          onChange={(e) => setUserType(e.target.value as SafetyContext['userType'])}
          style={{ fontSize: '0.85rem', padding: '0.5rem' }}
        >
          <option value="Student">🎒 Student</option>
          <option value="Woman">🙋‍♀️ Woman Traveller</option>
          <option value="Hostel Resident">🏫 Hostel Resident</option>
          <option value="Solo Traveller">🧭 Solo Traveller</option>
          <option value="Night-Shift Worker">🌃 Night-Shift Worker</option>
          <option value="Other">👤 General User</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div className="sos-pulse-active" style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
          <span style={{ fontSize: '0.85rem' }}>Synthesizing route safety signal telemetry...</span>
        </div>
      ) : aiAdvice ? (
        <div className="ai-assistant-container">
          <div className="ai-output-box">
            <div>
              <span className="ai-section-title">Situation Assessment</span>
              <p style={{ marginTop: '0.15rem', color: 'white' }}>{aiAdvice.situationAssessment}</p>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              <span className="ai-section-title">Telemetry Reasoning</span>
              <p style={{ marginTop: '0.15rem', color: 'var(--text-secondary)' }}>{aiAdvice.reasoning}</p>
            </div>

            <div className="ai-bubble-bot" style={{ marginTop: '0.25rem' }}>
              <span className="ai-section-title" style={{ color: '#0284c7' }}>Recommended Action</span>
              <p style={{ marginTop: '0.15rem', fontWeight: 500 }}>{aiAdvice.recommendedAction}</p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontSize: '0.8rem', color: 'var(--color-caution)' }}>
              <strong>Escalation:</strong> {aiAdvice.escalationRecommendation}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Eye size={12} />
            <span>AI monitors journey checkpoints & coordinates local response fallbacks.</span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
          Start a journey or input details to activate safety assessment.
        </div>
      )}
    </div>
  );
};
