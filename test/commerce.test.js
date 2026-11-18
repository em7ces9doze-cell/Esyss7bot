"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { openDatabase } = require("../src/database");
const { createCommerce } = require("../src/services/commerce");
const { mergeApplicationCommands } = require("../src/commands/deploy");

test("wallet credits, debits and records ledger", () => {
  const db = openDatabase(":memory:");
  const commerce = createCommerce(db);
  assert.equal(commerce.balance("u1"), 0);
  assert.equal(commerce.credit("u1", 25, "seed", "owner"), 25);
  assert.equal(commerce.debit("u1", 5, "test", "u1"), 20);
  assert.equal(commerce.balance("u1"), 20);
  assert.equal(commerce.ledger("u1").length, 2);
  db.close();
});

test("top-up request is not credited before approval and cannot be approved twice", () => {
  const db = openDatabase(":memory:");
  const commerce = createCommerce(db);
  const id = commerce.requestTopup("u2", 12, "payment reference");
  assert.equal(commerce.balance("u2"), 0);
  assert.equal(commerce.approveTopup(id, "owner").balance, 12);
  assert.throws(() => commerce.approveTopup(id, "owner"), /already reviewed/);
  assert.equal(commerce.balance("u2"), 12);
  db.close();
});

test("rejected top-up requests are not credited and cannot be reviewed twice", () => {
  const db = openDatabase(":memory:");
  const commerce = createCommerce(db);
  const id = commerce.requestTopup("u4", 50, "test request");
  const rejected = commerce.rejectTopup(id, "owner", "missing payment proof");
  assert.equal(rejected.userId, "u4");
  assert.equal(rejected.amount, 50);
  assert.equal(commerce.balance("u4"), 0);
  assert.throws(() => commerce.rejectTopup(id, "owner", "duplicate"), /already reviewed/);
  assert.throws(() => commerce.approveTopup(id, "owner"), /already reviewed/);
  db.close();
});

test("command registration preserves unrelated commands and replaces EM7", () => {
  const registered = [
    { id: "legacy-id", application_id: "app-id", name: "moderation", description: "mod", type: 1 },
    { id: "old-e7-id", application_id: "app-id", name: "e7", description: "old EM7", type: 1 },
    { id: "legacy-botfactory-id", application_id: "app-id", name: "botfactory", description: "legacy", type: 1 },
    { id: "music-id", application_id: "app-id", name: "music", description: "music", type: 1 }
  ];
  const desired = [{ name: "e7", type: 1, description: "new EM7" }];
  assert.deepEqual(
    mergeApplicationCommands(registered, desired),
    [
      { name: "moderation", type: 1, description: "mod" },
      { name: "music", type: 1, description: "music" },
      { name: "e7", type: 1, description: "new EM7" }
    ]
  );
});

test("command registration handles empty existing command list", () => {
  assert.deepEqual(mergeApplicationCommands([], [{ name: "e7" }]), [{ name: "e7" }]);
});
