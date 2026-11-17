'use strict';
const fs=require('node:fs');const path=require('node:path');const Database=require('better-sqlite3');
function openDatabase(file){
 fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
 const db=new Database(file);db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');db.pragma('busy_timeout=5000');
 db.exec(`
 CREATE TABLE IF NOT EXISTS ai_memory(user_id TEXT PRIMARY KEY,history_json TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,guild_id TEXT,action TEXT NOT NULL,details_json TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS daily_usage(user_id TEXT NOT NULL,day TEXT NOT NULL,requests INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS rate_limits(user_id TEXT PRIMARY KEY,last_request_ms INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS factory_projects(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT,template_id TEXT,project_name TEXT,output_path TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS control_commands(command_id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,result_json TEXT,created_at TEXT NOT NULL,completed_at TEXT);
 CREATE TABLE IF NOT EXISTS em7_wallets(user_id TEXT PRIMARY KEY,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS em7_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,delta INTEGER NOT NULL,balance_after INTEGER NOT NULL,kind TEXT NOT NULL,reference TEXT,actor_id TEXT NOT NULL,details TEXT,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_em7_ledger_user ON em7_ledger(user_id,id DESC);
 CREATE TABLE IF NOT EXISTS em7_coin_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,coins INTEGER NOT NULL,probot_credits TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by TEXT);
 CREATE TABLE IF NOT EXISTS em7_purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,plan TEXT NOT NULL,coins_paid INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
 `);
 return db;
}
module.exports={openDatabase};
