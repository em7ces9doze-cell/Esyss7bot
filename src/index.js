'use strict';
const {Client,GatewayIntentBits,Events}=require('discord.js');
const {loadConfig}=require('./config');
const {openDatabase}=require('./database');
const {createCommerce}=require('./services/commerce');
const {createAI}=require('./services/ai');
const {createHandler}=require('./handlers/interactions');
async function main(){const config=loadConfig(),db=openDatabase(config.databasePath),commerce=createCommerce(db),ai=createAI(config),client=new Client({intents:[GatewayIntentBits.Guilds]});client.once(Events.ClientReady,c=>console.log('EM7 SYSTEM V6 ready: '+c.user.tag));client.on(Events.InteractionCreate,createHandler({config,commerce,db,ai}));const close=()=>{db.close();client.destroy();process.exit(0);};process.on('SIGINT',close);process.on('SIGTERM',close);await client.login(config.token);}
main().catch(e=>{console.error('EM7 startup failed:',e);process.exit(1);});