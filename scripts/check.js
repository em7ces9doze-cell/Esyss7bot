"use strict";
const fs = require("node:fs");
const path = require("node:path");
const files = ["src/config.js","src/database.js","src/services/commerce.js","src/services/tickets.js","src/services/ai.js","src/commands/definitions.js","src/commands/deploy.js","src/handlers/interactions.js","src/index.js"];
let failed = false;
for (const file of files) { try { new Function(fs.readFileSync(path.resolve(file), "utf8")); process.stdout.write("OK  " + file + "\n"); } catch (error) { failed = true; process.stderr.write("ERR " + file + ": " + error.message + "\n"); } }
if (failed) process.exitCode = 1;
