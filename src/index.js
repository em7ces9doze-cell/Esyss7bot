'use strict';
const {Client,GatewayIntentBits,Events}=require('discord.js');
const config=require('./config');
const {openDatabase}=require('./database/database');
const {createLogger}=require('./core/logger');
const {registerCommands}=require('./commands/register');
const {createGroqClient}=require('./ai/groq-client');
const {createExecutor}=require('./discord/executor');
const {createInteractionHandler}=require('./handlers/interaction-handler');
const {createControlBridge}=require('./integrations/control-bridge');
async function main(){
 const logger=createLogger(); const db=openDatabase(config.databasePath);
 const groq=createGroqClient(config); const executor=createExecutor({db,config,logger});
 const client=new Client({intents:[GatewayIntentBits.Guilds]});
 const controlBridge=createControlBridge({client,db,config,logger});
 client.once(Events.ClientReady,async c=>{logger.info('Ready '+c.user.tag);try{await registerCommands(config);logger.info('Slash commands registered');}catch(e){logger.error(e);}});
 const handler=createInteractionHandler({config,db,groq,executor,logger});
 client.on(Events.InteractionCreate,i=>handler(i).catch(e=>logger.error(e)));
 client.on(Events.Error,e=>logger.error(e)); process.on('unhandledRejection',e=>logger.error(e));
 const shutdown=async()=>{controlBridge.stop();try{client.destroy();}finally{db.close();}};
 process.once('SIGINT',()=>shutdown().finally(()=>process.exit(0)));
 process.once('SIGTERM',()=>shutdown().finally(()=>process.exit(0)));
 await client.login(config.discordToken);
}
main().catch(e=>{console.error(e);process.exit(1);});
