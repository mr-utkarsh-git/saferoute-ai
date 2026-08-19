import React, { useEffect, useRef, useState } from 'react';
import { AlertOctagon, CheckCircle2, Flame, MapPin, ShieldAlert, UserPlus, Users, Trash } from 'lucide-react';
import type { JourneyState } from '../services/journeyManager';
import type { RiskLevel } from '../services/riskEngine';
import { classifyRiskLevel } from '../services/riskEngine';
import type { TrustedContactInput } from '../services/validation';
import { validateTrustedContact } from '../services/validation';

interface DashboardProps {
  journeyState: JourneyState;
  routeRiskScore: number;
  onConfirmCheckIn: () => void;
  onTriggerSos: () => void;
  onRecoverFromSos: (resume?: boolean) => void;
  onEndJourney: () => void;
  onSimulateMove: () => void;
  onSimulateDeviate: () => void;
  onSimulateTimeout: () => void;
  contacts: TrustedContactInput[];
  onAddContact: (contact: TrustedContactInput) => void;
  onRemoveContact: (index: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  journeyState,
  routeRiskScore,
  onConfirmCheckIn,
  onTriggerSos,
  onRecoverFromSos,
  onEndJourney,
  onSimulateMove,
  onSimulateDeviate,
  onSimulateTimeout,
  contacts,
  onAddContact,
  onRemoveContact
}) => {
  const { status, checkInCountdown, lastCheckInTime, expectedArrivalTime, timeline, currentLocation, routeName } = journeyState;

  // Contact form state
  const [cName, setCName] = useState('');
  const [cRel, setCRel] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [valErrors, setValErrors] = useState<string[]>([]);
  
  // SOS countdown trigger state
  const [sosCountdownActive, setSosCountdownActive] = useState(false);
  const [sosCountdownVal, setSosCountdownVal] = useState(3);
  const [sosTimerId, setSosTimerId] = useState<any | null>(null);

  // Web Audio refs for the Siren
  const audioContextRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<any | null>(null);
  const sirenOscillatorRef = useRef<OscillatorNode | null>(null);
  const sirenGainRef = useRef<GainNode | null>(null);

  const stopSosSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
      sirenIntervalRef.current = null;
    }

    const oscillator = sirenOscillatorRef.current;
    const gain = sirenGainRef.current;
    const audioContext = audioContextRef.current;

    if (oscillator && audioContext) {
      try {
        const now = audioContext.currentTime;
        if (gain) {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0.0001, now);
        }
        oscillator.stop(now + 0.05);
      } catch {
        // Oscillator may already have stopped
      }
    }
    sirenOscillatorRef.current = null;
    sirenGainRef.current = null;
  };

  const startSosSiren = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('Web Audio API is not supported by this browser.');
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }

      // Stop any existing siren first to prevent overlap
      stopSosSiren();

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sawtooth';
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();

      sirenOscillatorRef.current = oscillator;
      sirenGainRef.current = gain;

      let highTone = false;
      const updateSiren = () => {
        if (!audioContextRef.current || !sirenOscillatorRef.current) return;
        const now = audioContextRef.current.currentTime;
        highTone = !highTone;

        sirenOscillatorRef.current.frequency.cancelScheduledValues(now);
        sirenOscillatorRef.current.frequency.setValueAtTime(
          highTone ? 1100 : 650,
          now
        );

        if (sirenGainRef.current) {
          sirenGainRef.current.gain.cancelScheduledValues(now);
          sirenGainRef.current.gain.setValueAtTime(0.0001, now);
          sirenGainRef.current.gain.linearRampToValueAtTime(
            0.16,
            now + 0.08
          );
        }
      };

      updateSiren();
      sirenIntervalRef.current = setInterval(updateSiren, 500);
    } catch (error) {
      console.error('Unable to start SOS siren:', error);
    }
  };

  // Synchronize audio on status changes
  useEffect(() => {
    if (status === 'SOS_ACTIVE') {
      startSosSiren();
    } else {
      stopSosSiren();
    }
    return () => stopSosSiren();
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSosSiren();
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, []);

  // Status mapping
  const riskLevel: RiskLevel = classifyRiskLevel(routeRiskScore, status === 'SOS_ACTIVE');
  let statusClass = 'status-safe';
  let statusMessage = 'Secure Environment';
  
  if (status === 'SOS_ACTIVE') {
    statusClass = 'status-sos';
    statusMessage = 'SOS ALERTS DISTRIBUTED (DEMO)';
  } else if (status === 'CHECKIN_MISSED') {
    statusClass = 'status-high';
    statusMessage = 'CHECK-IN TIME MISSED';
  } else if (riskLevel === 'CAUTION') {
    statusClass = 'status-caution';
    statusMessage = 'Exercise Caution';
  } else if (riskLevel === 'ELEVATED RISK') {
    statusClass = 'status-elevated';
    statusMessage = 'Elevated Route Risk';
  } else if (riskLevel === 'HIGH RISK') {
    statusClass = 'status-high';
    statusMessage = 'High Route Risk Zone';
  }

  const handleAddContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: TrustedContactInput = {
      name: cName,
      relationship: cRel,
      phone: cPhone,
      email: cEmail
    };

    const valResult = validateTrustedContact(input);
    if (!valResult.isValid) {
      setValErrors(valResult.errors);
      return;
    }

    onAddContact(input);
    setCName('');
    setCRel('');
    setCPhone('');
    setCEmail('');
    setValErrors([]);
  };

  const handleSosClick = () => {
    if (status === 'SOS_ACTIVE') {
      stopSosSiren();
      onRecoverFromSos(true);
      return;
    }

    // Touch Context user gesture activation
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (sosCountdownActive) {
      triggerSosImmediately();
      return;
    }

    setSosCountdownActive(true);
    setSosCountdownVal(3);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        triggerSosImmediately();
      } else {
        setSosCountdownVal(count);
      }
    }, 1000);

    setSosTimerId(interval);
  };

  const triggerSosImmediately = () => {
    if (sosTimerId) clearInterval(sosTimerId);
    setSosCountdownActive(false);
    
    // Explicit activation bound to gesture to guarantee sound plays immediately
    startSosSiren();
    onTriggerSos();
  };

  const handleCancelSosCountdown = () => {
    if (sosTimerId) clearInterval(sosTimerId);
    setSosCountdownActive(false);
  };

  return (
    <div className="dashboard-grid">
      
      {/* Active Checkin Missed Warning Block */}
      {status === 'CHECKIN_MISSED' && (
        <div className="checkin-alert-banner" role="alert" aria-live="assertive">
          <AlertOctagon size={48} style={{ color: 'var(--color-high)' }} />
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Expected Safety Check-in Missed!</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Confirm your safety now. Contacts will be notified if you do not check in.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
            <button onClick={onConfirmCheckIn} className="btn-primary" style={{ background: 'var(--color-safe)' }}>
              🟢 I'm Safe
            </button>
            <button onClick={() => { startSosSiren(); onTriggerSos(); }} className="btn-secondary" style={{ border: '1px solid var(--color-sos)', color: 'var(--color-sos)' }}>
              🚨 Escalate Alert
            </button>
          </div>
        </div>
      )}

      {/* SOS Trigger Countdown Dialog */}
      {sosCountdownActive && (
        <div className="danger-modal-overlay" role="dialog" aria-modal="true" aria-label="SOS countdown warning">
          <div className="danger-modal-content">
            <Flame size={64} className="sos-pulse-active" style={{ color: 'var(--color-sos)', margin: '0 auto' }} />
            <div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Triggering SOS Beacon</h2>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Activating emergency protocol in...
              </p>
              <div className="checkin-countdown-val">{sosCountdownVal}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button onClick={triggerSosImmediately} className="btn-primary" style={{ backgroundColor: 'var(--color-sos)' }}>
                🚨 Trigger Immediately
              </button>
              <button onClick={handleCancelSosCountdown} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Active Details */}
      {status === 'SOS_ACTIVE' && (
        <div className="checkin-alert-banner" style={{ border: '2px solid var(--color-sos)', background: 'rgba(255, 0, 85, 0.08)' }} role="alert">
          <Flame size={48} className="sos-pulse-active" style={{ color: 'var(--color-sos)' }} />
          <div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>EMERGENCY BEACON ACTIVE</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Fictional rescue beacon initiated. Trusted contacts have been sent demo alert messages.
            </p>
            {contacts.length > 0 ? (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-safe)' }}>
                📢 Demo notifications sent to: {contacts.map(c => `${c.name} (${c.relationship})`).join(', ')}
              </div>
            ) : (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--color-high)' }}>
                ⚠️ No trusted contacts configured! Configure contacts below to send demo alerts.
              </div>
            )}
            <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--color-sos)', fontWeight: 600 }}>
              🔊 SOS SIREN ACTIVE
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'center' }}>
            <button onClick={() => { stopSosSiren(); onRecoverFromSos(true); }} className="btn-primary" style={{ background: 'var(--color-safe)' }}>
              Deactivate SOS & Resume
            </button>
            <button onClick={() => { stopSosSiren(); onRecoverFromSos(false); }} className="btn-secondary">
              End Journey Completely
            </button>
          </div>
        </div>
      )}

      <div className="dashboard-row-top">
        {/* Status card */}
        <div className={`card ${riskLevel === 'HIGH RISK' || status === 'SOS_ACTIVE' ? 'card-pulse-high' : riskLevel === 'CAUTION' || riskLevel === 'ELEVATED RISK' ? 'card-pulse-caution' : ''}`}>
          <div className="card-header">
            <h2 className="card-title">
              <ShieldAlert size={18} />
              Current Safety Status
            </h2>
            <span className={`status-badge ${statusClass}`}>{riskLevel}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Environment: <span style={{ fontWeight: 600, color: 'white' }}>{statusMessage}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Route Risk Score: <span style={{ fontWeight: 600, color: 'white' }}>{routeRiskScore} / 100</span>
            </div>
            {status !== 'IDLE' && (
              <>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Active Path: <span style={{ fontWeight: 600, color: 'white' }}>{routeName}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Expected Arrival: <span style={{ fontWeight: 600, color: 'white' }}>{expectedArrivalTime}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Last Check-in: <span style={{ fontWeight: 600, color: 'white' }}>{lastCheckInTime || 'None'}</span>
                </div>
                {status === 'ACTIVE' && (
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-caution)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    🕒 Next Safety Check-in: <strong>{checkInCountdown}s</strong>
                  </div>
                )}
              </>
            )}
          </div>

          {status !== 'IDLE' && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
              {status === 'ACTIVE' && (
                <button onClick={onConfirmCheckIn} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--color-safe)' }}>
                  Check In Safe
                </button>
              )}
              <button onClick={() => { stopSosSiren(); onEndJourney(); }} className="btn-secondary" style={{ flex: 1 }}>
                End Journey
              </button>
            </div>
          )}
        </div>

        {/* SOS Panel */}
        <div className="card" style={{ justifyContent: 'center' }}>
          <button
            onClick={handleSosClick}
            className={`btn-sos ${status === 'SOS_ACTIVE' ? 'sos-pulse-active' : ''}`}
            aria-label="SOS Emergency button. Triggers countdown to activate alert beacon."
          >
            {status === 'SOS_ACTIVE' ? 'SOS ACTIVE (TAP TO CANCEL)' : 'EMERGENCY SOS'}
          </button>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.5rem' }}>
            ℹ️ Press to start a 3-second emergency alert countdown. Double click to trigger immediately.
          </div>
          {status === 'SOS_ACTIVE' && (
            <div style={{ textAlign: 'center', color: 'var(--color-sos)', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem' }}>
              🔊 Emergency siren active
            </div>
          )}
        </div>
      </div>

      {/* Location Simulation Controllers (Only display when journey is active) */}
      {status !== 'IDLE' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <MapPin size={18} />
              Journey Movement Simulator
            </h2>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Simulated Position: {currentLocation ? `lat: ${currentLocation.lat.toFixed(5)}, lng: ${currentLocation.lng.toFixed(5)}` : 'Unknown'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button onClick={onSimulateMove} className="btn-primary">
              🚶 Advance Route
            </button>
            <button onClick={onSimulateDeviate} className="btn-secondary" style={{ color: 'var(--color-caution)', borderColor: 'var(--color-caution)' }}>
              ⚠️ Force Deviation
            </button>
            <button onClick={onSimulateTimeout} className="btn-secondary" style={{ color: 'var(--color-high)', borderColor: 'var(--color-high)' }}>
              ⏰ Force Timeout
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Simulator guidelines: 'Advance Route' simulates movement step-by-step; 'Force Deviation' shifts coordinates away to test warning state; 'Force Timeout' sets check-in timer to 0.
          </div>
        </div>
      )}

      {/* Trusted Contacts configuration */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Users size={18} />
            Trusted Safety Contacts
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{contacts.length} Configured</span>
        </div>

        {contacts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {contacts.map((contact, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{contact.name} ({contact.relationship})</div>
                  <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                    {contact.phone && <span>📞 {contact.phone}</span>}
                    {contact.email && <span>✉️ {contact.email}</span>}
                  </div>
                </div>
                <button
                  onClick={() => onRemoveContact(index)}
                  style={{ background: 'none', color: 'var(--color-high)', padding: '0.25rem' }}
                  aria-label={`Remove contact ${contact.name}`}
                >
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            No trusted contacts configured. Add contacts below to receive demo rescue notifications.
          </div>
        )}

        <form onSubmit={handleAddContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <UserPlus size={14} /> Add New Contact
          </h3>
          {valErrors.length > 0 && (
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-high)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-high)' }}>
              {valErrors.map((err, i) => <div key={i}>• {err}</div>)}
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contact-name">Name</label>
              <input id="contact-name" type="text" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. John Doe" />
            </div>
            <div className="form-group">
              <label htmlFor="contact-relationship">Relationship</label>
              <input id="contact-relationship" type="text" value={cRel} onChange={(e) => setCRel(e.target.value)} placeholder="e.g. Mother, Colleague" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contact-phone">Phone Number</label>
              <input id="contact-phone" type="tel" value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="e.g. +1234567890" />
            </div>
            <div className="form-group">
              <label htmlFor="contact-email">Email Address</label>
              <input id="contact-email" type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="e.g. email@domain.com" />
            </div>
          </div>
          <button type="submit" className="btn-secondary" style={{ padding: '0.6rem', fontSize: '0.85rem' }}>
            Add Trusted Relation
          </button>
        </form>
      </div>

      {/* Safety Timeline event logs */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <CheckCircle2 size={18} />
            Safety Timeline
          </h2>
        </div>
        {timeline.length > 0 ? (
          <div className="timeline-list">
            {timeline.slice().reverse().map((ev, i) => (
              <div key={i} className="timeline-item">
                <span className="timeline-time">[{ev.time}]</span>
                <span className="timeline-content">{ev.event}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
            Timeline is empty. Start a journey or simulate events to generate safety logs.
          </div>
        )}
      </div>

    </div>
  );
};
