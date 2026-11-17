'use strict';
const {REST,Routes}=require('discord.js');const {commands}=require('./definitions');
async function registerCommands(cfg){const rest=new REST({version:'10'}).setToken(cfg.discordToken);const route=cfg.guildId?Routes.applicationGuildCommands(cfg.clientId,cfg.guildId):Routes.applicationCommands(cfg.clientId);await rest.put(route,{body:commands.map(c=>c.toJSON())});}
module.exports={registerCommands};
