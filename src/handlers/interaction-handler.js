'use strict';
const {MessageFlags,PermissionFlagsBits}=require('discord.js');
const {assertOwner}=require('../core/owner-guard');
const {createRepositories}=require('../database/repositories');
const {ask}=require('../ai/assistant');
const {templates,createProject}=require('../factory/bot-factory');
const {createCommerce}=require('../commerce/service');
function createInteractionHandler(ctx){
 const repos=createRepositories(ctx.db);const commerce=createCommerce(ctx.db);const ephemeral={flags:MessageFlags.Ephemeral};
 return async i=>{
  if(i.isAutocomplete()){if(i.commandName==='botfactory'){const f=i.options.getFocused().toLowerCase();await i.respond(templates.filter(t=>t.id.includes(f)||t.name.toLowerCase().includes(f)).slice(0,25).map(t=>({name:t.id+' — '+t.name,value:t.id})));}return;}
  if(!i.isChatInputCommand())return;
  try{
   if(i.commandName==='e7'){
    const sub=i.options.getSubcommand();
    if(sub==='help')return i.reply({...ephemeral,content:['أوامر EM7 SYSTEM','/e7 balance — رصيدك','/e7 shop — الباقات','/e7 buy-plan — شراء باقة','/e7 request-coins — طلب شحن','/e7 ledger — سجل معاملاتك','/e7 test-room — روم اختبار (المالك فقط)','/e7 status — الحالة','/e7 ask — مساعد الذكاء (المالك فقط)'].join('\n')});
    if(sub==='balance')return i.reply({...ephemeral,content:'رصيدك الحالي: **'+commerce.balance(i.user.id)+' EM7 Coins**.'});
    if(sub==='shop')return i.reply({...ephemeral,content:'**متجر EM7 HOST — أسعار تجريبية**\n• Starter: 5 EM7 Coins\n• Basic: 10 EM7 Coins\n• Pro: 20 EM7 Coins\n• Ultimate: 40 EM7 Coins\n\nاستخدم /e7 buy-plan للشراء. الطلب يسجل pending_provisioning ولا يشغّل استضافة تلقائياً قبل ربط محرك الاستضافة.'});
    if(sub==='buy-plan'){
     await i.deferReply(ephemeral);const plan=i.options.getString('plan',true);const purchase=commerce.buyPlan(i.user.id,plan);
     return i.editReply('تم تسجيل طلب شراء **'+commerce.planLabels[plan]+'**.\nرقم الطلب: '+purchase.purchaseId+'\nالخصم: '+purchase.price+' EM7 Coins\nالرصيد المتبقي: '+purchase.balance+'\nالحالة: pending_provisioning — بانتظار تجهيز الاستضافة.');
    }
    if(sub==='request-coins'){
     const req=commerce.requestCoins(i.user.id,i.options.getInteger('amount',true));
     return i.reply({...ephemeral,content:'**طلب شحن EM7 Coins**\nرقم الطلب: '+req.id+'\nالعملات المطلوبة: **'+req.coins+'**\nالمطلوب تحويله: **'+req.credits+' ProBot Credits**\nالمستلم: k_zi\n\nبعد التحويل انتظر مراجعة الإدارة. لا يتم إضافة العملات تلقائياً؛ ستضاف بعد التحقق من سجل التحويل.'});
    }
    if(sub==='ledger'){
     const rows=commerce.history(i.user.id,8);if(!rows.length)return i.reply({...ephemeral,content:'لا توجد معاملات مسجلة حتى الآن.'});
     return i.reply({...ephemeral,content:'**آخر معاملات محفظتك**\n'+rows.map(x=>(x.delta>0?'+':'')+x.delta+' Coins | '+x.kind+' | الرصيد: '+x.balance_after+' | '+x.created_at.slice(0,10)).join('\n')});
    }
    if(sub==='requests'){
     assertOwner(i.user.id,ctx.config);
     const rows=ctx.db.prepare("SELECT id,user_id,coins,probot_credits,created_at FROM em7_coin_requests WHERE status='pending' ORDER BY id ASC LIMIT 15").all();
     if(!rows.length)return i.reply({...ephemeral,content:'لا توجد طلبات شحن معلقة.'});
     return i.reply({...ephemeral,content:'**طلبات شحن ProBot المعلقة**\n'+rows.map(x=>'#'+x.id+' | <@'+x.user_id+'> | '+x.coins+' Coins | '+x.probot_credits+' Credits | '+x.created_at.slice(0,10)).join('\n')+'\n\nبعد التحقق المستقل من التحويل استخدم /e7 approve-request لاعتماد الطلب وإضافة العملات مرة واحدة.'});
    }
    if(sub==='approve-request'){
     assertOwner(i.user.id,ctx.config);const requestId=i.options.getInteger('request_id',true);
     const approved=commerce.approveRequest(requestId,i.user.id);
     return i.reply({...ephemeral,content:'تم اعتماد طلب الشحن #'+requestId+' بعد مراجعة التحويل. أضيفت '+approved.coins+' EM7 Coins إلى <@'+approved.userId+'>. الرصيد الجديد: '+approved.balance+'.'});
    }
    if(sub==='credit'){
     assertOwner(i.user.id,ctx.config);const user=i.options.getUser('user',true);const amount=i.options.getInteger('amount',true);const reason=i.options.getString('reason',true);
     const balance=commerce.credit({userId:user.id,amount,actorId:i.user.id,reason});
     return i.reply({...ephemeral,content:'تمت إضافة '+amount+' EM7 Coins إلى '+user.tag+'. الرصيد الجديد: '+balance+'. لا تستخدم هذا الأمر إلا بعد التحقق من التحويل.'});
    }
    if(sub==='test-room'){
     assertOwner(i.user.id,ctx.config);if(!i.guild)return i.reply({...ephemeral,content:'هذا الأمر يعمل داخل السيرفر فقط.'});
     const me=i.guild.members.me||await i.guild.members.fetchMe();
     if(!me.permissions.has(PermissionFlagsBits.ManageChannels))return i.reply({...ephemeral,content:'البوت يحتاج صلاحية Manage Channels لإنشاء روم الاختبار.'});
     await i.deferReply(ephemeral);
     const channel=await i.guild.channels.create({name:'em7-test-'+Date.now().toString().slice(-6),type:0,topic:'EM7 SYSTEM private test room',permissionOverwrites:[
      {id:i.guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
      {id:i.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
      {id:me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}
     ],reason:'EM7 owner requested a private test room'});
     ctx.db.prepare('INSERT INTO audit_log(actor_id,guild_id,action,details_json,created_at) VALUES(?,?,?,?,?)').run(i.user.id,i.guild.id,'test_room.create',JSON.stringify({channelId:channel.id,name:channel.name}),new Date().toISOString());
     return i.editReply('تم إنشاء روم الاختبار الخاص: <#'+channel.id+'>. الروم مرئي لك وللبوت فقط.');
    }
    if(sub==='security')return i.reply({...ephemeral,content:'حماية E7: أدوات ذكاء محددة، لا يوجد shell أو eval، دفتر معاملات للمحفظة، وإضافة العملات للمالك فقط.'});
    if(sub==='status'){const n=ctx.db.prepare('SELECT COUNT(*) n FROM audit_log').get().n;return i.reply({...ephemeral,content:'EM7 SYSTEM متصل. سجل التدقيق: '+n+'. النموذج: '+ctx.config.groqModel+'. جسر EM7 CONTROL: '+(ctx.controlBridge?.enabled?'مفعّل':'غير مفعّل')});}
    if(sub==='ask'){assertOwner(i.user.id,ctx.config);await i.deferReply(ephemeral);const answer=await ask({prompt:i.options.getString('request',true),userId:i.user.id,guild:i.guild,groq:ctx.groq,executor:ctx.executor,repositories:repos,config:ctx.config});return i.editReply(answer.slice(0,1900));}
   }
   if(i.commandName==='botfactory'){
    assertOwner(i.user.id,ctx.config);const sub=i.options.getSubcommand();
    if(sub==='list')return i.reply({...ephemeral,content:templates.map(t=>'• **'+t.id+'** — '+t.name+': '+t.description).join('\n').slice(0,1900)});
    if(sub==='info')return i.reply({...ephemeral,content:'ينشئ المصنع مشاريع بداية من 24 قالباً. كل مشروع يحتاج تطبيق Discord ومفاتيح ونشر مستقل.'});
    await i.deferReply(ephemeral);const out=createProject(i.options.getString('template',true),i.options.getString('name',true));
    ctx.db.prepare('INSERT INTO factory_projects(owner_id,template_id,project_name,output_path,created_at) VALUES(?,?,?,?,?)').run(i.user.id,out.template.id,out.name,out.path,new Date().toISOString());
    return i.editReply('تم إنشاء مشروع '+out.name+' من قالب '+out.template.name+' في '+out.path+'. يلزم إعداد تطبيق وتوكن مستقلين.');
   }
  }catch(e){ctx.logger.warn('Command failed',e);const msg=e.message||'حدث خطأ';if(i.deferred||i.replied)return i.editReply({content:msg}).catch(()=>i.followUp({...ephemeral,content:msg}).catch(()=>{}));return i.reply({...ephemeral,content:msg}).catch(()=>{});}
 };
}
module.exports={createInteractionHandler};
