import { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { RoutePlanner } from './components/RoutePlanner';
import { Dashboard } from './components/Dashboard';
import { AiAssistant } from './components/AiAssistant';
import { CommunityReports } from './components/CommunityReports';
import {
  INITIAL_JOURNEY_STATE,
  startJourney,
  tickCheckIn,
  confirmCheckIn,
  triggerSos,
  recoverFromSos,
  endJourney,
  advanceSimulationStep
} from './services/journeyManager';
import type { JourneyState } from './services/journeyManager';
import {
  calculateRiskScore,
  DEFAULT_RISK_WEIGHTS
} from './services/riskEngine';
import type {
  RiskWeightConfig,
  RiskFactors
} from './services/riskEngine';
import {
  detectDeviation
} from './services/deviationDetector';
import type {
  DeviationState,
  Coordinate
} from './services/deviationDetector';
import type { CommunityReportInput, TrustedContactInput } from './services/validation';

// Pre-configured mock data for initial load
const MOCK_CONTACTS: TrustedContactInput[] = [
  { name: 'Mom', relationship: 'Mother', phone: '+14155552671', email: 'mother@safetymail.com' },
  { name: 'Hostel Warden', relationship: 'Hostel Supervisor', phone: '+919988776655', email: 'warden@campus.edu' }
];

const MOCK_REPORTS: Array<CommunityReportInput & { timestamp: string }> = [
  {
    category: 'poor lighting',
    severity: 4,
    description: 'Streetlights are completely dead along the back campus boundary path.',
    location: 'Campus North Alleyway',
    timestamp: '2026-08-19 08:30:00'
  },
  {
    category: 'suspicious activity',
    severity: 3,
    description: 'Group of strangers loitering near the industrial park crossing.',
    location: 'Industrial Crossing Zone',
    timestamp: '2026-08-19 09:12:00'
  }
];

function App() {
  // Application state
  const [journeyState, setJourneyState] = useState<JourneyState>(INITIAL_JOURNEY_STATE);
  const [contacts, setContacts] = useState<TrustedContactInput[]>(() => {
    const saved = localStorage.getItem('saferoute_contacts');
    return saved ? JSON.parse(saved) : MOCK_CONTACTS;
  });
  const [reports, setReports] = useState<Array<CommunityReportInput & { timestamp: string }>>(() => {
    const saved = localStorage.getItem('saferoute_reports');
    return saved ? JSON.parse(saved) : MOCK_REPORTS;
  });
  const [weights, setWeights] = useState<RiskWeightConfig>(() => {
    const saved = localStorage.getItem('saferoute_weights');
    return saved ? JSON.parse(saved) : DEFAULT_RISK_WEIGHTS;
  });
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    return localStorage.getItem('saferoute_gemini_key') || '';
  });

  const [deviationState, setDeviationState] = useState<DeviationState>('NORMAL');
  const [deviationDistance, setDeviationDistance] = useState<number>(0);
  const [currentRouteRisk, setCurrentRouteRisk] = useState<number>(10);

  // Sync state to localstorage for persistency
  useEffect(() => {
    localStorage.setItem('saferoute_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('saferoute_reports', JSON.stringify(reports));
  }, [reports]);

  // Keep check-in countdown timer ticking when journey is active
  useEffect(() => {
    if (journeyState.status !== 'ACTIVE') return;

    const timer = setInterval(() => {
      setJourneyState((prev) => tickCheckIn(prev, 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [journeyState.status]);

  // Dynamically calculate and update current route risk
  useEffect(() => {
    // Determine base factors based on active route
    let factors: RiskFactors = {
      incidentReports: 10,
      lighting: 15,
      activity: 10,
      isolation: 10,
      timeOfDay: 20,
      recentSignals: 10
    };

    if (journeyState.routeName) {
      if (journeyState.routeName.includes('Industrial')) {
        factors = {
          incidentReports: 70,
          lighting: 85,
          activity: 90,
          isolation: 85,
          timeOfDay: 80,
          recentSignals: 40
        };
      } else if (journeyState.routeName.includes('Residential')) {
        factors = {
          incidentReports: 30,
          lighting: 45,
          activity: 50,
          isolation: 40,
          timeOfDay: 50,
          recentSignals: 20
        };
      }
    }

    // Offset based on community report counts
    const reportCount = reports.filter(r => r.category === 'poor lighting' || r.category === 'harassment').length;
    factors.incidentReports = Math.min(100, factors.incidentReports + reportCount * 8);

    // If deviation is active, increase risk level factors
    if (deviationState === 'HIGH') {
      factors.recentSignals = 90;
      factors.isolation = Math.min(100, factors.isolation + 30);
    } else if (deviationState === 'WARNING') {
      factors.recentSignals = 50;
    }

    const calculatedRisk = calculateRiskScore(factors, weights);
    setCurrentRouteRisk(calculatedRisk);
  }, [journeyState.routeName, reports, weights, deviationState]);

  // Start Journey Action
  const handleStartJourney = (routeName: string, coordinates: Coordinate[], eta: string) => {
    setJourneyState((prev) => startJourney(prev, routeName, coordinates, eta, 45)); // 45s timer for interactive demo convenience
    setDeviationState('NORMAL');
    setDeviationDistance(0);
  };

  // Confirm Check-in
  const handleConfirmCheckIn = () => {
    setJourneyState((prev) => confirmCheckIn(prev));
  };

  // Trigger SOS Beacon
  const handleTriggerSos = () => {
    setJourneyState((prev) => triggerSos(prev));
  };

  // Recover/End SOS
  const handleRecoverFromSos = (resume = false) => {
    setJourneyState((prev) => recoverFromSos(prev, resume));
  };

  // End journey completely
  const handleEndJourney = () => {
    setJourneyState((prev) => endJourney(prev));
    setDeviationState('NORMAL');
    setDeviationDistance(0);
  };

  // Simulator Actions
  const handleSimulateMove = () => {
    if (!journeyState.currentLocation || journeyState.routeCoordinates.length === 0) return;
    
    // Perform standard route step advancement
    setJourneyState((prev) => advanceSimulationStep(prev));
    
    // Recalculate deviation (should be normal since we are stepping along the route path points)
    setDeviationState('NORMAL');
    setDeviationDistance(0);
  };

  const handleSimulateDeviate = () => {
    if (!journeyState.currentLocation) return;

    // Shift coordinates substantially (simulates walking 250m off route into side streets)
    const deviatedLoc: Coordinate = {
      lat: journeyState.currentLocation.lat + 0.0022,
      lng: journeyState.currentLocation.lng + 0.0022
    };

    const nextState = {
      ...journeyState,
      currentLocation: deviatedLoc
    };

    // Detect deviation
    const report = detectDeviation(deviatedLoc, journeyState.routeCoordinates, currentRouteRisk);
    setDeviationState(report.state);
    setDeviationDistance(report.distance);

    // Log to timeline
    const nowStr = new Date().toTimeString().split(' ')[0];
    nextState.timeline.push({
      time: nowStr,
      event: `Alert: Route deviation detected! User is ${report.distance}m off-route. ${report.message}`
    });

    setJourneyState(nextState);
  };

  const handleSimulateTimeout = () => {
    // Immediately set countdown timer to 0 to simulate check-in failure
    setJourneyState((prev) => {
      const nowStr = new Date().toTimeString().split(' ')[0];
      return {
        ...prev,
        status: 'CHECKIN_MISSED',
        checkInCountdown: 0,
        timeline: [
          ...prev.timeline,
          { time: nowStr, event: 'Alert: User missed expected safety check-in countdown interval!' }
        ]
      };
    });
  };

  // Contacts Handlers
  const handleAddContact = (contact: TrustedContactInput) => {
    setContacts((prev) => [...prev, contact]);
  };

  const handleRemoveContact = (index: number) => {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  // Community Reports Handlers
  const handleAddReport = (reportInput: CommunityReportInput) => {
    const newReport = {
      ...reportInput,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    setReports((prev) => [...prev, newReport]);
  };

  const handleUpdateGeminiKey = (key: string) => {
    setGeminiKey(key);
    localStorage.setItem('saferoute_gemini_key', key);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-title-group">
          <div className="logo-badge" aria-hidden="true">
            SR
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              SafeRoute AI
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              SafetyNet Companion Console
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="demo-banner" style={{ border: '1px solid #0369a1', color: '#38bdf8' }}>
            <Radio size={10} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
            SafetyNet Hub
          </span>
        </div>
      </header>

      <main className="main-content">
        {/* Left Side: Router, Status Dashboard, Feed/Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <RoutePlanner
            onStartJourney={handleStartJourney}
            activeJourney={journeyState.status !== 'IDLE'}
            communityReportsCount={reports.length}
          />

          <Dashboard
            journeyState={journeyState}
            routeRiskScore={currentRouteRisk}
            onConfirmCheckIn={handleConfirmCheckIn}
            onTriggerSos={handleTriggerSos}
            onRecoverFromSos={handleRecoverFromSos}
            onEndJourney={handleEndJourney}
            onSimulateMove={handleSimulateMove}
            onSimulateDeviate={handleSimulateDeviate}
            onSimulateTimeout={handleSimulateTimeout}
            contacts={contacts}
            onAddContact={handleAddContact}
            onRemoveContact={handleRemoveContact}
          />

          <CommunityReports
            reports={reports}
            onAddReport={handleAddReport}
            weights={weights}
            onChangeWeights={setWeights}
            geminiKey={geminiKey}
            onChangeGeminiKey={handleUpdateGeminiKey}
          />
        </div>

        {/* Right Side: AI Assistant (Context Safety Console) */}
        <div>
          <AiAssistant
            journeyState={journeyState}
            routeRiskScore={currentRouteRisk}
            deviationState={deviationState}
            deviationDistance={deviationDistance}
            communityReportsCount={reports.length}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
