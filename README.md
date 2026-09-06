# WAVE — Internet Walkie-Talkie & Dispatch Net

A retro-brutalist push-to-talk (PTT) walkie-talkie web platform featuring real-time WebRTC mesh audio, server-authoritative transmission locks, customizable radio dispatch channels, Google Authentication, and persistent relational data storage with Cloud SQL (PostgreSQL).

---

## Features

- **Push-to-Talk (PTT) Engine**:
  - WebRTC mesh audio streaming with hardware-accelerated processing.
  - Server-authoritative transmission lock preventing overlapping chatter on single frequencies.
  - Tactical Carrier Tone test mode for audio and PTT verification even without microphone permissions in sandboxed previews.
  - Real-time VU meter with audio activity monitoring.

- **Servers & Frequencies**:
  - Create and join tactical radio servers with shareable invite codes (`WAVE-XXXXXX`).
  - Public dispatch channels and restricted private command nets.
  - Role-based access control (Owner, Admin, Member).

- **Cloud Relational Persistence**:
  - Backed by PostgreSQL via **Google Cloud SQL** (region: `asia-southeast1`).
  - Managed schemas and type-safe database queries via **Drizzle ORM**.
  - Server rosters, member permissions, and channel hierarchies persisted across sessions.

- **Authentication**:
  - Sign in with **Google** powered by Firebase Authentication.
  - Fast instant callsign generator for rapid dispatch testing.

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Canvas VU Meter, Web Audio API
- **Backend**: Node.js, Express, WebSocket (`ws`) Server for real-time signaling & PTT locks
- **Database**: PostgreSQL (Cloud SQL) with Drizzle ORM
- **Signaling & Media**: WebRTC peer connections with STUN/TURN fallback and WebSocket signaling
- **Authentication**: Firebase Authentication (Google Identity Provider)

---

## Project Structure

```
├── server.ts                 # Express + WebSocket radio signaling server
├── src/
│   ├── App.tsx               # Main UI and application lifecycle state
│   ├── components/
│   │   ├── voice/            # Voice console, VU meter, PTT button, carrier tone
│   │   ├── dashboard/        # Server channels, member list, dispatch controls
│   │   ├── auth/             # Authentication modal (Google & Callsign)
│   │   ├── modals/           # Create/Join server, channel management
│   │   └── ui/               # Retro-brutalist UI primitives
│   ├── db/
│   │   ├── schema.ts         # PostgreSQL relational schema
│   │   ├── queries.ts        # Type-safe Drizzle ORM queries
│   │   └── index.ts          # Database pool connection
│   ├── lib/
│   │   ├── firebase.ts       # Firebase Client SDK
│   │   └── webrtc/           # WebRTC manager & WebSocket signaling client
│   └── types/                # TypeScript interfaces and channel definitions
├── drizzle.config.ts         # Drizzle configuration
└── metadata.json             # AI Studio applet metadata
```

---

## Getting Started Locally

### Prerequisites

- Node.js 18+
- npm or pnpm
- A PostgreSQL database instance or Cloud SQL proxy

### Installation

1. Clone or export the repository:
   ```bash
   git clone <your-repo-url>
   cd wave-walkie-talkie
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your configuration:
   ```bash
   cp .env.example .env
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open your browser at `http://localhost:3000`.

---

## Production Build

```bash
npm run build
npm start
```

---

## Deploying to Vercel

The project includes pre-configured `vercel.json` and a Serverless Function entry point in `/api/index.ts`:

1. **Push or Export to GitHub**:
   Use AI Studio's **Export to GitHub** feature.
2. **Import into Vercel**:
   Go to [Vercel Dashboard](https://vercel.com/new) and import your GitHub repository.
3. **Build & Output Settings**:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables**:
   Under project settings in Vercel, add your database credentials:
   - `SQL_HOST`: *(e.g. Neon or Cloud SQL public IP)*
   - `SQL_USER`: *(your database user)*
   - `SQL_PASSWORD`: *(your database password)*
   - `SQL_DB_NAME`: *(your database name)*
   - `SQL_PORT`: `5432`
   - *(Optional)* `VITE_SIGNALING_SERVER_URL`: `wss://your-webrtc-signaling-service.com/ws` if running the live WebRTC audio signaling on a separate continuous WebSocket host (like Render or Cloud Run).
5. Click **Deploy**.
