'use strict';
const fs=require('node:fs');
for(const p of ['src/index.js','src/config.js','src/database.js','src/commands/definitions.js','src/handlers/interactions.js','src/services/commerce.js']){
 if(!fs.existsSync(p)){console.error('Missing '+p);process.exitCode=1;}
}
if(!process.exitCode) console.log('EM7 V6 structure OK');