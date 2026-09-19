# Quran Website — Back-end

Node.js + Express API that handles everything the front-end can't do on its
own: accounts, password hashing, bookmarks, and reading progress. It does
**not** serve the Qur'an text or audio — those are static files in
`../front-end/js/data/`, loaded directly by the browser for speed.

## Stack
- Express (HTTP server)
- better-sqlite3 (file-based database — no separate DB server to install)
- bcryptjs (password hashing, 12 salt rounds)
- jsonwebtoken + an httpOnly cookie (session handling)
- express-rate-limit (basic brute-force protection on login/signup)

## Setup

```bash
cd back-end
npm install
cp .env.example .env
```

Open `.env` and set `JWT_SECRET` to a real random string:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste the output as `JWT_SECRET`. The server refuses to start with the
placeholder value, on purpose — that's what stops anyone shipping this with
a guessable secret.

Set `CORS_ORIGIN` to wherever the front-end is served from (e.g.
`http://localhost:5500` if you use VS Code's Live Server, or your real
domain in production).

Then run:

```bash
npm start
```

The API listens on `http://localhost:4000` by default. A SQLite file is
created automatically at `./data/quran.db` on first run.

## Endpoints

| Method | Path                 | Auth | Description |
|--------|----------------------|------|--------------|
| POST   | /api/auth/signup     | —    | Create an account |
| POST   | /api/auth/login      | —    | Sign in |
| POST   | /api/auth/logout     | —    | Clear the session |
| GET    | /api/auth/me         | ✓    | Current user |
| GET    | /api/bookmarks       | ✓    | List bookmarks |
| POST   | /api/bookmarks       | ✓    | Add a bookmark `{surahNumber, surahName, ayahNumber}` |
| DELETE | /api/bookmarks/:id   | ✓    | Remove a bookmark |
| GET    | /api/progress        | ✓    | Get saved reading position |
| PUT    | /api/progress        | ✓    | Update reading position `{surahNumber, ayahNumber}` |

All responses are JSON. Errors come back as `{ "error": "human-readable message" }`
with an appropriate HTTP status — the front-end shows these directly rather
than a generic failure.

## Security notes
- Passwords are never stored in plain text — only a bcrypt hash.
- Sessions are httpOnly cookies (not readable by JavaScript), signed with `JWT_SECRET`.
- Set `NODE_ENV=production` once you're serving over HTTPS — this makes the
  session cookie `Secure` (HTTPS-only).
- Nothing here logs or exposes passwords or the JWT secret to the client.

## What's intentionally not included
- **Forgot password / email**: doing this properly needs a real email
  provider (e.g. Resend, SendGrid, Postmark) and a domain to send from. Wiring
  a fake version would mean a "Forgot password" button that doesn't actually
  send anything — worse than not having the button. Add a `/api/auth/forgot`
  + `/api/auth/reset` pair once you've picked a provider; the `users` table
  already has everything needed to add a `reset_token` column.
- **Admin panel**: not scoped tightly enough in the brief to build safely
  (which data, which actions, whose access). Happy to build it as a follow-up
  once you say what an admin needs to see/do.

## Deploying
This is a plain Node app — it runs on Render, Railway, Fly.io, a small VPS,
or anywhere else that runs `npm install && npm start`. Because it uses a
local SQLite file, use a host with persistent disk (not a purely serverless/
ephemeral one) or swap `better-sqlite3` for a hosted Postgres later if you
outgrow it.
