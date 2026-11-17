'use strict';
const fs=require('node:fs'),path=require('node:path'),Database=require('better-sqlite3');
function openDatabase(filename){
 const full=path.resolve(filename);fs.mkdirSync(path.dirname(full),{recursive:true});
 const db=new Database(full);db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
 db.exec("CREATE TABLE IF NOT EXISTS wallets(user_id TEXT PRIMARY KEY,balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);"+
 "CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,delta INTEGER NOT NULL,balance_after INTEGER NOT NULL,kind TEXT NOT NULL,reference TEXT,actor_id TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);"+
 "CREATE TABLE IF NOT EXISTS coin_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,coins INTEGER NOT NULL,credits TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at TEXT NOT NULL,reviewed_at TEXT,reviewed_by TEXT);"+
 "CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,plan TEXT NOT NULL,coins_paid INTEGER NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);"+
 "CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_id TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT,details TEXT NOT NULL,created_at TEXT NOT NULL);");
 return db;
}
module.exports={openDatabase};