"use strict";

const {
  Client, GatewayIntentBits, Events, REST, Routes,
  SlashCommandBuilder, ChannelType, PermissionFlagsBits: P,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags
} = require("discord.js");
const crypto = require("node:crypto");

// EM7 ULTIMATE v3 — private owner-only Discord control center
const C = {
  OWNER_ID: "1354814086021644320",
  OWNER_NAME: "k_zi",
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  DEV_GUILD_ID: process.env.DEV_GUILD_ID || null,
  GROQ_URL: "https://api.groq.com/openai/v1/chat/completions",
  ROOM_TOPIC: "EM7_ULTIMATE_PRIVATE_ROOM_V3",
  ROOM_NAME: "🔐・em7-ultimate",
  COOLDOWN_MS: 3500,
  CONFIRM_MS: 90000,
  MAX_ROUNDS: 6,
  MAX_HISTORY: 10,
  MAX_PENDING: 30
};

for (const k of ["TOKEN", "CLIENT_ID", "GROQ_KEY"]) {
  if (!C[k]) {
    console.error(`[EM7] Missing ${k === "TOKEN" ? "DISCORD_TOKEN" : k === "CLIENT_ID" ? "CLIENT_ID" : "GROQ_API_KEY"}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const sessions = new Map();
const cooldowns = new Map();
const pending = new Map();

const owner = id => String(id) === C.OWNER_ID;
const clean = (v, n = 100) => String(v ?? "").trim().slice(0, n);
const isControlRoom = ch => ch?.topic === C.ROOM_TOPIC;

const denyAdmin = names =>
  names.includes("Administrator") ||
  names.includes("ADMINISTRATOR");

// Normalize common Discord API / model spellings.
const PERM_ALIASES = {
  VIEW_CHANNEL: "ViewChannel",
  SEND_MESSAGES: "SendMessages",
  READ_MESSAGE_HISTORY: "ReadMessageHistory",
  MANAGE_CHANNELS: "ManageChannels",
  MANAGE_ROLES: "ManageRoles",
  MANAGE_MESSAGES: "ManageMessages",
  EMBED_LINKS: "EmbedLinks",
  ATTACH_FILES: "AttachFiles",
  ADD_REACTIONS: "AddReactions",
  CONNECT: "Connect",
  SPEAK: "Speak",
  MUTE_MEMBERS: "MuteMembers",
  DEAFEN_MEMBERS: "DeafenMembers",
  MOVE_MEMBERS: "MoveMembers",
  KICK_MEMBERS: "KickMembers",
  BAN_MEMBERS: "BanMembers",
  MODERATE_MEMBERS: "ModerateMembers",
  MENTION_EVERYONE: "MentionEveryone",
  MANAGE_THREADS: "ManageThreads",
  CREATE_PUBLIC_THREADS: "CreatePublicThreads",
  CREATE_PRIVATE_THREADS: "CreatePrivateThreads",
  SEND_MESSAGES_IN_THREADS: "SendMessagesInThreads",
  MANAGE_NICKNAMES: "ManageNicknames",
  VIEW_AUDIT_LOG: "ViewAuditLog",
  MANAGE_EVENTS: "ManageEvents",
  CREATE_EVENTS: "CreateEvents",
  USE_APPLICATION_COMMANDS: "UseApplicationCommands",
  USE_EXTERNAL_EMOJIS: "UseExternalEmojis",
  USE_EXTERNAL_STICKERS: "UseExternalStickers"
};

const ALLOWED_PERMS = new Set(Object.values(PERM_ALIASES));

function normalizePermissions(input) {
  if (!Array.isArray(input)) {
    throw new Error("قائمة الصلاحيات غير صحيحة.");
  }

  if (denyAdmin(input)) {
    throw new Error("صلاحية Administrator محظورة في EM7.");
  }

  const out = [...new Set(input.map(x => {
    const raw = clean(x, 80);
    const key = PERM_ALIASES[raw.toUpperCase()] || raw;

    if (!ALLOWED_PERMS.has(key) || P[key] === undefined) {
      throw new Error(`الصلاحية غير مسموحة: ${raw}`);
    }

    return key;
  }))];

  return out;
}

const userPerm = {
  server_info: P.ManageGuild,
  list_roles: P.ManageGuild,
  list_channels: P.ManageGuild,
  list_members: P.ManageGuild,

  create_channel: P.ManageChannels,
  create_category: P.ManageChannels,
  edit_channel: P.ManageChannels,
  delete_channel: P.ManageChannels,

  create_role: P.ManageRoles,
  edit_role: P.ManageRoles,
  delete_role: P.ManageRoles,
  assign_role: P.ManageRoles,
  remove_role: P.ManageRoles,

  set_channel_permissions: P.ManageChannels,

  timeout_member: P.ModerateMembers,
  kick_member: P.KickMembers,
  ban_member: P.BanMembers,
  unban_member: P.BanMembers,

  purge_messages: P.ManageMessages,
  lock_channel: P.ManageChannels,
  set_slowmode: P.ManageChannels
};

const botPerm = {
  create_channel: P.ManageChannels,
  create_category: P.ManageChannels,
  edit_channel: P.ManageChannels,
  delete_channel: P.ManageChannels,

  create_role: P.ManageRoles,
  edit_role: P.ManageRoles,
  delete_role: P.ManageRoles,
  assign_role: P.ManageRoles,
  remove_role: P.ManageRoles,

  set_channel_permissions: P.ManageChannels,

  timeout_member: P.ModerateMembers,
  kick_member: P.KickMembers,
  ban_member: P.BanMembers,
  unban_member: P.BanMembers,

  purge_messages: P.ManageMessages,
  lock_channel: P.ManageChannels,
  set_slowmode: P.ManageChannels
};

const sensitive = new Set([
  "delete_channel",
  "delete_role",
  "create_role",
  "edit_role",
  "assign_role",
  "remove_role",
  "set_channel_permissions",
  "timeout_member",
  "kick_member",
  "ban_member",
  "unban_member",
  "purge_messages",
  "lock_channel",
  "edit_channel"
]);

const defs = [
  ["server_info", "عرض معلومات السيرفر", {}, []],
  ["list_roles", "عرض الرتب", {}, []],
  ["list_channels", "عرض القنوات", {}, []],
  ["list_members", "عرض عينة من أعضاء السيرفر", {}, []],

  ["create_channel", "إنشاء قناة نصية أو صوتية", {
    name: { type: "string" },
    type: { type: "string", enum: ["text", "voice"] },
    topic: { type: "string" },
    category: { type: "string" }
  }, ["name"]],

  ["create_category", "إنشاء تصنيف قنوات", {
    name: { type: "string" }
  }, ["name"]],

  ["edit_channel", "تعديل قناة بالاسم أو ID", {
    channel: { type: "string" },
    name: { type: "string" },
    topic: { type: "string" },
    slowmode: { type: "integer" },
    nsfw: { type: "boolean" }
  }, ["channel"]],

  ["delete_channel", "حذف قناة محددة", {
    channel: { type: "string" }
  }, ["channel"]],

  ["create_role", "إنشاء رتبة دون Administrator", {
    name: { type: "string" },
    color: { type: "string" },
    permissions: { type: "array", items: { type: "string" } },
    hoist: { type: "boolean" },
    mentionable: { type: "boolean" }
  }, ["name"]],

  ["edit_role", "تعديل رتبة", {
    role: { type: "string" },
    name: { type: "string" },
    color: { type: "string" },
    permissions: { type: "array", items: { type: "string" } },
    hoist: { type: "boolean" },
    mentionable: { type: "boolean" },
    position: { type: "integer" }
  }, ["role"]],

  ["delete_role", "حذف رتبة", {
    role: { type: "string" }
  }, ["role"]],

  ["assign_role", "إسناد رتبة لعضو", {
    member: { type: "string" },
    role: { type: "string" }
  }, ["member", "role"]],

  ["remove_role", "إزالة رتبة من عضو", {
    member: { type: "string" },
    role: { type: "string" }
  }, ["member", "role"]],

  ["set_channel_permissions", "ضبط سماح ومنع صلاحيات قناة", {
    channel: { type: "string" },
    target_type: { type: "string", enum: ["role", "member"] },
    target: { type: "string" },
    allow: { type: "array", items: { type: "string" } },
    deny: { type: "array", items: { type: "string" } }
  }, ["channel", "target_type", "target"]],

  ["timeout_member", "إيقاف عضو مؤقتاً بالدقائق", {
    member: { type: "string" },
    minutes: { type: "integer" },
    reason: { type: "string" }
  }, ["member", "minutes"]],

  ["kick_member", "طرد عضو", {
    member: { type: "string" },
    reason: { type: "string" }
  }, ["member"]],

  ["ban_member", "حظر عضو", {
    member: { type: "string" },
    reason: { type: "string" }
  }, ["member"]],

  ["unban_member", "فك حظر بواسطة User ID", {
    user_id: { type: "string" }
  }, ["user_id"]],

  ["purge_messages", "حذف عدد محدد من رسائل روم التحكم", {
    amount: { type: "integer" }
  }, ["amount"]],

  ["lock_channel", "قفل أو فتح روم التحكم", {
    locked: { type: "boolean" }
  }, ["locked"]],

  ["set_slowmode", "تعيين Slowmode لروم التحكم", {
    seconds: { type: "integer" }
  }, ["seconds"]]
].map(([name, description, properties, required]) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false
    }
  }
}));

const toolNames = new Set(defs.map(x => x.function.name));

const SYSTEM = `
أنت EM7 ULTIMATE، مساعد إدارة Discord للمالك فقط.
افهم العربية واللهجة السعودية.
استخدم الأدوات المحددة فقط ولا تخترع نتائج.
لا تنفذ أكواد أو أوامر نظام.
لا تمنح Administrator.
لا تتجاوز ترتيب الرتب أو صلاحيات Discord.
اطلب توضيحاً إذا كان الهدف ملتبساً.
العمليات الحساسة ستتوقف عند بوابة موافقة مستقلة.
إذا وصلتك نتيجة awaiting_confirmation فأبلغ المالك أنها تنتظر التأكيد ولا تقل إنها نُفذت.
أجب بالعربية بوضوح واختصار.
`;
async function groq(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(C.GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${C.GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: C.MODEL,
        messages,
        tools: defs,
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: 0.2,
        max_completion_tokens: 1800
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        data?.error?.message || `Groq HTTP ${res.status}`
      );
    }

    const result = data.choices?.[0]?.message;

    if (!result) {
      throw new Error("Groq response is empty.");
    }

    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function handleAI(message) {
  if (!owner(message.author.id)) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const last = cooldowns.get(key) || 0;

  if (now - last < C.COOLDOWN_MS) {
    await message.reply("انتظر قليلاً قبل الطلب التالي.");
    return;
  }

  cooldowns.set(key, now);

  const history = sessions.get(key) || [];

  const messages = [
    { role: "system", content: SYSTEM },
    ...history.slice(-C.MAX_HISTORY),
    {
      role: "user",
      content: message.content.slice(0, 2500)
    }
  ];

  await message.channel.sendTyping();

  try {
    let finalText = null;

    for (let round = 0; round < C.MAX_ROUNDS; round++) {
      const answer = await groq(messages);

      messages.push(answer);

      const calls = answer.tool_calls || [];

      if (!calls.length) {
        finalText = answer.content || "لم أستلم نتيجة نصية.";
        break;
      }

      let waiting = false;

      for (const call of calls) {
        const action = call.function?.name;

        let args;

        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch {
          args = {};
        }

        let result;

        try {
          result = await runTool(
            action,
            args,
            {
              guild: message.guild,
              channel: message.channel,
              userId: message.author.id
            }
          );
        } catch (error) {
          result = {
            success: false,
            error: error.message || "Unknown error"
          };
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 7000)
        });

        if (result?.awaiting_confirmation) {
          waiting = true;

          finalText =
            `تم تجهيز طلب **${action}**.\n` +
            "لم يتم التنفيذ بعد؛ راجع بطاقة الموافقة في الروم " +
            "واضغط «موافقة وتنفيذ» أو «إلغاء الطلب».";

          break;
        }
      }

      if (waiting) break;
    }

    if (!finalText) {
      finalText = "وصلت إلى الحد الأقصى لخطوات التنفيذ في هذا الطلب.";
    }

    sessions.set(key, [
      ...history,
      {
        role: "user",
        content: message.content.slice(0, 2500)
      },
      {
        role: "assistant",
        content: finalText.slice(0, 3500)
      }
    ].slice(-C.MAX_HISTORY));

    await message.channel.send({
      content: finalText,
      allowedMentions: { parse: [] }
    });

  } catch (error) {
    console.error("[EM7 GROQ]", error);

    let msg;

    if (error.name === "AbortError") {
      msg = "انتهت مهلة الاتصال بـ Groq.";
    } else if (/401|invalid_api_key/i.test(error.message)) {
      msg = "مفتاح Groq غير صحيح.";
    } else if (/429|rate limit/i.test(error.message)) {
      msg = "وصلت إلى حد طلبات Groq؛ حاول لاحقاً.";
    } else {
      msg = `تعذر إكمال الطلب: ${clean(error.message, 350)}`;
    }

    await message.channel.send(msg);
  }
}

// =====================================================
// SLASH COMMAND REGISTRATION
// =====================================================

const slash = [
  new SlashCommandBuilder()
    .setName("em7")
    .setDescription("إنشاء مركز التحكم الخاص بـ EM7")
];

async function register() {
  const rest = new REST({ version: "10" }).setToken(C.TOKEN);
  const body = slash.map(x => x.toJSON());

  if (C.DEV_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        C.CLIENT_ID,
        C.DEV_GUILD_ID
      ),
      { body }
    );
  } else {
    await rest.put(
      Routes.applicationCommands(C.CLIENT_ID),
      { body }
    );
  }
}

// =====================================================
// BOT READY
// =====================================================

client.once(Events.ClientReady, async bot => {
  console.log(
    `[EM7] Online as ${bot.user.tag} | Owner ${C.OWNER_ID} | Model ${C.MODEL}`
  );

  try {
    await register();
    console.log("[EM7] Slash commands registered");
  } catch (error) {
    console.error("[EM7] Command registration failed", error);
  }
});
// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(Events.InteractionCreate, async i => {
  try {
    if (!owner(i.user.id)) {
      if (i.isRepliable()) {
        await i.reply({
          content: "⛔ غير مصرح لك باستخدام EM7.",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
      return;
    }

    // /em7 — create private control room
    if (i.isChatInputCommand() && i.commandName === "em7") {
      if (!i.guild) {
        return i.reply({
          content: "استخدم الأمر داخل السيرفر.",
          flags: MessageFlags.Ephemeral
        });
      }

      const bot =
        i.guild.members.me ||
        await i.guild.members.fetch(client.user.id);

      if (
        !bot.permissions.has(P.ManageChannels) &&
        !bot.permissions.has(P.Administrator)
      ) {
        return i.reply({
          content: "البوت يحتاج Manage Channels.",
          flags: MessageFlags.Ephemeral
        });
      }

      const existing = i.guild.channels.cache.find(isControlRoom);

      if (existing) {
        return i.reply({
          content: `مركز EM7 موجود بالفعل: ${existing}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const member = await i.guild.members
        .fetch(C.OWNER_ID)
        .catch(() => null);

      if (!member) {
        return i.reply({
          content: "لم أجد حساب المالك داخل هذا السيرفر. تأكد من OWNER_ID.",
          flags: MessageFlags.Ephemeral
        });
      }

      const room = await i.guild.channels.create({
        name: C.ROOM_NAME,
        type: ChannelType.GuildText,
        topic: C.ROOM_TOPIC,

        permissionOverwrites: [
          {
            id: i.guild.roles.everyone.id,
            deny: [P.ViewChannel]
          },
          {
            id: C.OWNER_ID,
            allow: [
              P.ViewChannel,
              P.SendMessages,
              P.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              P.ViewChannel,
              P.SendMessages,
              P.ReadMessageHistory,
              P.ManageMessages
            ]
          }
        ],

        reason: "EM7 ULTIMATE v3 private control room"
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("EM7 ULTIMATE • CONTROL CENTER")
        .setDescription(
          "**مركز التحكم الخاص بك جاهز.**\n\n" +
          "تحدث مع EM7 باللغة العربية لتنفيذ عمليات الإدارة المتاحة.\n\n" +
          "**أمثلة:**\n" +
          "• اعرض رتب السيرفر وقنواته وأعضاءه\n" +
          "• أنشئ تصنيفاً باسم الإدارة\n" +
          "• أنشئ قناة داخل تصنيف محدد\n" +
          "• أنشئ رتبة بلون أزرق وصلاحيات محددة\n" +
          "• عدّل صلاحيات قناة لرتبة معينة\n" +
          "• اعرض معلومات السيرفر\n\n" +
          "**الحماية:** العمليات الحساسة تتوقف حتى موافقتك، " +
          "وتُعاد مراجعة صلاحيات Discord قبل التنفيذ."
        )
        .addFields(
          {
            name: "الحساب المصرح",
            value: `${C.OWNER_NAME} • ${C.OWNER_ID}`
          },
          {
            name: "نظام الموافقات",
            value: "90 ثانية • موافقة المالك فقط"
          }
        )
        .setFooter({
          text: "EM7 ULTIMATE v3 • PRIVATE OWNER ACCESS"
        })
        .setTimestamp();

      await room.send({
        embeds: [embed],
        allowedMentions: { parse: [] }
      });

      return i.reply({
        content: `تم إنشاء مركز EM7: ${room}`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Approval buttons
    if (i.isButton()) {
      const match = i.customId.match(
        /^em7:(approve|cancel):([a-f0-9]+)$/
      );

      if (!match) return;

      const [, kind, id] = match;
      const item = pending.get(id);

      if (!item) {
        return i.reply({
          content: "هذا الطلب انتهى أو استُخدم مسبقاً.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (item.userId !== i.user.id || !owner(i.user.id)) {
        return i.reply({
          content: "غير مصرح لك بهذا التأكيد.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (
        item.guildId !== i.guildId ||
        item.channelId !== i.channelId
      ) {
        return i.reply({
          content: "التأكيد من الروم أو السيرفر غير الصحيح.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (Date.now() > item.expires) {
        pending.delete(id);

        return i.update({
          content: "انتهت مهلة الموافقة. لم يتم التنفيذ.",
          embeds: [],
          components: []
        });
      }

      if (item.status !== "pending") {
        return i.reply({
          content: "الطلب قيد المعالجة أو أُغلق بالفعل.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (kind === "cancel") {
        item.status = "cancelled";
        pending.delete(id);

        return i.update({
          content: "تم إلغاء العملية. لم يتم تنفيذها.",
          embeds: [],
          components: []
        });
      }

      // Lock synchronously before any await to prevent double execution.
      item.status = "executing";
      await i.deferUpdate();

      try {
        const guild = await client.guilds.fetch(item.guildId);
        const channel = await guild.channels.fetch(item.channelId);

        if (!channel || !isControlRoom(channel)) {
          throw new Error("روم الحماية غير موجود أو تغيّر.");
        }

        const result = await runTool(
          item.action,
          item.args,
          {
            guild,
            channel,
            userId: i.user.id
          },
          true
        );

        pending.delete(id);

        await i.message.edit({
          content:
            `✅ **اكتمل التنفيذ**\n\n` +
            "```json\n" +
            JSON.stringify(result, null, 2).slice(0, 1400) +
            "\n```",
          embeds: [],
          components: [],
          allowedMentions: { parse: [] }
        });

      } catch (error) {
        pending.delete(id);

        await i.message.edit({
          content:
            `❌ **لم يكتمل التنفيذ**\n${clean(error.message, 700)}`,
          embeds: [],
          components: []
        });
      }
    }

  } catch (error) {
    console.error("[EM7 INTERACTION]", error);

    if (i.isRepliable() && !i.replied && !i.deferred) {
      await i.reply({
        content: "حدث خطأ أثناء معالجة التفاعل.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
  }
});

// =====================================================
// MESSAGE HANDLER
// =====================================================

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;
  if (!isControlRoom(message.channel)) return;

  if (!owner(message.author.id)) {
    await message.reply(
      "⛔ هذا المركز مخصص للمالك فقط."
    ).catch(() => {});
    return;
  }

  if (!message.content.trim()) return;

  await handleAI(message);
});

// =====================================================
// CLEANUP
// =====================================================

setInterval(() => {
  const now = Date.now();

  for (const [id, item] of pending) {
    if (now > item.expires && item.status !== "executing") {
      pending.delete(id);
    }
  }

  for (const [key, time] of cooldowns) {
    if (now - time > 60000) {
      cooldowns.delete(key);
    }
  }
}, 30000).unref();

// =====================================================
// ERROR HANDLING
// =====================================================

client.on(Events.Error, error => {
  console.error("[EM7 CLIENT]", error);
});

process.on("unhandledRejection", error => {
  console.error("[EM7 UNHANDLED]", error);
});

process.on("uncaughtException", error => {
  console.error("[EM7 UNCAUGHT]", error);
});

// =====================================================
// LOGIN
// =====================================================

client.login(C.TOKEN);
