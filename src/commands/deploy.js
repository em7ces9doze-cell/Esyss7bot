'use strict';
const {REST,Routes}=require('discord.js');
const {loadConfig}=require('../config');
const {commands}=require('./definitions');
(async()=>{const c=loadConfig(),rest=new REST({version:'10'}).setToken(c.token),body=commands.map(x=>x.toJSON());if(c.guildId)await rest.put(Routes.applicationGuildCommands(c.clientId,c.guildId),{body});else await rest.put(Routes.applicationCommands(c.clientId),{body});console.log('EM7 V6 commands deployed.');})().catch(e=>{console.error(e);process.exit(1);});