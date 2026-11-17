"use strict";
function required(name) { const value = process.env[name]?.trim(); if (!value) throw new Error("Missing required environment variable: " + name); return value; }
function optional(name, fallback = "") { return process.env[name]?.trim() || fallback; }
function loadConfig() {
 const config = { token: required("DISCORD_TOKEN"), clientId: required("CLIENT_ID"), ownerId: required("OWNER_ID"), guildId: optional("GUILD_ID"), groqApiKey: optional("GROQ_API_KEY"), groqModel: optional("GROQ_MODEL", "llama-3.3-70b-versatile"), databasePath: optional("DATABASE_PATH", "./data/em7.sqlite"), logLevel: optional("LOG_LEVEL", "info") };
 for (const key of ["clientId","ownerId","guildId"]) if (config[key] && !/^\d{17,20}$/.test(config[key])) throw new Error("Invalid Discord ID in " + key.toUpperCase());
 if (config.token.length < 40) throw new Error("DISCORD_TOKEN appears invalid");
 return Object.freeze(config);
}
module.exports = { loadConfig };
