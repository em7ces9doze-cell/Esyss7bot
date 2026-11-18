"use strict";

const { SlashCommandBuilder } = require("discord.js");

const command = new SlashCommandBuilder()
  .setName("e7")
  .setDescription("أوامر نظام EM7 وEM7 HOST")
  .addSubcommand(s => s.setName("help").setDescription("عرض دليل أوامر EM7"))
  .addSubcommand(s => s.setName("status").setDescription("حالة تشغيل بوت EM7"))
  .addSubcommand(s => s.setName("website").setDescription("فتح موقع EM7 HOST الرسمي"))
  .addSubcommand(s => s.setName("plans").setDescription("استعراض باقات استضافة EM7 HOST"))
  .addSubcommand(s => s.setName("balance").setDescription("عرض رصيد EM7 Coins"))
  .addSubcommand(s => s.setName("shop").setDescription("فتح متجر وباقات EM7 HOST"))
  .addSubcommand(s =>
    s.setName("buy-plan")
      .setDescription("اختيار باقة ومتابعة الطلب في الموقع")
      .addStringOption(o =>
        o.setName("plan")
          .setDescription("الباقة المطلوبة")
          .setRequired(true)
          .addChoices(
            { name: "FREE", value: "FREE" },
            { name: "LITE", value: "LITE" },
            { name: "PLUS", value: "PLUS" },
            { name: "PRO", value: "PRO" },
            { name: "ULTRA", value: "ULTRA" }
          )
      )
  )
  .addSubcommand(s =>
    s.setName("request-coins")
      .setDescription("إرسال طلب شحن EM7 Coins للمراجعة")
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("عدد العملات")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000000)
      )
      .addStringOption(o =>
        o.setName("note")
          .setDescription("تفاصيل الطلب أو مرجع الدفع")
          .setRequired(true)
          .setMaxLength(300)
      )
  )
  .addSubcommand(s => s.setName("ledger").setDescription("عرض آخر حركات محفظتك"))
  .addSubcommand(s => s.setName("requests").setDescription("طلبات شحن العملات المعلقة - للإدارة"))
  .addSubcommand(s =>
    s.setName("approve-request")
      .setDescription("اعتماد طلب شحن - للإدارة")
      .addIntegerOption(o =>
        o.setName("id").setDescription("رقم الطلب").setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand(s =>
    s.setName("reject-request")
      .setDescription("رفض طلب شحن عملات - للإدارة")
      .addIntegerOption(o =>
        o.setName("id").setDescription("رقم الطلب").setRequired(true).setMinValue(1)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("سبب الرفض").setRequired(true).setMaxLength(200)
      )
  )
  .addSubcommand(s =>
    s.setName("credit")
      .setDescription("إضافة عملات إلى محفظة عضو - للإدارة")
      .addUserOption(o => o.setName("user").setDescription("العضو").setRequired(true))
      .addIntegerOption(o =>
        o.setName("amount")
          .setDescription("الكمية")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000000)
      )
      .addStringOption(o =>
        o.setName("reason").setDescription("سبب الإضافة").setRequired(true).setMaxLength(200)
      )
  )
  .addSubcommand(s => s.setName("admin-panel").setDescription("لوحة إدارة EM7 HOST - للإدارة"))
  .addSubcommand(s => s.setName("host-room").setDescription("إنشاء أو تحديث روم EM7 HOST - للإدارة"))
  .addSubcommand(s => s.setName("test-room").setDescription("إنشاء روم اختبار خاص - للإدارة"))
  .addSubcommand(s =>
    s.setName("ask")
      .setDescription("اسأل مساعد EM7 AI")
      .addStringOption(o =>
        o.setName("prompt").setDescription("سؤالك").setRequired(true).setMaxLength(3000)
      )
  );

module.exports = { commands: [command] };
