# Meta Ads MCP Server

A Vite React + TypeScript application with an MCP (Model Context Protocol) server for Facebook Marketing API automation. Uses Supabase for auth and Facebook OAuth for ad management.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

In another terminal:

```bash
npm run start
```

## Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

### Client-safe (VITE_* - injected into browser)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_FACEBOOK_APP_ID` | Facebook App ID (public) |
| `VITE_APP_URL` | Frontend URL (e.g. `https://localhost:3000`) |
| `VITE_MCP_URL` | MCP server URL (e.g. `http://localhost:3001`) |

### Server-only (never use VITE_ prefix)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `FACEBOOK_APP_SECRET` | Facebook App Secret |
| `FACEBOOK_API_VERSION` | Facebook Graph API version (e.g. `v22.0`) |

### Supabase Edge Function

Set in Supabase Dashboard > Project Settings > Edge Functions:

- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`

These are used by the `exchange-facebook-token` function for OAuth token exchange.

## Local HTTPS (Optional)

For HTTPS in development, place `localhost-key.pem` and `localhost-cert.pem` in the project root. Generate with [mkcert](https://github.com/Filosottile/mkcert):

```bash
mkcert -install
mkcert localhost
```

If certs are missing, Vite falls back to HTTP.

## Production Deployment

### Build

```bash
npm run build
```

### Run MCP Server

```bash
npm run start
```

Or set `PORT` and run:

```bash
PORT=3001 node mcpServer.js --sse
```

### Render / Other Platforms

- Set `PORT` in the environment
- Set all env vars from `.env.example` (server-only vars on the server)
- Build frontend: `npm run build`
- Start: `npm run start` (or `node mcpServer.js --sse`)
- Serve `dist/` from the MCP server (it serves `/static` from `dist`)

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (port 3000) |
| `npm run build` | Build frontend to `dist/` |
| `npm run preview` | Preview production build |
| `npm run start` | Start MCP server with SSE (port 3001) |
| `npm run list-tools` | List available MCP tools |
| `npm run lint` | Run ESLint |

## Architecture

- **Frontend**: Vite + React + TypeScript
- **Auth**: Supabase Auth + Facebook OAuth
- **MCP Server**: Express + SSE transport
- **Tools**: Facebook Marketing API tools in `public/tools/` (load user tokens from Supabase)

## Security

- Never commit `.env` or expose `SUPABASE_SERVICE_ROLE_KEY` or `FACEBOOK_APP_SECRET` to the client
- Only `VITE_*` vars in `SAFE_CLIENT_KEYS` (in `vite.config.ts`) are injected into the browser
- MCP tools use per-user tokens from Supabase
