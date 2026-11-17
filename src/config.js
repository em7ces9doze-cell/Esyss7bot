'use strict';
const required=['DISCORD_TOKEN','CLIENT_ID','OWNER_ID','GROQ_API_KEY'];
for(const k of required) if(!process.env[k]) throw new Error('Missing environment variable: '+k);
const n=(v,d,min,max)=>Number.isInteger(Number(v))?Math.min(max,Math.max(min,Number(v))):d;
const controlApiUrl=process.env.EM7_CONTROL_API_URL||null;
const controlBridgeSecret=process.env.EM7_CONTROL_BRIDGE_SECRET||null;
if(Boolean(controlApiUrl)!==Boolean(controlBridgeSecret)) throw new Error('EM7_CONTROL_API_URL and EM7_CONTROL_BRIDGE_SECRET must be configured together.');
if(controlApiUrl){const u=new URL(controlApiUrl);if(u.protocol!=='https:')throw new Error('EM7_CONTROL_API_URL must use HTTPS.');if(controlBridgeSecret.length<32)throw new Error('EM7_CONTROL_BRIDGE_SECRET must contain at least 32 characters.');}
module.exports=Object.freeze({discordToken:process.env.DISCORD_TOKEN,clientId:process.env.CLIENT_ID,ownerId:process.env.OWNER_ID,groqApiKey:process.env.GROQ_API_KEY,groqModel:process.env.GROQ_MODEL||'openai/gpt-oss-120b',guildId:process.env.GUILD_ID||null,databasePath:process.env.DATABASE_PATH||'./data/e7.sqlite',maxToolRounds:n(process.env.AI_MAX_TOOL_ROUNDS,5,1,8),dailyAiLimit:n(process.env.AI_DAILY_LIMIT,100,1,1000),controlApiUrl,controlBridgeSecret,controlGuildId:process.env.EM7_CONTROL_GUILD_ID||null,controlPollMs:n(process.env.EM7_CONTROL_POLL_MS,5000,3000,60000)});
