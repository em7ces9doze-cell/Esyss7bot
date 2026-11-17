# EM7 CONTROL ↔ EM7 SYSTEM bridge contract

This document defines the initial polling contract implemented by EM7 SYSTEM.

## Security configuration

Set these environment variables on the bot host (FadeHost):

- `EM7_CONTROL_API_URL`: HTTPS origin of the EM7 CONTROL backend, without a trailing slash.
- `EM7_CONTROL_BRIDGE_SECRET`: a unique random secret of at least 32 characters. Configure the exact same value in the EM7 CONTROL backend secret store. Never commit it.
- `EM7_CONTROL_GUILD_ID`: optional Discord server ID allowlist. Strongly recommended.
- `EM7_CONTROL_POLL_MS`: optional polling interval; defaults to 5000 ms.

The Discord bot token remains in `DISCORD_TOKEN` on FadeHost. It is not sent to EM7 CONTROL by this bridge.

## Claim

The bot sends an authenticated POST to:

`/api/internal/discord/commands/claim`

Headers:
- `Authorization: Bearer <EM7_CONTROL_BRIDGE_SECRET>`
- `Content-Type: application/json`

Body:
```json
{
  "botUserId": "DISCORD_BOT_USER_ID",
  "guildId": "OPTIONAL_ALLOWED_GUILD_ID"
}
```

Return HTTP 200:
```json
{ "command": null }
```

or one command:
```json
{
  "command": {
    "id": "unique-command-id",
    "action": "create_server_structure",
    "guildId": "DISCORD_SERVER_ID",
    "payload": {
      "roles": [
        { "name": "Support", "color": "#5865F2" }
      ],
      "categories": [
        {
          "name": "General",
          "channels": [
            { "name": "welcome", "type": "text" },
            { "name": "Voice Lounge", "type": "voice" }
          ]
        }
      ]
    }
  }
}
```

Supported actions:
- `create_server_structure`
- `create_text_channel` with payload `{ "name": "general" }`
- `create_role` with payload `{ "name": "Support", "color": "#5865F2" }`

Role permissions are deliberately empty by default. The bot does not delete existing Discord resources, execute arbitrary code, or accept shell commands.

## Completion

After execution, EM7 SYSTEM sends an authenticated POST to:

- `/api/internal/discord/commands/{id}/complete`

Success body:
```json
{ "status": "completed", "result": { "ok": true, "roles": [], "categories": [], "channels": [] } }
```

Failure body:
```json
{ "status": "failed", "error": "Short safe error message" }
```

## Backend requirements

- Authenticate the shared secret using constant-time comparison where possible.
- Never expose this internal API to browsers.
- Enforce a per-bot and per-guild command queue.
- Return at most one claimed command per poll.
- Use unique command IDs and make claim/complete transitions atomic.
- Restrict actions to the allowlist above.
- Validate all payloads and apply rate limits.
- Require the authenticated administrator to confirm destructive or high-impact actions. This bridge currently implements create-only operations.
- Do not put Discord bot tokens in command payloads or logs.
