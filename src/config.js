'use strict';
function required(k){const v=process.env[k];if(!v||!v.trim())throw new Error('Missing environment variable: '+k);return v.trim();}
function loadConfig(){return Object.freeze({
 token:required('DISCORD_TOKEN'),clientId:required('CLIENT_ID'),ownerId:required('OWNER_ID'),
 guildId:process.env.GUILD_ID||'',databasePath:process.env.DATABASE_PATH||'./data/em7.sqlite',
 groqApiKey:process.env.GROQ_API_KEY||'',groqModel:process.env.GROQ_MODEL||'llama-3.3-70b-versatile'
});}
module.exports={loadConfig};