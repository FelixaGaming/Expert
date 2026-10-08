# FELIXA Experts MVP

Automated behavioral intelligence and public-perception analytics for experts, advisors and consultants: see yourself the way others see you, and shape your presence, PR and revenue.

Enter a name and a few details. The app discovers public profiles, lets you verify which are really yours, scrapes them, and uses Gemini (with Google Search grounding) to produce a perception report: archetype, outer impression, perception gaps, and recommendations.

## Quick start

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Without a `GEMINI_API_KEY` the app still runs, using built-in demo data instead of live analysis.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite dev server |
| `npm run build` | Build the client and bundle the server into `dist/` |
| `npm start` | Run the production build (`NODE_ENV=production`) |
| `npm run typecheck` | TypeScript check |

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Required for live analysis. Server-side only, never sent to the browser. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Any Gemini model that supports Google Search grounding. |
| `PORT` | `3000` | |
| `RATE_LIMIT_PER_MIN` | `60` | Per-IP limit on `/api` routes. |

## Production

```bash
npm run build
GEMINI_API_KEY=... npm start
```

## Privacy and responsible use

The app searches and scrapes public information about named individuals. Use it on yourself or with the subject's consent, and comply with the terms of the sites involved and applicable privacy law. The scraper refuses requests to private/internal network addresses.

## License

MIT
