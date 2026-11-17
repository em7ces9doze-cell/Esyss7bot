'use strict';
const required=['DISCORD_TOKEN','CLIENT_ID','OWNER_ID','GROQ_API_KEY'];
for(const k of required) if(!process.env[k]) throw new Error('Missing environment variable: '+k);
const n=(v,d,min,max)=>Number.isInteger(Number(v))?Math.min(max,Math.max(min,Number(v))):d;
module.exports=Object.freeze({discordToken:process.env.DISCORD_TOKEN,clientId:process.env.CLIENT_ID,ownerId:process.env.OWNER_ID,groqApiKey:process.env.GROQ_API_KEY,groqModel:process.env.GROQ_MODEL||'openai/gpt-oss-120b',guildId:process.env.GUILD_ID||null,databasePath:process.env.DATABASE_PATH||'./data/e7.sqlite',maxToolRounds:n(process.env.AI_MAX_TOOL_ROUNDS,5,1,8),dailyAiLimit:n(process.env.AI_DAILY_LIMIT,100,1,1000)});
