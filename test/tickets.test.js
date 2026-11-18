"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase } = require("../src/database");
const { createTickets } = require("../src/services/tickets");

test("ticket service prevents multiple open tickets for the same user and guild", () => {
  const db = openDatabase(":memory:");
  const tickets = createTickets(db);
  const first = tickets.create({
    guildId: "guild-1",
    userId: "user-1",
    channelId: "channel-1",
    category: "hosting"
  });
  const duplicate = tickets.create({
    guildId: "guild-1",
    userId: "user-1",
    channelId: "channel-2",
    category: "billing"
  });
  assert.equal(first.created, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.ticket.channel_id, "channel-1");
  db.close();
});

test("ticket claim is exclusive and close records actor", () => {
  const db = openDatabase(":memory:");
  const tickets = createTickets(db);
  tickets.create({
    guildId: "guild-2",
    userId: "user-2",
    channelId: "channel-3",
    category: "technical"
  });
  const firstClaim = tickets.claim("channel-3", "owner-1");
  const secondClaim = tickets.claim("channel-3", "owner-2");
  assert.equal(firstClaim.claimed, true);
  assert.equal(secondClaim.claimed, false);
  const closed = tickets.close("channel-3", "owner-1");
  assert.equal(closed.status, "closed");
  assert.equal(closed.closed_by, "owner-1");
  assert.equal(tickets.close("channel-3", "owner-1"), null);
  db.close();
});

test("closed ticket allows the user to open a new ticket", () => {
  const db = openDatabase(":memory:");
  const tickets = createTickets(db);
  tickets.create({
    guildId: "guild-3",
    userId: "user-3",
    channelId: "channel-4",
    category: "other"
  });
  tickets.close("channel-4", "user-3");
  assert.ok(tickets.findRecent("guild-3", "user-3", 60));
  const next = tickets.create({
    guildId: "guild-3",
    userId: "user-3",
    channelId: "channel-5",
    category: "billing"
  });
  assert.equal(next.created, true);
  assert.equal(next.ticket.channel_id, "channel-5");
  db.close();
});
