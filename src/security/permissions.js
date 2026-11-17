'use strict';
const {PermissionFlagsBits}=require('discord.js');const {AppError}=require('../core/errors');
function requireBotPermission(guild,p){if(!guild.members.me?.permissions.has(p))throw new AppError('صلاحيات البوت غير كافية.');}
function requireManageableRole(guild,role){const me=guild.members.me;if(!me||role.managed||role.id===guild.id||role.position>=me.roles.highest.position)throw new AppError('هرم الرتب يمنع إدارة هذه الرتبة.');}
module.exports={requireBotPermission,requireManageableRole,PermissionFlagsBits};
