# E7 Bot
Arabic-first Discord.js v14 assistant with Groq tool calling, SQLite persistence, security controls and a 24-template bot factory.

## Deploy
Node.js 22.12+. Install with `npm install`, start with `npm start`.
Set `DISCORD_TOKEN`, `CLIENT_ID`, `OWNER_ID`, `GROQ_API_KEY` in FadeHost environment variables. Optional: `GROQ_MODEL`, `GUILD_ID`, `DATABASE_PATH`, `AI_MAX_TOOL_ROUNDS`, `AI_DAILY_LIMIT`.
Invite with `bot` and `applications.commands`. Do not grant Administrator by default.

## Commands
`/e7 ask`, `/e7 status`, `/e7 help`, `/e7 security`; `/botfactory list`, `/botfactory create`, `/botfactory info`.

## Factory
Creates starter source projects from 24 templates. Each generated project requires its own Discord application, token, review, environment variables and deployment. It does not provision Discord applications or hosting automatically.

## Security
Only OWNER_ID can use management commands. AI can call an explicit allowlist only; no shell, eval, arbitrary JavaScript or arbitrary HTTP. New roles have no permissions. Discord permission checks and role hierarchy still apply. Keep secrets only in FadeHost, never GitHub.

Run `npm run check` and `npm test`. These are local checks, not live Discord/Groq integration tests. Use persistent storage for the SQLite file.
