'use strict';
const {ChannelType}=require('discord.js');const {requireBotPermission,PermissionFlagsBits}=require('../security/permissions');const {cleanName}=require('../security/validation');const {AppError}=require('../core/errors');
function createExecutor({db,config,logger}){
 const audit=db.prepare('INSERT INTO audit_log(actor_id,guild_id,action,details_json,created_at) VALUES(?,?,?,?,?)');
 function record(actor,guild,action,details){audit.run(actor,guild.id,action,JSON.stringify(details),new Date().toISOString());logger.info('Action',action,details);}
 return {async run(name,args,guild,actor){
  if(!guild)throw new AppError('استخدم الأمر داخل السيرفر.');if(actor!==config.ownerId)throw new AppError('غير مصرح.');
  if(name==='server_overview')return {ok:true,name:guild.name,id:guild.id,members:guild.memberCount,channels:guild.channels.cache.size,roles:guild.roles.cache.size};
  if(name==='list_channels')return {ok:true,channels:guild.channels.cache.map(c=>({id:c.id,name:c.name,type:c.type})).slice(0,80)};
  if(name==='create_text_channel'){requireBotPermission(guild,PermissionFlagsBits.ManageChannels);const n=cleanName(args.name).toLowerCase().replace(/[^\p{L}\p{N}_-]/gu,'-');if(!n)throw new AppError('اسم القناة غير صالح.');const c=await guild.channels.create({name:n,type:ChannelType.GuildText,reason:'E7 owner request'});record(actor,guild,'channel.create',{id:c.id,name:c.name});return {ok:true,id:c.id,name:c.name};}
  if(name==='create_role'){requireBotPermission(guild,PermissionFlagsBits.ManageRoles);const n=cleanName(args.name);if(!n)throw new AppError('اسم الرتبة غير صالح.');const r=await guild.roles.create({name:n,permissions:[],reason:'E7 owner request'});record(actor,guild,'role.create',{id:r.id,name:r.name});return {ok:true,id:r.id,name:r.name,permissions:[]};}
  throw new AppError('الأداة غير مسموحة.','TOOL_NOT_ALLOWED');
 }};
}
module.exports={createExecutor};
