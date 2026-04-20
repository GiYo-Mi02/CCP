# Constitutional Convention Platform (CCP)

A role-based web platform for running constitutional convention workflows end-to-end: session management, period control, delegate submissions, votation, election cycles, realtime monitoring, and admin oversight.

## Project Description

CCP digitizes convention operations that are usually manual and fragmented. It gives delegates a guided workflow across formal periods (quash, amendment, insertion, quick motion, election, final votation), while giving admins centralized control over lifecycle, timers, and visibility into proposals and vote activity.

The system is built with a modern Next.js App Router architecture and Supabase for authentication, authorization, persistence, and realtime updates.

## Core Objectives

1. Provide a secure delegate workflow for submitting and voting on motions.
2. Provide a protected admin control panel for session and period operations.
3. Keep voting and election data auditable and transparent for authorized users.
4. Support realtime visibility for active convention operations.
5. Scale for concurrent usage during peak convention activity.

## Current Feature Set

### Delegate Experience

1. Authenticated access to the convention dashboard.
2. Period-specific pages for:
   - Quashing
   - Amendment
   - Insertion
   - Quick Motion
   - Plenary and Committee Elections
   - Final Votation
3. Motion submission and voting flows tied to period state.
4. Realtime auto-refresh behavior for period and vote updates.

### Admin Experience

1. Protected admin dashboard with role enforcement.
2. Session and period lifecycle controls.
3. Global votation timer control.
4. Stage advancement and vote reset operations.
5. Election candidate and position management UI.
6. ER monitoring dashboard for period, motion, vote, and election visibility.
7. Period detail review pages for proposal and voter-level transparency.

### Operations and Testing

1. Scripted admin promotion and flow initialization.
2. Election cycle scaffolding script.
3. Phase-2 concurrent load simulation script.
4. Load-test data cleanup script.

## Tech Stack

### Frontend

1. Next.js 15 (App Router)
2. React 19
3. TypeScript
4. Tailwind CSS 4
5. Recharts (visualizations)
6. Lucide React (icons)

### Backend and Data

1. Supabase Auth
2. Supabase Postgres
3. Supabase Realtime
4. Row Level Security (RLS) policies
5. Postgres functions for atomic vote casting and result aggregation

### Tooling

1. ESLint 9
2. Node.js runtime scripts for setup, testing, and cleanup

## Current Architecture

CCP uses a server-first architecture with client-side interactivity where needed.

1. Routing and Rendering:
   - Next.js App Router with mixed Server and Client Components.
2. Access Control Layer:
   - Request-time middleware checks for protected routes.
   - Role checks on admin layout/actions.
3. Domain Logic Layer:
   - Server Actions in lib/actions for motions, votes, periods, elections, auth, and profile operations.
4. Data Layer:
   - Supabase Postgres with enum-driven lifecycle/state models.
   - RLS policies enforce authenticated and admin boundaries.
5. Realtime Layer:
   - Supabase Realtime subscriptions with route refresh hooks.
   - Fallback resilience logic to avoid hard UI stalls during transient failures.

### High-Level Request Flow

1. Browser request enters middleware auth guard.
2. Server component fetches session/profile/domain data.
3. Client interactions trigger server actions.
4. DB updates revalidate target routes and emit realtime events.
5. Subscribed clients refresh and reflect new state.

## Data Model Overview

Primary entities:

1. profiles (admin and delegate identities)
2. sessions (active convention context)
3. periods (ordered lifecycle stages within a session)
4. motions (delegate proposals by motion type)
5. votes (delegate votes on motions)
6. elections
7. election_positions
8. candidates
9. election_votes

Important enums include user_role, period_type, period_state, motion_type, vote_value, and election_status.

## Environment Variables

Create a .env.local file with the following values:

1. NEXT_PUBLIC_SUPABASE_URL
2. NEXT_PUBLIC_SUPABASE_ANON_KEY
3. NEXT_PUBLIC_APP_URL (example: http://localhost:3000)
4. GEMINI_API_KEY (optional, only if AI features are used)
5. SUPABASE_SERVICE_ROLE_KEY (required for admin/setup/testing scripts)

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run development server:

```bash
npm run dev
```

3. Build and run production mode:

```bash
npm run build
npm run start -- -p 3000
```

## NPM Scripts

1. dev: run Next.js development server
2. build: create production build
3. start: run production server
4. lint: run ESLint
5. clean: run Next clean
6. test:phase2: run 65-delegate simulation suite
7. db:cleanup-loadtest: remove load-test users and generated artifacts

## Setup and Operations Scripts

All scripts live in scripts/.

1. promote-admin.mjs
   - Grants admin role to a user profile.
   - Usage example:
   ```bash
   node scripts/promote-admin.mjs --email your@email.com
   ```

2. init-convention-flow.mjs
   - Ensures active session and required periods.
   - Can seed demo final votation motions when empty.

3. init-election-cycle.mjs
   - Ensures active election, positions, and candidate scaffolding.

4. phase2-loadtest.mjs
   - End-to-end simulation for concurrent delegates (auth, routes, writes, realtime).

5. reset-loadtest-data.mjs
   - Removes load-test accounts and related test artifacts.

## Realtime Notes

Realtime is used for live UI updates on key views (home, period pages, election pages, admin dashboards). Ensure your Supabase realtime publication includes relevant tables (periods, motions, votes, elections, election_positions, candidates, election_votes, sessions).

## Security Model

1. Middleware-level protection for non-public routes.
2. Role-based admin access checks in server logic.
3. RLS across all core tables.
4. Immutable vote constraints via unique keys and atomic DB function for cast_vote.

## Performance and Load Testing

The repository includes a realistic phase-2 load harness for concurrent delegate simulation. This is intended to test:

1. Authentication throughput under concurrency
2. Authenticated route responsiveness
3. Concurrent submission and voting writes
4. Realtime event fanout coverage

Use:

```bash
$env:LOADTEST_BASE_URL='http://localhost:3000'; npm run test:phase2
```

## Project Status

The platform is actively evolving with ongoing performance hardening, realtime reliability improvements, and admin workflow polish.
