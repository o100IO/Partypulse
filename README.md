# Partypulse (EventPulse)

Live party engagement app: hosts/DJs and venue owners run events on desktop; guests join via QR/link on mobile.

**Repo:** https://github.com/o100IO/Partypulse

## Stack

- Vite + React + TypeScript + Tailwind + shadcn/ui
- Supabase (Auth, Postgres, Realtime)
- Roles: `guest`, `dj`, `venue_owner`, `bartender`

## Local setup

1. Clone and install:

```sh
git clone https://github.com/o100IO/Partypulse.git
cd Partypulse
npm i
```

2. Copy env and set your Supabase project:

```sh
cp .env.example .env
```

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

3. Apply SQL migrations in `supabase/migrations/` to your Supabase project (CLI or dashboard) if the remote DB is behind.

4. Run the web app (desktop host + guest):

```sh
npm run dev
```

Dev server: http://localhost:8080 (LAN-accessible for phone testing).

## Sandbox smoke path

1. Sign up as **dj**
2. Create an event → set status **live**
3. Open the event QR / share `/e/:eventId`
4. As guest: request songs, vote; sign in and use **Add 1000 Test Points** for tips/tickets

Join policy (open vs restricted) is host-configurable per event.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## Mobile (Capacitor)

Android/iOS Capacitor packaging is part of the sandbox roadmap. Until then, use a phone browser against the LAN Vite URL or the deployed site.
