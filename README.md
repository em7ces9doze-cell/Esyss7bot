# E7 Bot

Arabic-first Discord.js v14 assistant with Groq tool calling, SQLite persistence, security controls and a 24-template bot factory.

## Deploy

Node.js 22.12+. Install with `npm install`, start with `npm start`.

Required FadeHost environment variables:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `OWNER_ID`
- `GROQ_API_KEY`

Optional:
- `GROQ_MODEL`
- `GUILD_ID`
- `DATABASE_PATH`
- `AI_MAX_TOOL_ROUNDS`
- `AI_DAILY_LIMIT`

### EM7 CONTROL bridge

The optional outbound bridge lets the existing bot receive approved server-management jobs from the private EM7 CONTROL backend. It uses HTTPS polling; no inbound port is opened.

Set these additional variables on FadeHost and configure the matching bridge secret in the EM7 CONTROL backend:
- `EM7_CONTROL_API_URL`: HTTPS base URL of the EM7 CONTROL backend.
- `EM7_CONTROL_BRIDGE_SECRET`: unique random secret, at least 32 characters.
- `EM7_CONTROL_GUILD_ID`: recommended server ID allowlist.
- `EM7_CONTROL_POLL_MS`: optional, 3000–60000 ms; default 5000.

Keep `DISCORD_TOKEN` in FadeHost. Never commit it or put it in GitHub. The bridge secret is separate from the Discord bot token. See [docs/EM7_CONTROL_BRIDGE.md](docs/EM7_CONTROL_BRIDGE.md) for the exact API contract and supported create-only actions.

Invite with `bot` and `applications.commands`. Do not grant Administrator by default.

## Commands

`/e7 ask`, `/e7 status`, `/e7 help`, `/e7 security`; `/botfactory list`, `/botfactory create`, `/botfactory info`.

## Factory

Creates starter source projects from 24 templates. Each generated project requires its own Discord application, token, review, environment variables and deployment. It does not provision Discord applications or hosting automatically.

## Security

Only OWNER_ID can use management commands. AI can call an explicit allowlist only; no shell, eval, arbitrary JavaScript or arbitrary HTTP. New roles have no permissions. Discord permission checks and role hierarchy still apply. Keep secrets only in FadeHost/backend secret storage, never GitHub.

Run `npm run check` and `npm test`. These are local checks, not live Discord/Groq integration tests. Use persistent storage for the SQLite file.
