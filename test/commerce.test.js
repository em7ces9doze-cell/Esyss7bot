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

test("purchase debits wallet and remains pending provisioning", () => {
  const db = openDatabase(":memory:");
  const commerce = createCommerce(db);
  commerce.credit("u3", 20, "seed", "owner");
  const purchase = commerce.buyPlan("u3", "pro");
  assert.equal(purchase.status, "pending_provisioning");
  assert.equal(commerce.balance("u3"), 0);
  db.close();
});

test("command registration preserves unrelated commands and replaces EM7", () => {
  const registered = [
    { name: "moderation" },
    { name: "e7", description: "old EM7" },
    { name: "botfactory" },
    { name: "music" }
  ];
  const desired = [{ name: "e7", description: "new EM7" }];
  assert.deepEqual(
    mergeApplicationCommands(registered, desired),
    [
      { name: "moderation" },
      { name: "music" },
      { name: "e7", description: "new EM7" }
    ]
  );
});

test("command registration handles empty existing command list", () => {
  assert.deepEqual(mergeApplicationCommands([], [{ name: "e7" }]), [{ name: "e7" }]);
});
