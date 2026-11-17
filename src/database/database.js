'use strict';
const fs=require('node:fs');const path=require('node:path');const Database=require('better-sqlite3');
function openDatabase(file){fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});const db=new Database(file);db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');db.pragma('busy_timeout=5000');db.exec(`
CREATE TABLE IF NOT EXISTS ai_memory(user_id TEXT PRIMARY KEY,history_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,guild_id TEXT,action TEXT NOT NULL,details_json TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_usage(user_id TEXT NOT NULL,day TEXT NOT NULL,requests INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,day));
CREATE TABLE IF NOT EXISTS rate_limits(user_id TEXT PRIMARY KEY,last_request_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS factory_projects(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_id TEXT,template_id TEXT,project_name TEXT,output_path TEXT,created_at TEXT);`);return db;}
module.exports={openDatabase};
