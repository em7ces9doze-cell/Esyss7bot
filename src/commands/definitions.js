'use strict';
const { SlashCommandBuilder } = require('discord.js');

const e7 = new SlashCommandBuilder().setName('e7').setDescription('أوامر EM7 SYSTEM')
 .addSubcommand(s=>s.setName('ask').setDescription('اطلب من مساعد الذكاء').addStringOption(o=>o.setName('request').setDescription('اكتب طلبك').setRequired(true).setMaxLength(1200)))
 .addSubcommand(s=>s.setName('status').setDescription('حالة البوت والنظام'))
 .addSubcommand(s=>s.setName('help').setDescription('عرض الأوامر'))
 .addSubcommand(s=>s.setName('security').setDescription('حالة الحماية'))
 .addSubcommand(s=>s.setName('balance').setDescription('عرض رصيد EM7 Coins'))
 .addSubcommand(s=>s.setName('shop').setDescription('عرض باقات الاستضافة وأسعارها'))
 .addSubcommand(s=>s.setName('buy-plan').setDescription('شراء باقة بالعملات').addStringOption(o=>o.setName('plan').setDescription('اختر الباقة').setRequired(true).addChoices({name:'Starter — 5 Coins',value:'starter'},{name:'Basic — 10 Coins',value:'basic'},{name:'Pro — 20 Coins',value:'pro'},{name:'Ultimate — 40 Coins',value:'ultimate'})))
 .addSubcommand(s=>s.setName('request-coins').setDescription('طلب شحن EM7 Coins عبر ProBot').addIntegerOption(o=>o.setName('amount').setDescription('عدد العملات المطلوبة').setRequired(true).setMinValue(1).setMaxValue(1000)))
 .addSubcommand(s=>s.setName('ledger').setDescription('عرض سجل معاملاتك'))
 .addSubcommand(s=>s.setName('credit').setDescription('إضافة عملات بعد التحقق — للمالك فقط').addUserOption(o=>o.setName('user').setDescription('العضو').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('عدد العملات').setRequired(true).setMinValue(1).setMaxValue(100000)).addStringOption(o=>o.setName('reason').setDescription('سبب الإضافة').setRequired(true).setMaxLength(200)))
 .addSubcommand(s=>s.setName('test-room').setDescription('إنشاء روم اختبار للتحقق من صلاحيات البوت'));
const factory = new SlashCommandBuilder().setName('botfactory').setDescription('مصنع البوتات')
 .addSubcommand(s=>s.setName('list').setDescription('عرض القوالب'))
 .addSubcommand(s=>s.setName('create').setDescription('إنشاء مشروع').addStringOption(o=>o.setName('template').setDescription('معرف القالب').setRequired(true).setAutocomplete(true)).addStringOption(o=>o.setName('name').setDescription('اسم المشروع').setRequired(true).setMaxLength(40)))
 .addSubcommand(s=>s.setName('info').setDescription('معلومات المصنع'));
module.exports={commands:[e7,factory]};
