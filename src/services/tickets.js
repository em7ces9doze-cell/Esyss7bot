"use strict";

function createTickets(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS support_tickets (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT," +
      "guild_id TEXT NOT NULL," +
      "user_id TEXT NOT NULL," +
      "channel_id TEXT NOT NULL UNIQUE," +
      "category TEXT NOT NULL," +
      "status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed'))," +
      "claimed_by TEXT," +
      "created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP," +
      "closed_at TEXT," +
      "closed_by TEXT" +
    ");" +
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_support_active_ticket " +
      "ON support_tickets(guild_id,user_id) WHERE status='open';"
  );

  const findOpen = db.prepare(
    "SELECT * FROM support_tickets WHERE guild_id=? AND user_id=? AND status='open' ORDER BY id DESC LIMIT 1"
  );
  const findByChannel = db.prepare(
    "SELECT * FROM support_tickets WHERE channel_id=? LIMIT 1"
  );
  const findRecent = db.prepare(
    "SELECT * FROM support_tickets WHERE guild_id=? AND user_id=? AND created_at >= datetime('now', ?) ORDER BY id DESC LIMIT 1"
  );

  const createTx = db.transaction(({ guildId, userId, channelId, category }) => {
    const existing = findOpen.get(guildId, userId);
    if (existing) return { created: false, ticket: existing };

    const result = db.prepare(
      "INSERT INTO support_tickets(guild_id,user_id,channel_id,category) VALUES(?,?,?,?)"
    ).run(guildId, userId, channelId, category);

    return {
      created: true,
      ticket: findByChannel.get(channelId) ||
        db.prepare("SELECT * FROM support_tickets WHERE id=?").get(Number(result.lastInsertRowid))
    };
  });

  const claimTx = db.transaction((channelId, actorId) => {
    const ticket = findByChannel.get(channelId);
    if (!ticket || ticket.status !== "open") throw new Error("TICKET_NOT_OPEN");
    if (ticket.claimed_by && ticket.claimed_by !== actorId) {
      return { claimed: false, ticket };
    }
    db.prepare(
      "UPDATE support_tickets SET claimed_by=? WHERE channel_id=? AND status='open' AND claimed_by IS NULL"
    ).run(actorId, channelId);
    return { claimed: true, ticket: findByChannel.get(channelId) };
  });

  const closeTx = db.transaction((channelId, actorId) => {
    const ticket = findByChannel.get(channelId);
    if (!ticket || ticket.status !== "open") return null;
    db.prepare(
      "UPDATE support_tickets SET status='closed',closed_by=?,closed_at=CURRENT_TIMESTAMP WHERE channel_id=? AND status='open'"
    ).run(actorId, channelId);
    return findByChannel.get(channelId);
  });

  return {
    create: createTx,
    findOpen: (guildId, userId) => findOpen.get(guildId, userId) || null,
    findRecent: (guildId, userId, seconds=60) =>
      findRecent.get(guildId, userId, "-" + Math.max(1, Math.min(seconds, 3600)) + " seconds") || null,
    findByChannel: channelId => findByChannel.get(channelId) || null,
    claim: claimTx,
    close: closeTx
  };
}

module.exports = { createTickets };
