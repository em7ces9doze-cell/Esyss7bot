"use strict";
const { SlashCommandBuilder } = require("discord.js");
const command = new SlashCommandBuilder().setName("e7").setDescription("أوامر نظام EM7 وEM7 HOST")
.addSubcommand(s=>s.setName("help").setDescription("عرض قائمة الأوامر"))
.addSubcommand(s=>s.setName("status").setDescription("حالة نظام EM7"))
.addSubcommand(s=>s.setName("website").setDescription("رابط موقع EM7 HOST"))
.addSubcommand(s=>s.setName("plans").setDescription("عرض باقات الاستضافة الرسمية"))
.addSubcommand(s=>s.setName("balance").setDescription("عرض رصيد EM7 Coins"))
.addSubcommand(s=>s.setName("shop").setDescription("رابط باقات وخدمات EM7 HOST"))
.addSubcommand(s=>s.setName("buy-plan").setDescription("الانتقال للموقع لاختيار باقة").addStringOption(o=>o.setName("plan").setDescription("الباقة").setRequired(true).addChoices({name:"FREE",value:"FREE"},{name:"LITE",value:"LITE"},{name:"PLUS",value:"PLUS"},{name:"PRO",value:"PRO"},{name:"ULTRA",value:"ULTRA"})))
.addSubcommand(s=>s.setName("request-coins").setDescription("إرسال طلب شحن EM7 Coins للمراجعة").addIntegerOption(o=>o.setName("amount").setDescription("عدد العملات").setRequired(true).setMinValue(1).setMaxValue(1000000)).addStringOption(o=>o.setName("note").setDescription("تفاصيل الطلب").setRequired(true).setMaxLength(300)))
.addSubcommand(s=>s.setName("ledger").setDescription("عرض آخر حركات محفظتك"))
.addSubcommand(s=>s.setName("requests").setDescription("طلبات شحن العملات المعلقة - للإدارة"))
.addSubcommand(s=>s.setName("approve-request").setDescription("اعتماد طلب شحن - للإدارة").addIntegerOption(o=>o.setName("id").setDescription("رقم الطلب").setRequired(true).setMinValue(1)))
.addSubcommand(s=>s.setName("credit").setDescription("إضافة عملات - للإدارة").addUserOption(o=>o.setName("user").setDescription("العضو").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("الكمية").setRequired(true).setMinValue(1).setMaxValue(1000000)).addStringOption(o=>o.setName("reason").setDescription("السبب").setRequired(true).setMaxLength(200)))
.addSubcommand(s=>s.setName("host-room").setDescription("إنشاء روم EM7 HOST الرسمي - للإدارة"))
.addSubcommand(s=>s.setName("test-room").setDescription("إنشاء روم اختبار خاص بالمالك"))
.addSubcommand(s=>s.setName("ask").setDescription("اسأل مساعد EM7 AI").addStringOption(o=>o.setName("prompt").setDescription("سؤالك").setRequired(true).setMaxLength(3000)));
module.exports={commands:[command]};
