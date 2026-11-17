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

## EM7 Coins and trial store commands

The current test exchange rate is **90,000,000 ProBot Credits = 1 EM7 Coin**. Initial package prices are provisional test values:
- Starter: 5 Coins
- Basic: 10 Coins
- Pro: 20 Coins
- Ultimate: 40 Coins

Discord commands:
- `/e7 balance`: show the caller's wallet.
- `/e7 shop`: list test hosting packages.
- `/e7 buy-plan`: deduct coins and create a purchase record.
- `/e7 request-coins`: create a pending ProBot top-up request.
- `/e7 ledger`: show the caller's recent ledger entries.
- `/e7 requests`: owner-only list of pending top-up requests.
- `/e7 approve-request`: owner-only credit after independently verifying the ProBot transfer.
- `/e7 credit`: owner-only manual adjustment with a reason.
- `/e7 test-room`: owner-only private text room for permission tests.

**Payment safety:** the bot does not infer payment from screenshots or ordinary chat messages and does not auto-credit ProBot transfers. The owner must verify the transfer independently, then approve its request. Coin purchases currently create a recorded order with status `pending_provisioning`; they do not deploy or provision a live hosting instance. Hosting automation must be connected separately.

Run `npm run deploy` after updating command definitions so Discord receives the new slash commands. Run `npm test` and `npm run check` before restarting the production bot.
