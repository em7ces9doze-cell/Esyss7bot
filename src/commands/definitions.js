"use strict";
const { SlashCommandBuilder } = require("discord.js");
const command=new SlashCommandBuilder().setName("e7").setDescription("أوامر نظام EM7")
.addSubcommand(s=>s.setName("help").setDescription("عرض قائمة الأوامر"))
.addSubcommand(s=>s.setName("status").setDescription("حالة النظام"))
.addSubcommand(s=>s.setName("balance").setDescription("عرض رصيد EM7 Coins"))
.addSubcommand(s=>s.setName("shop").setDescription("عرض باقات المتجر"))
.addSubcommand(s=>s.setName("buy-plan").setDescription("طلب باقة").addStringOption(o=>o.setName("plan").setDescription("الباقة").setRequired(true).addChoices({name:"Starter - 5 Coins",value:"starter"},{name:"Basic - 10 Coins",value:"basic"},{name:"Pro - 20 Coins",value:"pro"},{name:"Ultimate - 40 Coins",value:"ultimate"})))
.addSubcommand(s=>s.setName("request-coins").setDescription("إرسال طلب شحن للمراجعة").addIntegerOption(o=>o.setName("amount").setDescription("عدد العملات").setRequired(true).setMinValue(1).setMaxValue(1000000)).addStringOption(o=>o.setName("note").setDescription("تفاصيل الطلب").setRequired(true).setMaxLength(300)))
.addSubcommand(s=>s.setName("ledger").setDescription("آخر حركات محفظتك"))
.addSubcommand(s=>s.setName("requests").setDescription("طلبات الشحن المعلقة - للمالك فقط"))
.addSubcommand(s=>s.setName("approve-request").setDescription("اعتماد طلب شحن - للمالك فقط").addIntegerOption(o=>o.setName("id").setDescription("رقم الطلب").setRequired(true).setMinValue(1)))
.addSubcommand(s=>s.setName("credit").setDescription("إضافة عملات - للمالك فقط").addUserOption(o=>o.setName("user").setDescription("العضو").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("الكمية").setRequired(true).setMinValue(1).setMaxValue(1000000)).addStringOption(o=>o.setName("reason").setDescription("السبب").setRequired(true).setMaxLength(200)))
.addSubcommand(s=>s.setName("test-room").setDescription("إنشاء روم اختبار خاص بالمالك"))
.addSubcommand(s=>s.setName("ask").setDescription("اسأل مساعد EM7 AI").addStringOption(o=>o.setName("prompt").setDescription("سؤالك").setRequired(true).setMaxLength(3000)));
module.exports={commands:[command]};
