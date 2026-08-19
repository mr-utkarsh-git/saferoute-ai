# SafeRoute AI — SafetyNet Companion Console

SafeRoute AI is a personal safety companion built as a robust, working MVP for the SafetyNet challenge at PROMPTWARS x GDGoC MM(DU). It coordinates route planning, transparent risk profiling, active check-in journeys, route deviation telemetry, contextual AI safety coaching, and quick-escalation SOS controls.

---

## Table of Contents
1. [Overview](#1-overview)
2. [SafetyNet Challenge](#2-safetynet-challenge)
3. [The Problem](#3-the-problem)
4. [Target Users](#4-target-users)
5. [The Solution](#5-the-solution)
6. [Key Features](#6-key-features)
7. [How the System Works](#7-how-the-system-works)
8. [Architecture & Data Flow](#8-architecture--data-flow)
9. [AI & Contextual Intelligence](#9-ai--contextual-intelligence)
10. [Risk Scoring Methodology](#10-risk-scoring-methodology)
11. [Route Recommendation Logic](#11-route-recommendation-logic)
12. [Safety Journey Workflow](#12-safety-journey-workflow)
13. [SOS Emergency Workflow](#13-sos-emergency-workflow)
14. [Community Reporting & Feedback Loop](#14-community-reporting--feedback-loop)
15. [Security Engineering](#15-security-engineering)
16. [Accessibility (a11y)](#16-accessibility-a11y)
17. [Testing Suite](#17-testing-suite)
18. [Demo Data Assumptions](#18-demo-data-assumptions)
19. [Limitations](#19-limitations)
20. [Future Improvements](#20-future-improvements)
21. [Local Setup](#21-local-setup)
22. [Environment Variables](#22-environment-variables)
23. [Production Build](#23-production-build)
24. [Google Cloud Run Deployment](#24-google-cloud-run-deployment)

---

## 1. Overview
SafeRoute AI is a fully functional web interface optimized for high-stress usability, featuring an automated state machine that ticks down check-in alerts, monitors spatial deviation from a selected path, sanitizes hazard reports, and queries Gemini AI (or uses a structured local rule-based recommendation fallback) to provide real-time personal safety guidance.

## 2. SafetyNet Challenge
The GDGoC safety challenge requires applicants to leverage artificial intelligence and software engineering to solve concrete problems in personal, campus, or community safety. SafeRoute AI aligns with this statement by offering a modular, inspectable, and secure safety tracking system.

## 3. The Problem
When walking or traveling alone through unfamiliar neighborhoods, late at night, or in isolated sectors, users lack transparent information on environment risk (poor street lighting, deserted paths, or localized incident signals). Standard navigation apps prioritize the absolute shortest route, occasionally directing pedestrians through high-risk shortcuts. Furthermore, traditional panic buttons trigger immediate alerts, causing frequent false alarms, while missing a scheduled check-in is rarely detected automatically.

## 4. Target Users
- **Students & Hostel Residents**: Navigating campus paths and hostel sectors late at night.
- **Solo Travellers & Night-Shift Workers**: Walking home from metro stations or office parks during low-activity hours.
- **Women & Vulnerable Pedestrians**: Requiring active, context-aware companionship and alert escalation systems.
- **Families**: Desiring a reliable safety check-in framework.

## 5. The Solution
SafeRoute AI integrates transparent environmental risk scoring (incident reports, street lighting, pedestrian activity, time-of-day, and spatial deviation) into a unified console. It presents multiple routes with granular risk metrics, maintains an active check-in countdown, detects spatial route deviations, generates context-aware safety coaching, and implements a controlled SOS beacon that notifies trusted contacts.

## 6. Key Features
- **Route Safety Planner**: Select paths categorized by safety characteristics (Grand Avenue, Residential Lanes, Industrial Shortcuts) with automated ETAs.
- **Transparent Risk Scoring Console**: Real-time breakdown of environmental drivers (e.g. lighting, crowd activity, time of day).
- **Active Safety Dashboard**: Central status console featuring countdown trackers, safety confirmations, and location telemetry.
- **SOS Beacon Control**: Big red button featuring a 3-second countdown to prevent accidental clicks, with direct override trigger.
- **Contextual AI Safety Assistant**: Feeds real-time telemetry (deviation state, profile, time, risks) to Gemini AI to generate actionable personal safety instructions.
- **Community Safety Alerts Feed**: A sanitized, validated reporting tool for users to file hazards (poor lighting, loitering, infrastructure issues).
- **Timeline Logs**: High-fidelity chronological event tracking for audit and telemetry review.

## 7. How the System Works
1. **Plan**: User configures trusted contacts and profile (e.g. Woman, Student).
2. **Analyze**: User enters destination; SafeRoute analyzes route safety score vs travel duration.
3. **Track**: User starts the journey. A safety countdown is initiated, requiring a check-in confirmation at intervals (default 45s for demo convenience).
4. **Monitor**: The simulator moves the user along the path. Deviation detection tests if the user teleports off-route.
5. **Coach**: The AI assistant constantly consumes coordinates, lighting, and deviation status, dynamically updating safety guidelines.
6. **Escalate / Recover**: If a check-in is missed or SOS is pressed, the console switches to alert mode, displaying active trusted contact notification warnings.

## 8. Architecture & Data Flow
```
[User Interface (React + TS)]
     │             ▲
     ▼             │
[Journey Manager] [AI Service] <───► [Gemini API / Local Fallback]
     │             ▲
     ▼             │
[Deviation Detector / Risk Scoring Engine]
     │
     ▼
[Community Reports & Contacts Stores (Web LocalStorage)]
```

## 9. AI & Contextual Intelligence
SafeRoute AI contains a dedicated service layer ([aiService.ts](file:///Users/utkarshraj/MMDU%20Promptwar/saferoute-ai/src/services/aiService.ts)) that compiles user type, time of day, active route risks, community report counts, and deviation states into a structured payload.
- **Gemini API Integration**: If `VITE_GEMINI_API_KEY` is provided, the app queries the Gemini API to receive structured JSON containing situational assessments, logical reasoning, and recommended safety behaviors.
- **Deterministic Local Fallback**: If the API key is absent or fails, a rule-based inference module calculates matching guidance (e.g. warning against headphones in unlit segments, setting check-ins to higher frequencies, recommending shelter zones).

## 10. Risk Scoring Methodology
Calculated inside ([riskEngine.ts](file:///Users/utkarshraj/MMDU%20Promptwar/saferoute-ai/src/services/riskEngine.ts)) using a weighted normalized model (0–100):
- **Incident/Community reports**: 30%
- **Lighting Level**: 20%
- **Crowd/Activity**: 15%
- **Physical Isolation**: 15%
- **Time of Day**: 10%
- **Recent Safety Signals**: 10%

Classifications:
- **SAFE**: 0–25
- **CAUTION**: 26–50
- **ELEVATED RISK**: 51–75
- **HIGH RISK**: 76–100

## 11. Route Recommendation Logic
The Route Safety Planner evaluates duration (speed) vs safety. It applies a recommendation penalty coefficient where `Weighted Score = (Risk Score * 1.5) + (Duration * 1.0)`. It recommends the route minimizing this value, ensuring that a route that is slightly longer but substantially safer is selected over a fast but dangerous alleyway shortcut.

## 12. Safety Journey Workflow
- **State transitions**: `IDLE` -> `ACTIVE` -> (check-in missed) -> `CHECKIN_MISSED` -> (confirm safe) -> `ACTIVE`.
- Automatically logs entries like "Journey started", "User checked in safe", or "Arrived safely at destination" directly to the timeline.

## 13. SOS Emergency Workflow
- Large touch targets with keyboard support.
- Initiating SOS starts a 3-second countdown (cancelable with a single tap) to prevent accidental alarms.
- Double-clicking the SOS button overrides the countdown and triggers the beacon immediately.
- Once active, it changes state, registers the critical event, and flags active simulated SMS/Email notifications to trusted contacts.

## 14. Community Reporting & Feedback Loop
- Allows reporting poor lighting, harassment, suspicious activity, unsafe crossing, isolated areas, or infrastructure problems.
- Category inputs, location strings, and descriptions are parsed and validated.
- **HTML Sanitization**: All description fields are stripped of HTML tags (`&lt;script&gt;` blocks) before storage or rendering to prevent Cross-Site Scripting (XSS).

## 15. Security Engineering
- **API Protection**: No hardcoded API keys are committed. API keys are loaded at runtime from environment variables or session storage.
- **Sanitization**: Standard characters are HTML-entity encoded to mitigate script injections in user reports.
- **Logging Safety**: No personal phone numbers or user location details are leaked to server logs.
- **Demo Transparency**: Fictional alerts, map pins, and notifications are clearly labeled as simulations.

## 16. Accessibility (a11y)
- **Semantic HTML**: Proper `<header>`, `<main>`, `<section>`, and form field elements.
- **Form Labels**: Every text input, select, range, and textarea has a matching `<label>` element.
- **Focus Rings**: Custom CSS outlines (`outline: 3px solid var(--focus-ring)`) ensure keyboard navigators clearly see their active cursor focus.
- **Screen Reader Support**: ARIA attributes (`role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-live="assertive"` for SOS alerts) support visually impaired users.
- **Contrast**: High contrast slate backgrounds and vibrant typography meet accessibility guidelines.

## 17. Testing Suite
Testing is implemented using Vitest. It covers 23 test assertions across the core logic components:
1. **Risk Score calculations**: Normalizes score, weights adjustment, and clamps boundary values.
2. **Risk classifications**: Classifies numeric scores, prioritizes SOS status.
3. **Route recommendations**: Selects safety-optimized path over shortcuts.
4. **Route deviation detection**: Normal zone, warning threshold, transition to High Risk on zone risks.
5. **Check-in transitions**: IDLE -> ACTIVE, timer resets.
6. **Missed check-in**: Transitions status to warning when timer ticks to 0.
7. **SOS transitions**: Activation flag triggers, cancelations, and deactivation.
8. **Alert escalation**: Compiles mock warnings when check-ins are missed.
9. **Community report validation**: Catches bad inputs, tests HTML sanitization.
10. **Trusted contact validation**: Checks phone length, email formats, and empty values.
11. **Contextual AI fallback**: Test local engine outputs for night-travel zones.
12. **Edge cases**: Handles zero coordinates, empty route paths, and extreme weight ranges.

## 18. Demo Data Assumptions
- Maps and locations use Bengaluru coordinates (around lat 12.9716, lng 77.5946) to simulate route vectors.
- Live notifications to emergency services and police are simulated/demo notifications and do not trigger actual public response dispatchers.

## 19. Limitations
- Does not run a live background OS service (requires the browser tab to remain open).
- GPS navigation accuracy is simulated via stepping coordinates in the planner.

## 20. Future Improvements
- Native iOS/Android GPS location integrations.
- SMS dispatch systems (e.g. Twilio API backend integration).
- Real-time crowd mapping using device telemetry.

---

## 21. Local Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd saferoute-ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the local development server:
   ```bash
   npm run dev
   ```
4. Access the web console at `http://localhost:5173`.

## 22. Environment Variables
To configure Gemini AI, create a `.env` file in the root directory (never commit this file):
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```
Vite will automatically load this key at build time. Alternatively, enter the key directly in the "System Settings" panel in the running web application (stored locally in session memory).

## 23. Production Build
1. Build the production assets:
   ```bash
   npm run build
   ```
2. Start the production HTTP server:
   ```bash
   npm start
   ```
3. The application will start serving index.html on port `8080` (or `process.env.PORT`).

## 24. Google Cloud Run Deployment
The repository includes a ready-to-use production `Dockerfile` and `server.js` setup.
1. Build and submit your container image to Google Artifact Registry:
   ```bash
   gcloud builds submit --tag gcr.io/your-project-id/saferoute-ai
   ```
2. Deploy to Cloud Run:
   ```bash
   gcloud run deploy saferoute-ai \
     --image gcr.io/your-project-id/saferoute-ai \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```
3. Cloud Run will host the image, bind the application automatically to the `$PORT` environment variable, and output your live secure URL.
