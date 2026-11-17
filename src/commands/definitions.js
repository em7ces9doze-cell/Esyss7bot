'use strict';
const {SlashCommandBuilder}=require('discord.js');
const e7=new SlashCommandBuilder().setName('e7').setDescription('أوامر EM7 SYSTEM V6')
.addSubcommand(s=>s.setName('help').setDescription('المساعدة'))
.addSubcommand(s=>s.setName('status').setDescription('حالة النظام'))
.addSubcommand(s=>s.setName('balance').setDescription('رصيد EM7 Coins'))
.addSubcommand(s=>s.setName('shop').setDescription('عرض الباقات'))
.addSubcommand(s=>s.setName('buy-plan').setDescription('شراء باقة').addStringOption(o=>o.setName('plan').setDescription('الباقة').setRequired(true).addChoices({name:'Starter - 5',value:'starter'},{name:'Basic - 10',value:'basic'},{name:'Pro - 20',value:'pro'},{name:'Ultimate - 40',value:'ultimate'})))
.addSubcommand(s=>s.setName('request-coins').setDescription('طلب شحن يدوي').addIntegerOption(o=>o.setName('amount').setDescription('العدد').setRequired(true).setMinValue(1).setMaxValue(1000)))
.addSubcommand(s=>s.setName('ledger').setDescription('سجل معاملاتك'))
.addSubcommand(s=>s.setName('requests').setDescription('طلبات الشحن للمالك'))
.addSubcommand(s=>s.setName('approve-request').setDescription('اعتماد طلب للمالك').addIntegerOption(o=>o.setName('request_id').setDescription('رقم الطلب').setRequired(true).setMinValue(1)))
.addSubcommand(s=>s.setName('credit').setDescription('إضافة عملات للمالك').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('العدد').setRequired(true).setMinValue(1).setMaxValue(100000)).addStringOption(o=>o.setName('reason').setDescription('السبب').setRequired(true).setMaxLength(200)))
.addSubcommand(s=>s.setName('test-room').setDescription('روم اختبار خاص للمالك'))
.addSubcommand(s=>s.setName('ask').setDescription('سؤال مساعد AI').addStringOption(o=>o.setName('prompt').setDescription('السؤال').setRequired(true).setMaxLength(1500)));
module.exports={commands:[e7]};