'use strict';
function health(client,db){return {discordReady:Boolean(client?.isReady()),ping:client?.ws?.ping??null,guilds:client?.guilds?.cache?.size??0,databaseOpen:Boolean(db?.open),uptime:Math.floor(process.uptime())};}
module.exports={health};
