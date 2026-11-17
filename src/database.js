"use strict";
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
function openDatabase(filename) {
 if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
 const db = new Database(filename);
 db.pragma("journal_mode = WAL"); db.pragma("foreign_keys = ON"); db.pragma("busy_timeout = 5000");
 db.exec("CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
 "CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, delta INTEGER NOT NULL, balance_after INTEGER NOT NULL CHECK(balance_after >= 0), reason TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
 "CREATE TABLE IF NOT EXISTS topup_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount > 0), note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), reviewed_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT);" +
 "CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, plan TEXT NOT NULL, price INTEGER NOT NULL CHECK(price > 0), status TEXT NOT NULL DEFAULT 'pending_provisioning', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
 "CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);" +
 "CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, id DESC); CREATE INDEX IF NOT EXISTS idx_topups_status ON topup_requests(status, id);");
 return db;
}
module.exports = { openDatabase };
