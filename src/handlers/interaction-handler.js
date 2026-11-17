'use strict';
const {MessageFlags}=require('discord.js');const {assertOwner}=require('../core/owner-guard');const {createRepositories}=require('../database/repositories');const {ask}=require('../ai/assistant');const {templates,createProject}=require('../factory/bot-factory');
function createInteractionHandler(ctx){const repos=createRepositories(ctx.db);return async i=>{
 if(i.isAutocomplete()){if(i.commandName==='botfactory'){const f=i.options.getFocused().toLowerCase();await i.respond(templates.filter(t=>t.id.includes(f)||t.name.toLowerCase().includes(f)).slice(0,25).map(t=>({name:t.id+' — '+t.name,value:t.id})));}return;}
 if(!i.isChatInputCommand())return;
 try{assertOwner(i.user.id,ctx.config);
  if(i.commandName==='e7'){const sub=i.options.getSubcommand();if(sub==='help')return i.reply({content:'/e7 ask للذكاء، /e7 status للحالة، /e7 security للحماية، /botfactory list للقوالب.',flags:MessageFlags.Ephemeral});
   if(sub==='security')return i.reply({content:'مالك واحد، أدوات محددة، حد يومي، تبريد، سجل تدقيق، ولا يوجد تنفيذ أوامر نظام.',flags:MessageFlags.Ephemeral});
   if(sub==='status'){const n=ctx.db.prepare('SELECT COUNT(*) n FROM audit_log').get().n;return i.reply({content:'E7 متصل. سجل التدقيق: '+n+'. النموذج: '+ctx.config.groqModel,flags:MessageFlags.Ephemeral});}
   await i.deferReply({flags:MessageFlags.Ephemeral});const answer=await ask({prompt:i.options.getString('request',true),userId:i.user.id,guild:i.guild,groq:ctx.groq,executor:ctx.executor,repositories:repos,config:ctx.config});return i.editReply(answer.slice(0,1900));
  }
  if(i.commandName==='botfactory'){const sub=i.options.getSubcommand();if(sub==='list')return i.reply({content:templates.map(t=>'• **'+t.id+'** — '+t.name+': '+t.description).join('\n').slice(0,1900),flags:MessageFlags.Ephemeral});
   if(sub==='info')return i.reply({content:'ينشئ المصنع مشاريع بداية من 24 قالباً. كل مشروع يحتاج تطبيق Discord ومفاتيح ونشر مستقل.',flags:MessageFlags.Ephemeral});
   await i.deferReply({flags:MessageFlags.Ephemeral});const out=createProject(i.options.getString('template',true),i.options.getString('name',true));ctx.db.prepare('INSERT INTO factory_projects(owner_id,template_id,project_name,output_path,created_at) VALUES(?,?,?,?,?)').run(i.user.id,out.template.id,out.name,out.path,new Date().toISOString());return i.editReply('تم إنشاء مشروع '+out.name+' من قالب '+out.template.name+' في '+out.path+'. يلزم إعداد تطبيق وتوكن مستقلين.');
  }
 }catch(e){ctx.logger.warn('Command failed',e);const msg=e.message||'حدث خطأ';if(i.deferred||i.replied)return i.followUp({content:msg,flags:MessageFlags.Ephemeral}).catch(()=>{});return i.reply({content:msg,flags:MessageFlags.Ephemeral}).catch(()=>{});}
};}
module.exports={createInteractionHandler};
