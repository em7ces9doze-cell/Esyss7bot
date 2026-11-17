"use strict";
const {Client,GatewayIntentBits,Events}=require("discord.js");
const {loadConfig}=require("./config");
const {openDatabase}=require("./database");
const {createCommerce}=require("./services/commerce");
const {createInteractionHandler}=require("./handlers/interactions");
async function main(){const config=loadConfig();const db=openDatabase(config.databasePath);const commerce=createCommerce(db);const client=new Client({intents:[GatewayIntentBits.Guilds]});client.once(Events.ClientReady,ready=>console.log("EM7 SYSTEM ready as "+ready.user.tag));client.on(Events.InteractionCreate,createInteractionHandler({config,commerce,db,client}));client.on(Events.Error,error=>console.error("Discord client error:",error));await client.login(config.token);const shutdown=signal=>{console.log("Received "+signal+"; shutting down.");client.destroy();db.close();process.exit(0);};process.once("SIGINT",()=>shutdown("SIGINT"));process.once("SIGTERM",()=>shutdown("SIGTERM"));}
main().catch(error=>{console.error("EM7 startup failed:",error);process.exitCode=1;});
