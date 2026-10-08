# ExpertScan

See yourself the way others see you. Enter a name; ExpertScan finds public profiles, lets you confirm which are really yours, reads them, and writes a perception report: archetype, outer impression, perception gaps and recommendations.

**Free for visitors; the owner's OpenAI account pays the usage.** No account and no key needed. The site owner sets a server key for **OpenAI** (Gemini and Anthropic are also supported). Visitors can optionally use their own key instead; it stays in their browser and is never stored on the server.

Every profile, fact and report comes from live web search and scraping. The app contains no sample data.

## Run locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY
npm run dev                  # http://localhost:3000
```

## Providers

| Provider | Default model | Web search |
| --- | --- | --- |
| Gemini | `gemini-2.5-flash` | Google Search grounding |
| OpenAI | `gpt-4o-mini` | Responses API `web_search` tool |
| Anthropic | `claude-haiku-4-5` | `web_search` tool |

Set `AI_PROVIDER` to choose which one is used when several keys exist. Web search must be available on the key's account.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Express + Vite dev server |
| `npm run build` | Build the client and bundle the server into `dist/` |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript check |

## Deploy on Render (free)

1. Push this repo to GitHub.
2. On [render.com](https://render.com): **New → Blueprint**, select the repo. `render.yaml` sets up the free web service.
4. Open the URL Render gives you. The free tier sleeps when idle, so the first load can take about a minute.

3. In the service's **Environment** tab add `OPENAI_API_KEY`. Without a key the app falls back to a keyless mode that is often unavailable.

Optional: `RATE_LIMIT_PER_MIN` (default 60 per IP).

## Safety notes

- Server-side fetches block private and internal addresses (SSRF protection).
- `/api` routes are rate limited per IP.
