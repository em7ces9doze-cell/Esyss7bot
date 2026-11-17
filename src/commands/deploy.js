"use strict";
const { REST, Routes }=require("discord.js");
const { loadConfig }=require("../config");
const { commands }=require("./definitions");
async function main(){const config=loadConfig();const rest=new REST({version:"10"}).setToken(config.token);const route=config.guildId?Routes.applicationGuildCommands(config.clientId,config.guildId):Routes.applicationCommands(config.clientId);await rest.put(route,{body:commands.map(c=>c.toJSON())});process.stdout.write("Registered "+commands.length+" EM7 command(s).\n");}
main().catch(error=>{process.stderr.write("Command deployment failed: "+error.message+"\n");process.exitCode=1;});
