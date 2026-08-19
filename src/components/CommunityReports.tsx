import React, { useState } from 'react';
import { Sliders, Settings2, ShieldAlert, Sparkles } from 'lucide-react';
import { validateCommunityReport, sanitizeString } from '../services/validation';
import type { CommunityReportInput } from '../services/validation';
import type { RiskWeightConfig } from '../services/riskEngine';

interface CommunityReportsProps {
  reports: Array<CommunityReportInput & { timestamp: string }>;
  onAddReport: (report: CommunityReportInput) => void;
  weights: RiskWeightConfig;
  onChangeWeights: (newWeights: RiskWeightConfig) => void;
  geminiKey: string;
  onChangeGeminiKey: (key: string) => void;
}

export const CommunityReports: React.FC<CommunityReportsProps> = ({
  reports,
  onAddReport,
  weights,
  onChangeWeights,
  geminiKey,
  onChangeGeminiKey
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'submit' | 'settings'>('feed');

  // Submit Report state
  const [category, setCategory] = useState('poor lighting');
  const [severity, setSeverity] = useState(3);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

  // Weights state
  const [weightState, setWeightState] = useState<RiskWeightConfig>({ ...weights });

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input: CommunityReportInput = {
      category,
      severity,
      description: sanitizeString(description),
      location: sanitizeString(location)
    };

    const valResult = validateCommunityReport(input);
    if (!valResult.isValid) {
      setFormErrors(valResult.errors);
      setSuccessMsg('');
      return;
    }

    onAddReport(input);
    setDescription('');
    setLocation('');
    setFormErrors([]);
    setSuccessMsg('Report submitted successfully! Route calculations have been updated.');
    setTimeout(() => setSuccessMsg(''), 4000);
    setActiveTab('feed');
  };

  const handleWeightChange = (key: keyof RiskWeightConfig, val: number) => {
    const nextWeights = {
      ...weightState,
      [key]: parseFloat(val.toFixed(2))
    };
    
    // Check sum of weights. We want them to equal approximately 1.0
    setWeightState(nextWeights);
    onChangeWeights(nextWeights);
  };

  // Check sum of weights
  const totalWeight = Object.values(weightState).reduce((a, b) => a + b, 0);

  return (
    <div className="card">
      <div className="tabs-header">
        <button
          onClick={() => setActiveTab('feed')}
          className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
        >
          Community Signals ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('submit')}
          className={`tab-btn ${activeTab === 'submit' ? 'active' : ''}`}
        >
          + Submit Alert
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
        >
          <Settings2 size={14} style={{ display: 'inline', marginRight: '0.25rem', verticalAlign: 'middle' }} />
          System Settings
        </button>
      </div>

      {activeTab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            ⚠️ Signal warnings are community generated. Real-time safety calculations are simulated.
          </div>
          
          <div className="report-list">
            {reports.slice().reverse().map((rep, idx) => (
              <div key={idx} className="report-item">
                <div className="report-item-header">
                  <span style={{ fontWeight: 600, textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ShieldAlert size={12} style={{ color: 'var(--color-caution)' }} />
                    {rep.category}
                  </span>
                  <span className="status-badge status-caution" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                    Severity {rep.severity}/5
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  📍 {rep.location} • {rep.timestamp}
                </div>
                <p className="report-desc">{rep.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'submit' && (
        <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>File Active Safety Signal</h3>
          
          {formErrors.length > 0 && (
            <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-high)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-high)' }}>
              {formErrors.map((err, i) => <div key={i}>• {err}</div>)}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="report-category">Signal Category</label>
              <select id="report-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="poor lighting">💡 Poor Street Lighting</option>
                <option value="harassment">⚠️ Harassment / Stalking Alert</option>
                <option value="suspicious activity">🕵️ Suspicious Activity</option>
                <option value="unsafe crossing">🚶 Unsafe Road Crossing</option>
                <option value="isolated area">🧱 Highly Isolated Segment</option>
                <option value="infrastructure problem">🚧 Road Work / Obstruction</option>
                <option value="other">❓ Other Safety Concern</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="report-severity">Hazard Severity (1-5)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  id="report-severity"
                  type="range"
                  min="1"
                  max="5"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  style={{ flex: 1, padding: 0 }}
                />
                <span style={{ fontWeight: 600, fontSize: '1rem', width: '20px' }}>{severity}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="report-location">Location / Street / Area Name</label>
            <input
              id="report-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Back gate of girls hostel near parking lot"
            />
          </div>

          <div className="form-group">
            <label htmlFor="report-desc">Describe Safety Issue</label>
            <textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide specific details about lighting, accessibility, or safety signals observed..."
              rows={3}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ padding: '0.65rem' }}>
            Submit Safety Signal
          </button>
        </form>
      )}

      {activeTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sliders size={14} /> Risk Engine Weighted Modifiers
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Modify the transparent weights used to compute route safety coefficients (sum: {totalWeight.toFixed(2)}).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {Object.keys(weightState).map((key) => {
              const weightKey = key as keyof RiskWeightConfig;
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 3fr auto', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.05"
                    value={weightState[weightKey]}
                    onChange={(e) => handleWeightChange(weightKey, parseFloat(e.target.value))}
                    style={{ padding: 0 }}
                  />
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, width: '40px', textAlign: 'right' }}>
                    {weightState[weightKey].toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.35rem' }}>
              <Sparkles size={14} style={{ color: '#38bdf8' }} /> Gemini AI Config
            </h3>
            <div className="form-group">
              <label htmlFor="gemini-api-key-input">VITE_GEMINI_API_KEY (Stored locally in session)</label>
              <input
                id="gemini-api-key-input"
                type="password"
                value={geminiKey}
                onChange={(e) => onChangeGeminiKey(e.target.value)}
                placeholder="Enter Gemini API key to enable actual LLM analysis..."
                style={{ fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                🔒 Stored in-memory only. Fallback local rule engine is active if empty.
              </span>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--color-safe)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-safe)', textAlign: 'center' }}>
          {successMsg}
        </div>
      )}
    </div>
  );
};
