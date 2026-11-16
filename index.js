"use strict";

const {
  Client, GatewayIntentBits, Events, REST, Routes,
  SlashCommandBuilder, ChannelType, PermissionFlagsBits: P,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags
} = require("discord.js");
const crypto = require("node:crypto");
const { createBotProject, updateBotProject } = require("./bot-factory");

// ============================================================
// EM7 ULTIMATE — STABLE EXECUTION ENGINE
// ============================================================
const CONFIG = {
  OWNER_ID: "1354814086021644320",
  OWNER_NAME: "k_zi",
  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GROQ_KEY: process.env.GROQ_API_KEY,
  MODEL: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  DEV_GUILD_ID: process.env.DEV_GUILD_ID || null,
  GROQ_URL: "https://api.groq.com/openai/v1/chat/completions",
  ROOM_TOPIC: "EM7_ULTIMATE_PRIVATE_ROOM_V4",
  ROOM_NAME: "🔐・em7-ultimate",
  COOLDOWN_MS: 3000,
  CONFIRM_TIMEOUT_MS: 90000,
  MAX_TOOL_ROUNDS: 6,
  MAX_HISTORY: 10,
  MAX_PENDING: 25,
  MAX_OUTPUT: 7000
};

for (const [env, value] of Object.entries({
  DISCORD_TOKEN: CONFIG.TOKEN,
  CLIENT_ID: CONFIG.CLIENT_ID,
  GROQ_API_KEY: CONFIG.GROQ_KEY
})) {
  if (!value) {
    console.error(`[EM7] Missing environment variable: ${env}`);
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
const busyUsers = new Set();

const isOwner = id => String(id) === CONFIG.OWNER_ID;
const clean = (value, max = 100) => String(value ?? "").trim().slice(0, max);
const isControlRoom = channel => channel?.topic === CONFIG.ROOM_TOPIC;
const isTextBased = channel => channel?.isTextBased?.() && typeof channel.send === "function";

// Deliberately excludes Administrator and high-risk permission escalation.
const PERMISSION_ALIASES = {
  VIEW_CHANNEL: "ViewChannel", SEND_MESSAGES: "SendMessages",
  READ_MESSAGE_HISTORY: "ReadMessageHistory", MANAGE_CHANNELS: "ManageChannels",
  MANAGE_ROLES: "ManageRoles", MANAGE_MESSAGES: "ManageMessages",
  EMBED_LINKS: "EmbedLinks", ATTACH_FILES: "AttachFiles",
  ADD_REACTIONS: "AddReactions", USE_EXTERNAL_EMOJIS: "UseExternalEmojis",
  USE_EXTERNAL_STICKERS: "UseExternalStickers", CONNECT: "Connect", SPEAK: "Speak",
  MUTE_MEMBERS: "MuteMembers", DEAFEN_MEMBERS: "DeafenMembers",
  MOVE_MEMBERS: "MoveMembers", KICK_MEMBERS: "KickMembers", BAN_MEMBERS: "BanMembers",
  MODERATE_MEMBERS: "ModerateMembers", MENTION_EVERYONE: "MentionEveryone",
  CREATE_PUBLIC_THREADS: "CreatePublicThreads", CREATE_PRIVATE_THREADS: "CreatePrivateThreads",
  SEND_MESSAGES_IN_THREADS: "SendMessagesInThreads", MANAGE_THREADS: "ManageThreads",
  MANAGE_NICKNAMES: "ManageNicknames", VIEW_AUDIT_LOG: "ViewAuditLog",
  MANAGE_EVENTS: "ManageEvents", CREATE_EVENTS: "CreateEvents",
  USE_APPLICATION_COMMANDS: "UseApplicationCommands"
};
const ALLOWED_PERMISSIONS = new Set(Object.values(PERMISSION_ALIASES));

function normalizePermissions(input) {
  if (!Array.isArray(input)) throw new Error("أرسل الصلاحيات على شكل قائمة.");
  const result = [];
  for (const rawValue of input) {
    const raw = clean(rawValue, 80);
    if (/administrator/i.test(raw)) throw new Error("EM7 يمنع منح Administrator.");
    const name = PERMISSION_ALIASES[raw.toUpperCase()] || raw;
    if (!ALLOWED_PERMISSIONS.has(name) || P[name] === undefined) {
      throw new Error(`صلاحية غير معروفة أو غير مسموحة: ${raw}`);
    }
    if (!result.includes(name)) result.push(name);
  }
  return result;
}

const USER_PERMISSIONS = {
  server_info: P.ManageGuild, list_roles: P.ManageGuild,
  list_channels: P.ManageGuild, list_members: P.ManageGuild,
  create_channel: P.ManageChannels, create_category: P.ManageChannels,
  edit_channel: P.ManageChannels, delete_channel: P.ManageChannels,
  create_role: P.ManageRoles, edit_role: P.ManageRoles,
  delete_role: P.ManageRoles, assign_role: P.ManageRoles,
  remove_role: P.ManageRoles, set_channel_permissions: P.ManageChannels,
  timeout_member: P.ModerateMembers, kick_member: P.KickMembers,
  ban_member: P.BanMembers, unban_member: P.BanMembers,
  purge_messages: P.ManageMessages, lock_channel: P.ManageChannels,
  set_slowmode: P.ManageChannels
};
const BOT_PERMISSIONS = {
  create_channel: P.ManageChannels, create_category: P.ManageChannels,
  edit_channel: P.ManageChannels, delete_channel: P.ManageChannels,
  create_role: P.ManageRoles, edit_role: P.ManageRoles,
  delete_role: P.ManageRoles, assign_role: P.ManageRoles,
  remove_role: P.ManageRoles, set_channel_permissions: P.ManageChannels,
  timeout_member: P.ModerateMembers, kick_member: P.KickMembers,
  ban_member: P.BanMembers, unban_member: P.BanMembers,
  purge_messages: P.ManageMessages, lock_channel: P.ManageChannels,
  set_slowmode: P.ManageChannels
};
const SENSITIVE_ACTIONS = new Set([
  "delete_channel", "create_role", "edit_role", "delete_role",
  "assign_role", "remove_role", "set_channel_permissions",
  "timeout_member", "kick_member", "ban_member", "unban_member",
  "purge_messages", "lock_channel", "edit_channel", "create_bot_project", "update_bot_project"
]);

const TOOL_SPECS = [
  ["server_info", "عرض معلومات السيرفر", {}, []],
  ["list_roles", "عرض رتب السيرفر", {}, []],
  ["list_channels", "عرض قنوات السيرفر", {}, []],
  ["list_members", "عرض عينة من أعضاء السيرفر", {}, []],
  ["create_channel", "إنشاء قناة نصية أو صوتية", {
    name: { type: "string" }, type: { type: "string", enum: ["text", "voice"] },
    topic: { type: "string" }, category: { type: "string" }
  }, ["name"]],
  ["create_category", "إنشاء تصنيف قنوات", { name: { type: "string" } }, ["name"]],
  ["edit_channel", "تعديل اسم أو وصف أو Slowmode قناة", {
    channel: { type: "string" }, name: { type: "string" }, topic: { type: "string" },
    slowmode: { type: "integer" }, nsfw: { type: "boolean" }
  }, ["channel"]],
  ["delete_channel", "حذف قناة", { channel: { type: "string" } }, ["channel"]],
  ["create_role", "إنشاء رتبة بصلاحيات مسموحة دون Administrator", {
    name: { type: "string" }, color: { type: "string" },
    permissions: { type: "array", items: { type: "string" } },
    hoist: { type: "boolean" }, mentionable: { type: "boolean" }
  }, ["name"]],
  ["edit_role", "تعديل رتبة", {
    role: { type: "string" }, name: { type: "string" }, color: { type: "string" },
    permissions: { type: "array", items: { type: "string" } },
    hoist: { type: "boolean" }, mentionable: { type: "boolean" }, position: { type: "integer" }
  }, ["role"]],
  ["delete_role", "حذف رتبة", { role: { type: "string" } }, ["role"]],
  ["assign_role", "إسناد رتبة لعضو", { member: { type: "string" }, role: { type: "string" } }, ["member", "role"]],
  ["remove_role", "إزالة رتبة من عضو", { member: { type: "string" }, role: { type: "string" } }, ["member", "role"]],
  ["set_channel_permissions", "تعديل صلاحيات قناة لرتبة أو عضو", {
    channel: { type: "string" }, target_type: { type: "string", enum: ["role", "member"] },
    target: { type: "string" }, allow: { type: "array", items: { type: "string" } },
    deny: { type: "array", items: { type: "string" } }
  }, ["channel", "target_type", "target"]],
  ["timeout_member", "إيقاف عضو مؤقتاً بالدقائق", {
    member: { type: "string" }, minutes: { type: "integer" }, reason: { type: "string" }
  }, ["member", "minutes"]],
  ["kick_member", "طرد عضو", { member: { type: "string" }, reason: { type: "string" } }, ["member"]],
  ["ban_member", "حظر عضو", { member: { type: "string" }, reason: { type: "string" } }, ["member"]],
  ["unban_member", "فك حظر بواسطة Discord User ID", { user_id: { type: "string" } }, ["user_id"]],
  ["purge_messages", "حذف عدد من الرسائل الحديثة في روم EM7", { amount: { type: "integer" } }, ["amount"]],
  ["lock_channel", "قفل أو فتح الكتابة في روم EM7", { locked: { type: "boolean" } }, ["locked"]],
  ["set_slowmode", "تحديد Slowmode لروم EM7 بالثواني", { seconds: { type: "integer" } }, ["seconds"]],
  ["create_bot_project", "إنشاء مشروع بوت Discord مستقل وإرسال ZIP جاهز يحتوي index.js وpackage.json وREADME وملف إعدادات. لا ينشئ تطبيق Discord ولا يطلب التوكن.", {
    type: { type: "string", enum: ["ticket", "events", "welcome"] },
    name: { type: "string" }, description: { type: "string" },
    config: { type: "object", properties: {
      panelTitle: { type: "string" }, panelDescription: { type: "string" }, categoryName: { type: "string" },
      supportRoleId: { type: "string" }, logChannelId: { type: "string" }, eventChannelId: { type: "string" },
      welcomeChannelId: { type: "string" }, welcomeText: { type: "string" }, timezone: { type: "string" }, color: { type: "string" }
    }, additionalProperties: false }
  }, ["type", "name"]],
  ["update_bot_project", "تحديث إعدادات مشروع بوت مستقل سابق وإعادة توليد ZIP. استخدم اسم المشروع السابق.", {
    name: { type: "string" }, description: { type: "string" },
    config: { type: "object", properties: {
      panelTitle: { type: "string" }, panelDescription: { type: "string" }, categoryName: { type: "string" },
      supportRoleId: { type: "string" }, logChannelId: { type: "string" }, eventChannelId: { type: "string" },
      welcomeChannelId: { type: "string" }, welcomeText: { type: "string" }, timezone: { type: "string" }, color: { type: "string" }
    }, additionalProperties: false }
  }, ["name"]]
];
const GROQ_TOOLS = TOOL_SPECS.map(([name, description, properties, required]) => ({
  type: "function",
  function: { name, description, parameters: {
    type: "object", properties, required, additionalProperties: false
  }}
}));
const TOOL_NAMES = new Set(TOOL_SPECS.map(x => x[0]));

const SYSTEM_PROMPT = `أنت EM7 ULTIMATE، مساعد إدارة Discord باللغة العربية.
استخدم الأدوات المتاحة لتنفيذ عمليات Discord الحقيقية. لا تدّع النجاح قبل عودة نتيجة ناجحة.
إذا كان الطلب غامضاً فاسأل عن المعلومة الناقصة. لا تخترع IDs أو أسماء أو نتائج.
لا تنفذ JavaScript أو Shell أو أوامر خارج Discord. لا تتجاوز صلاحيات Discord أو ترتيب الرتب.
لا تمنح Administrator. العمليات الحساسة تتطلب بطاقة موافقة منفصلة من المالك.
إذا كانت نتيجة الأداة awaiting_confirmation فهذا يعني أن العملية لم تنفذ بعد.
لا تقل إنك عاجز إذا كانت هناك أداة مناسبة؛ استخدمها ثم اشرح الخطأ الفعلي إن فشلت.
إذا طلب المستخدم بوتاً مستقلاً، استخدم create_bot_project بنوع ticket أو events أو welcome. إذا طلب تعديل مشروع سابق فاستخدم update_bot_project مع اسم المشروع السابق والإعدادات المحددة فقط. لا تدّع إنشاء تطبيق Discord أو استخراج توكن؛ المصنع ينشئ ملفات المشروع ويرسل ZIP فقط.
أجب بالعربية السعودية الواضحة وباختصار.`;

// ----------------------- Access checks -----------------------
async function getAccess(ctx, action) {
  if (!isOwner(ctx.userId)) throw new Error("هذا الحساب غير مصرح له.");
  if (!ctx.guild || !ctx.channel || !isControlRoom(ctx.channel)) {
    throw new Error("نفّذ الطلب داخل روم EM7 الخاص الذي أنشأه /em7.");
  }
  const actor = await ctx.guild.members.fetch(ctx.userId).catch(() => null);
  if (!actor) throw new Error("تعذر العثور على حساب المالك داخل السيرفر.");
  const botMember = ctx.guild.members.me || await ctx.guild.members.fetch(client.user.id);
  const userRequired = USER_PERMISSIONS[action];
  if (userRequired && !actor.permissions.has(userRequired)) {
    throw new Error(`حسابك يحتاج صلاحية Discord: ${permissionName(userRequired)}.`);
  }
  const botRequired = BOT_PERMISSIONS[action];
  if (botRequired && !botMember.permissions.has(botRequired)) {
    throw new Error(`البوت يحتاج صلاحية Discord: ${permissionName(botRequired)}.`);
  }
  return { actor, botMember };
}
function permissionName(bit) {
  return Object.keys(P).find(k => P[k] === bit) || String(bit);
}

// ----------------------- Resolvers -----------------------
async function resolveChannel(guild, input) {
  const value = clean(input, 120);
  const id = value.match(/\d{17,20}/)?.[0];
  if (id) return guild.channels.fetch(id).catch(() => null);
  await guild.channels.fetch().catch(() => {});
  const matches = guild.channels.cache.filter(c => c.name.toLowerCase() === value.toLowerCase());
  if (matches.size > 1) throw new Error("يوجد أكثر من قناة بهذا الاسم؛ أرسل ID القناة.");
  return matches.first() || null;
}
async function resolveRole(guild, input) {
  const value = clean(input, 120);
  const id = value.match(/\d{17,20}/)?.[0];
  if (id) return guild.roles.fetch(id).catch(() => null);
  await guild.roles.fetch().catch(() => {});
  const matches = guild.roles.cache.filter(r => r.name.toLowerCase() === value.toLowerCase());
  if (matches.size > 1) throw new Error("يوجد أكثر من رتبة بهذا الاسم؛ أرسل ID الرتبة.");
  return matches.first() || null;
}
async function resolveMember(guild, input) {
  const value = clean(input, 120);
  const id = value.match(/\d{17,20}/)?.[0];
  if (id) return guild.members.fetch(id).catch(() => null);
  const cached = guild.members.cache.filter(m =>
    m.user.username.toLowerCase() === value.toLowerCase() ||
    m.displayName.toLowerCase() === value.toLowerCase()
  );
  if (cached.size > 1) throw new Error("يوجد أكثر من عضو بهذا الاسم؛ أرسل ID العضو.");
  if (cached.size === 1) return cached.first();
  const fetched = await guild.members.fetch({ query: value, limit: 10 }).catch(() => null);
  if (!fetched) return null;
  const matches = fetched.filter(m =>
    m.user.username.toLowerCase() === value.toLowerCase() ||
    m.displayName.toLowerCase() === value.toLowerCase()
  );
  if (matches.size > 1) throw new Error("يوجد أكثر من عضو بهذا الاسم؛ أرسل ID العضو.");
  return matches.first() || null;
}
function checkRoleHierarchy(role, actor, botMember) {
  if (role.id === role.guild.id || role.managed) throw new Error("هذه الرتبة محمية أو مُدارة بواسطة تكامل.");
  if (role.position >= botMember.roles.highest.position) throw new Error("رتبة الهدف أعلى من رتبة البوت أو مساوية لها.");
  if (actor.id !== role.guild.ownerId && role.position >= actor.roles.highest.position) {
    throw new Error("رتبة الهدف أعلى من رتبتك أو مساوية لها.");
  }
}
function checkMemberHierarchy(target, actor, botMember) {
  if (target.id === actor.id) throw new Error("لا تنفذ هذا الإجراء على حسابك.");
  if (target.id === target.guild.ownerId) throw new Error("لا يمكن إدارة مالك السيرفر.");
  if (target.roles.highest.position >= botMember.roles.highest.position) throw new Error("رتبة العضو أعلى من رتبة البوت أو مساوية لها.");
  if (actor.id !== target.guild.ownerId && target.roles.highest.position >= actor.roles.highest.position) {
    throw new Error("رتبة العضو أعلى من رتبتك أو مساوية لها.");
  }
}

// ----------------------- Approval gate -----------------------
function actionLabel(action) {
  const labels = {
    delete_channel: "حذف قناة", delete_role: "حذف رتبة", create_role: "إنشاء رتبة",
    create_bot_project: "إنشاء مشروع بوت مستقل", update_bot_project: "تحديث مشروع بوت مستقل",
    edit_role: "تعديل رتبة", assign_role: "إسناد رتبة", remove_role: "إزالة رتبة",
    set_channel_permissions: "تعديل صلاحيات قناة", timeout_member: "إيقاف عضو مؤقتاً",
    kick_member: "طرد عضو", ban_member: "حظر عضو", unban_member: "فك حظر",
    purge_messages: "حذف رسائل", lock_channel: "قفل القناة", edit_channel: "تعديل قناة"
  };
  return labels[action] || action;
}
function describeArgs(args) {
  return Object.entries(args || {}).map(([k, v]) => {
    const value = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    return `**${clean(k, 40)}:** ${clean(value, 180)}`;
  }).join("\n").slice(0, 1500) || "لا توجد تفاصيل إضافية";
}
async function requestConfirmation(ctx, action, args) {
  if (pending.size >= CONFIG.MAX_PENDING) throw new Error("قائمة الموافقات ممتلئة مؤقتاً؛ أكمل أو ألغِ الطلبات السابقة.");
  const id = crypto.randomBytes(10).toString("hex");
  const item = {
    action, args: structuredClone(args), userId: CONFIG.OWNER_ID,
    guildId: ctx.guild.id, channelId: ctx.channel.id,
    expires: Date.now() + CONFIG.CONFIRM_TIMEOUT_MS, status: "pending"
  };
  pending.set(id, item);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`em7:approve:${id}`).setLabel("موافقة وتنفيذ").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`em7:cancel:${id}`).setLabel("إلغاء الطلب").setStyle(ButtonStyle.Secondary)
  );
  const embed = new EmbedBuilder()
    .setColor(0xD97706)
    .setTitle("EM7 SECURITY GATE")
    .setDescription("**طلب تنفيذ يحتاج موافقتك الصريحة.**\nلم يتم تنفيذ أي تغيير حتى الآن.")
    .addFields(
      { name: "العملية", value: actionLabel(action), inline: true },
      { name: "مستوى الحماية", value: "تأكيد المالك مطلوب", inline: true },
      { name: "تفاصيل الطلب", value: describeArgs(args) }
    )
    .setFooter({ text: "تنتهي الموافقة بعد 90 ثانية • EM7 ULTIMATE" })
    .setTimestamp();
  await ctx.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: [] } });
  return { success: true, awaiting_confirmation: true, request_id: id, message: "بانتظار موافقة المالك؛ لم ينفذ الطلب." };
}

// ----------------------- Tool execution -----------------------
async function runTool(action, args, ctx, confirmed = false) {
  if (!TOOL_NAMES.has(action)) throw new Error(`الأداة غير معروفة: ${clean(action, 80)}`);
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("وسائط الأداة غير صحيحة.");
  const { actor, botMember } = await getAccess(ctx, action);
  if (SENSITIVE_ACTIONS.has(action) && !confirmed) return requestConfirmation(ctx, action, args);
  const guild = ctx.guild;

  switch (action) {
    case "server_info":
      await guild.fetch();
      return {
        success: true, name: guild.name, id: guild.id, ownerId: guild.ownerId,
        memberCount: guild.memberCount, roleCount: guild.roles.cache.size - 1,
        channelCount: guild.channels.cache.size, createdAt: guild.createdAt.toISOString()
      };

    case "list_roles":
      await guild.roles.fetch();
      return guild.roles.cache.filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position).map(r => ({
          name: r.name, id: r.id, position: r.position, color: r.hexColor,
          permissions: r.permissions.toArray().filter(x => x !== "Administrator"), managed: r.managed
        })).slice(0, 100);

    case "list_channels":
      await guild.channels.fetch().catch(() => {});
      return guild.channels.cache.sort((a, b) => a.rawPosition - b.rawPosition)
        .map(ch => ({ name: ch.name, id: ch.id, type: ch.type, category: ch.parent?.name || null }))
        .slice(0, 150);

    case "list_members": {
      // Fetch only a bounded sample; do not force-download an entire large server.
      const members = await guild.members.fetch({ limit: 100 }).catch(() => guild.members.cache);
      return [...members.values()].filter(m => !m.user.bot).slice(0, 80).map(m => ({
        username: m.user.username, displayName: m.displayName, id: m.id
      }));
    }

    case "create_channel": {
      const name = clean(args.name, 90).toLowerCase().replace(/\s+/g, "-");
      if (!name || !/^[\p{L}\p{N}_-]+$/u.test(name)) throw new Error("اسم القناة غير صالح.");
      await guild.channels.fetch().catch(() => {});
      if (guild.channels.cache.some(ch => ch.name === name)) throw new Error("توجد قناة بهذا الاسم بالفعل.");
      let parent = null;
      if (args.category) {
        parent = await resolveChannel(guild, args.category);
        if (!parent || parent.type !== ChannelType.GuildCategory) throw new Error("التصنيف المحدد غير موجود.");
      }
      const type = args.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;
      const options = { name, type, reason: "Created by EM7 ULTIMATE" };
      if (parent) options.parent = parent.id;
      if (type === ChannelType.GuildText && args.topic) options.topic = clean(args.topic, 900);
      const channel = await guild.channels.create(options);
      return { success: true, name: channel.name, id: channel.id, type: channel.type };
    }

    case "create_category": {
      const name = clean(args.name, 90);
      if (!name) throw new Error("اسم التصنيف مطلوب.");
      const category = await guild.channels.create({ name, type: ChannelType.GuildCategory, reason: "Created by EM7" });
      return { success: true, name: category.name, id: category.id };
    }

    case "edit_channel": {
      const channel = await resolveChannel(guild, args.channel);
      if (!channel) throw new Error("لم أجد القناة المطلوبة.");
      if (isControlRoom(channel)) throw new Error("تعديل روم EM7 المحمي غير مسموح.");
      const changes = {};
      if (args.name !== undefined) {
        const name = clean(args.name, 90).toLowerCase().replace(/\s+/g, "-");
        if (!name || !/^[\p{L}\p{N}_-]+$/u.test(name)) throw new Error("اسم القناة الجديد غير صالح.");
        changes.name = name;
      }
      if (typeof args.topic === "string" && channel.type === ChannelType.GuildText) changes.topic = clean(args.topic, 900);
      if (typeof args.nsfw === "boolean" && "nsfw" in channel) changes.nsfw = args.nsfw;
      if (args.slowmode !== undefined) {
        const s = Number(args.slowmode);
        if (!Number.isInteger(s) || s < 0 || s > 21600) throw new Error("Slowmode يجب أن يكون بين 0 و21600 ثانية.");
        if (typeof channel.setRateLimitPerUser !== "function") throw new Error("هذه القناة لا تدعم Slowmode.");
        await channel.setRateLimitPerUser(s);
      }
      if (Object.keys(changes).length) await channel.edit(changes, "Edited by EM7");
      return { success: true, channel: channel.name, changes };
    }

    case "delete_channel": {
      const channel = await resolveChannel(guild, args.channel);
      if (!channel) throw new Error("لم أجد القناة.");
      if (isControlRoom(channel)) throw new Error("حذف روم EM7 المحمي ممنوع.");
      const name = channel.name;
      await channel.delete("Deleted by EM7 after owner approval");
      return { success: true, deletedChannel: name };
    }

    case "create_role": {
      const name = clean(args.name, 90);
      if (!name) throw new Error("اسم الرتبة مطلوب.");
      const color = args.color || "#5865F2";
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("لون HEX غير صحيح.");
      const permissions = normalizePermissions(args.permissions || []);
      const role = await guild.roles.create({
        name, color, permissions: permissions.map(n => P[n]),
        hoist: Boolean(args.hoist), mentionable: Boolean(args.mentionable),
        reason: "Created by EM7 after owner approval"
      });
      return { success: true, role: role.name, id: role.id, permissions };
    }

    case "edit_role": {
      const role = await resolveRole(guild, args.role);
      if (!role) throw new Error("لم أجد الرتبة.");
      checkRoleHierarchy(role, actor, botMember);
      const changes = {};
      if (args.name !== undefined) changes.name = clean(args.name, 90);
      if (args.color !== undefined) {
        if (!/^#[0-9a-fA-F]{6}$/.test(args.color)) throw new Error("لون HEX غير صحيح.");
        changes.color = args.color;
      }
      if (typeof args.hoist === "boolean") changes.hoist = args.hoist;
      if (typeof args.mentionable === "boolean") changes.mentionable = args.mentionable;
      if (args.permissions !== undefined) changes.permissions = normalizePermissions(args.permissions).map(n => P[n]);
      if (Object.keys(changes).length) await role.edit(changes, "Edited by EM7");
      if (args.position !== undefined) {
        const position = Number(args.position);
        if (!Number.isInteger(position) || position < 1 || position >= botMember.roles.highest.position) {
          throw new Error("موضع الرتبة غير صالح أو يتجاوز رتبة البوت.");
        }
        await role.setPosition(position);
      }
      return { success: true, role: role.name, changes };
    }

    case "delete_role": {
      const role = await resolveRole(guild, args.role);
      if (!role) throw new Error("لم أجد الرتبة.");
      checkRoleHierarchy(role, actor, botMember);
      const name = role.name;
      await role.delete("Deleted by EM7 after owner approval");
      return { success: true, deletedRole: name };
    }

    case "assign_role":
    case "remove_role": {
      const member = await resolveMember(guild, args.member);
      const role = await resolveRole(guild, args.role);
      if (!member) throw new Error("لم أجد العضو.");
      if (!role) throw new Error("لم أجد الرتبة.");
      checkMemberHierarchy(member, actor, botMember);
      checkRoleHierarchy(role, actor, botMember);
      if (action === "assign_role") await member.roles.add(role, "Assigned by EM7");
      else await member.roles.remove(role, "Removed by EM7");
      return { success: true, action, member: member.user.tag, role: role.name };
    }

    case "set_channel_permissions": {
      const channel = await resolveChannel(guild, args.channel);
      if (!channel || !channel.permissionOverwrites) throw new Error("القناة غير موجودة أو لا تدعم الصلاحيات.");
      if (isControlRoom(channel)) throw new Error("تعديل صلاحيات روم EM7 المحمي ممنوع.");
      let target;
      if (args.target_type === "role") {
        target = await resolveRole(guild, args.target);
        if (!target || target.id === guild.id) throw new Error("الرتبة المستهدفة غير صالحة.");
        checkRoleHierarchy(target, actor, botMember);
      } else if (args.target_type === "member") {
        target = await resolveMember(guild, args.target);
        if (!target) throw new Error("لم أجد العضو المستهدف.");
        checkMemberHierarchy(target, actor, botMember);
        target = target.user;
      } else throw new Error("نوع الهدف يجب أن يكون role أو member.");
      const allow = normalizePermissions(args.allow || []);
      const deny = normalizePermissions(args.deny || []);
      if (allow.some(x => deny.includes(x))) throw new Error("لا يمكن السماح والمنع للصلاحية نفسها.");
      if (!allow.length && !deny.length) throw new Error("حدد صلاحية واحدة على الأقل.");
      const overwrites = {};
      for (const name of allow) overwrites[name] = true;
      for (const name of deny) overwrites[name] = false;
      await channel.permissionOverwrites.edit(target.id, overwrites, { reason: "Updated by EM7" });
      return { success: true, channel: channel.name, target: target.id, allowed: allow, denied: deny };
    }

    case "timeout_member":
    case "kick_member":
    case "ban_member": {
      const member = await resolveMember(guild, args.member);
      if (!member) throw new Error("لم أجد العضو.");
      checkMemberHierarchy(member, actor, botMember);
      const reason = clean(args.reason || "EM7 moderation", 400);
      if (action === "timeout_member") {
        const minutes = Number(args.minutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 40320) throw new Error("المدة يجب أن تكون من دقيقة إلى 28 يوماً.");
        await member.timeout(minutes * 60000, reason);
        return { success: true, member: member.user.tag, minutes, reason };
      }
      if (action === "kick_member") {
        const tag = member.user.tag;
        await member.kick(reason);
        return { success: true, kicked: tag, reason };
      }
      const tag = member.user.tag;
      await member.ban({ reason });
      return { success: true, banned: tag, reason };
    }

    case "unban_member": {
      const id = String(args.user_id || "").match(/^\d{17,20}$/)?.[0];
      if (!id) throw new Error("أرسل Discord User ID صحيحاً.");
      await guild.bans.remove(id, "Unbanned by EM7");
      return { success: true, unbannedUserId: id };
    }

    case "purge_messages": {
      const amount = Number(args.amount);
      if (!Number.isInteger(amount) || amount < 2 || amount > 100) throw new Error("حدد عدداً من 2 إلى 100.");
      if (!isTextBased(ctx.channel) || typeof ctx.channel.bulkDelete !== "function") throw new Error("الروم الحالي لا يدعم حذف الرسائل.");
      const deleted = await ctx.channel.bulkDelete(amount, true);
      return { success: true, deleted: deleted.size, note: "Discord لا يحذف بهذه الطريقة الرسائل الأقدم من 14 يوماً." };
    }

    case "lock_channel": {
      if (!ctx.channel.permissionOverwrites) throw new Error("الروم الحالي لا يدعم قفل الكتابة.");
      await ctx.channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: args.locked ? false : null
      }, { reason: "EM7 channel lock" });
      return { success: true, channel: ctx.channel.name, locked: Boolean(args.locked) };
    }

    case "set_slowmode": {
      const seconds = Number(args.seconds);
      if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21600) throw new Error("Slowmode يجب أن يكون بين 0 و21600 ثانية.");
      if (typeof ctx.channel.setRateLimitPerUser !== "function") throw new Error("الروم الحالي لا يدعم Slowmode.");
      await ctx.channel.setRateLimitPerUser(seconds);
      return { success: true, channel: ctx.channel.name, seconds };
    }

    case "create_bot_project":
    case "update_bot_project": {
      const payload = {
        type: args.type,
        name: clean(args.name, 36),
        description: clean(args.description || "", 500),
        config: args.config && typeof args.config === "object" && !Array.isArray(args.config) ? args.config : {}
      };
      const project = action === "create_bot_project"
        ? await createBotProject(payload)
        : await updateBotProject(payload);
      await ctx.channel.send({
        content: `**EM7 BOT FACTORY**\nتم تجهيز مشروع **${project.projectName}** بنجاح.\nالنوع: **${project.type}**\nالملف يحتوي مشروعاً مستقلاً؛ أنشئ تطبيق Discord جديداً وأضف التوكن في متغيرات الاستضافة.`,
        files: [{ attachment: project.zipPath, name: `${project.projectName}.zip` }],
        allowedMentions: { parse: [] }
      });
      return { success: true, projectName: project.projectName, type: project.type, deliveredAs: "ZIP attachment", config: project.config };
    }

    default:
      throw new Error(`لا توجد دالة تنفيذ للأداة: ${action}`);
  }
}

// ----------------------- Groq + AI loop -----------------------
async function askGroq(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(CONFIG.GROQ_URL, {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${CONFIG.GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CONFIG.MODEL, messages, tools: GROQ_TOOLS,
        tool_choice: "auto", parallel_tool_calls: false,
        temperature: 0.15, max_completion_tokens: 1800
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Groq HTTP ${response.status}`);
    const result = data.choices?.[0]?.message;
    if (!result) throw new Error("Groq لم يرجع رسالة صالحة.");
    return result;
  } finally { clearTimeout(timer); }
}

async function handleAI(message) {
  if (!isOwner(message.author.id)) return;
  const sessionKey = `${message.guild.id}:${message.author.id}`;
  if (busyUsers.has(sessionKey)) {
    await message.reply("⏳ أعالج طلبك السابق؛ انتظر حتى ينتهي.");
    return;
  }
  const now = Date.now();
  const last = cooldowns.get(sessionKey) || 0;
  if (now - last < CONFIG.COOLDOWN_MS) {
    await message.reply("انتظر ثوانٍ قليلة قبل الطلب التالي.");
    return;
  }
  cooldowns.set(sessionKey, now);
  busyUsers.add(sessionKey);
  const history = sessions.get(sessionKey) || [];
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-CONFIG.MAX_HISTORY),
    { role: "user", content: message.content.slice(0, 3000) }
  ];
  try {
    await message.channel.sendTyping();
    let finalText = null;
    let waitingForApproval = false;

    for (let round = 0; round < CONFIG.MAX_TOOL_ROUNDS; round++) {
      const answer = await askGroq(messages);
      messages.push(answer);
      const calls = answer.tool_calls || [];
      if (!calls.length) {
        finalText = answer.content || "لم يرجع النموذج نصاً واضحاً.";
        break;
      }

      for (const call of calls) {
        const action = call.function?.name;
        let args;
        try { args = JSON.parse(call.function?.arguments || "{}"); }
        catch { args = null; }
        let result;
        try {
          if (!TOOL_NAMES.has(action)) throw new Error("اسم الأداة غير مسموح.");
          if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("تعذر قراءة معاملات الأداة؛ أعد صياغة الطلب.");
          result = await runTool(action, args, {
            guild: message.guild, channel: message.channel, userId: message.author.id
          });
        } catch (error) {
          result = { success: false, error: clean(error.message || "خطأ غير معروف", 700) };
        }
        messages.push({
          role: "tool", tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, CONFIG.MAX_OUTPUT)
        });
        if (result?.awaiting_confirmation) {
          waitingForApproval = true;
          finalText = `تم تجهيز بطاقة الموافقة للعملية **${action}**. لم يتم تنفيذها بعد؛ استخدم أزرار البطاقة للموافقة أو الإلغاء.`;
          break;
        }
      }
      if (waitingForApproval) break;
    }

    if (!finalText) finalText = "وصلت إلى حد خطوات التنفيذ لهذا الطلب. قسّم الطلب إلى خطوات أصغر.";
    sessions.set(sessionKey, [
      ...history,
      { role: "user", content: message.content.slice(0, 3000) },
      { role: "assistant", content: finalText.slice(0, 4000) }
    ].slice(-CONFIG.MAX_HISTORY));
    await message.channel.send({ content: finalText, allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[EM7 AI ERROR]", error);
    let text = "حدث خطأ أثناء معالجة الطلب.";
    if (error.name === "AbortError") text = "انتهت مهلة الاتصال بمزود الذكاء الاصطناعي.";
    else if (/401|invalid_api_key/i.test(error.message)) text = "مفتاح Groq غير صحيح؛ راجع GROQ_API_KEY في الاستضافة.";
    else if (/429|rate limit/i.test(error.message)) text = "وصلت إلى حد طلبات Groq؛ انتظر تجدد الحد أو راجع خطة المزود.";
    else text += `\nالتفاصيل: ${clean(error.message, 500)}`;
    await message.channel.send(text).catch(() => {});
  } finally {
    busyUsers.delete(sessionKey);
  }
}

// ----------------------- Slash command -----------------------
const slashCommands = [
  new SlashCommandBuilder().setName("em7").setDescription("إنشاء مركز التحكم الخاص بـ EM7")
];
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(CONFIG.TOKEN);
  const body = slashCommands.map(x => x.toJSON());
  if (CONFIG.DEV_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.DEV_GUILD_ID), { body });
  } else {
    await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body });
  }
}

client.once(Events.ClientReady, async bot => {
  console.log("========================================");
  console.log("EM7 ULTIMATE ONLINE");
  console.log(`BOT: ${bot.user.tag}`);
  console.log(`OWNER: ${CONFIG.OWNER_NAME} (${CONFIG.OWNER_ID})`);
  console.log(`MODEL: ${CONFIG.MODEL}`);
  console.log("========================================");
  try { await registerCommands(); console.log("[EM7] Slash commands registered."); }
  catch (error) { console.error("[EM7 COMMAND REGISTRATION]", error); }
});

// ----------------------- Interactions -----------------------
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!isOwner(interaction.user.id)) {
      if (interaction.isRepliable()) await interaction.reply({
        content: "⛔ هذا النظام مخصص للمالك المصرح له فقط.", flags: MessageFlags.Ephemeral
      }).catch(() => {});
      return;
    }

    if (interaction.isChatInputCommand() && interaction.commandName === "em7") {
      const guild = interaction.guild;
      if (!guild) return interaction.reply({ content: "استخدم الأمر داخل السيرفر.", flags: MessageFlags.Ephemeral });
      const botMember = guild.members.me || await guild.members.fetch(client.user.id);
      if (!botMember.permissions.has(P.ManageChannels)) {
        return interaction.reply({ content: "البوت يحتاج Manage Channels لإنشاء روم EM7.", flags: MessageFlags.Ephemeral });
      }
      const ownerMember = await guild.members.fetch(CONFIG.OWNER_ID).catch(() => null);
      if (!ownerMember) return interaction.reply({ content: "حساب المالك غير موجود داخل هذا السيرفر.", flags: MessageFlags.Ephemeral });
      await guild.channels.fetch().catch(() => {});
      const existing = guild.channels.cache.find(isControlRoom);
      if (existing) return interaction.reply({ content: `مركز EM7 موجود بالفعل: ${existing}`, flags: MessageFlags.Ephemeral });
      const room = await guild.channels.create({
        name: CONFIG.ROOM_NAME, type: ChannelType.GuildText, topic: CONFIG.ROOM_TOPIC,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [P.ViewChannel] },
          { id: CONFIG.OWNER_ID, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory] },
          { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.ManageMessages, P.EmbedLinks] }
        ],
        reason: "EM7 ULTIMATE private owner control center"
      });
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("EM7 ULTIMATE — CONTROL CENTER")
        .setDescription(
          "**مركز التحكم الخاص بك جاهز.**\n\n" +
          "اكتب طلبك بالعربية، وسيختار EM7 الأداة المناسبة وينفذها بعد التحقق.\n\n" +
          "**أمثلة:**\n" +
          "• اعرض معلومات السيرفر والرتب والقنوات\n" +
          "• أنشئ تصنيفاً باسم الإدارة\n" +
          "• أنشئ قناة نصية داخل تصنيف الإدارة\n" +
          "• أنشئ رتبة باسم الدعم بلون أزرق\n" +
          "• عدّل صلاحيات قناة محددة لرتبة معينة\n" +
          "• اعرض عينة من أعضاء السيرفر\n" +
          "• أنشئ مشروع بوت تكت أو فعاليات مستقل\n" +
          "• عدّل مشروع بوت مستقل سبق إنشاؤه\n\n" +
          "العمليات الحساسة تتطلب موافقتك من بطاقة مستقلة."
        )
        .addFields(
          { name: "الوصول", value: "المالك فقط", inline: true },
          { name: "مدة الموافقة", value: "90 ثانية", inline: true },
          { name: "محرك الذكاء", value: CONFIG.MODEL, inline: false }
        )
        .setFooter({ text: "EM7 ULTIMATE • Owner-only control" })
        .setTimestamp();
      await room.send({ embeds: [embed], allowedMentions: { parse: [] } });
      return interaction.reply({ content: `تم إنشاء مركز EM7: ${room}`, flags: MessageFlags.Ephemeral });
    }

    if (interaction.isButton()) {
      const match = interaction.customId.match(/^em7:(approve|cancel):([a-f0-9]+)$/);
      if (!match) return;
      const [, mode, id] = match;
      const item = pending.get(id);
      if (!item) return interaction.reply({ content: "انتهت صلاحية هذا الطلب أو تم إغلاقه.", flags: MessageFlags.Ephemeral });
      if (!isOwner(interaction.user.id) || item.userId !== interaction.user.id) {
        return interaction.reply({ content: "غير مصرح لك بالموافقة.", flags: MessageFlags.Ephemeral });
      }
      if (item.guildId !== interaction.guildId || item.channelId !== interaction.channelId) {
        return interaction.reply({ content: "مكان الموافقة غير صحيح.", flags: MessageFlags.Ephemeral });
      }
      if (Date.now() > item.expires) {
        pending.delete(id);
        return interaction.update({ content: "انتهت مهلة الموافقة؛ لم يتم التنفيذ.", embeds: [], components: [] });
      }
      if (item.status !== "pending") {
        return interaction.reply({ content: "هذا الطلب قيد المعالجة أو أُغلق.", flags: MessageFlags.Ephemeral });
      }
      if (mode === "cancel") {
        item.status = "cancelled";
        pending.delete(id);
        return interaction.update({ content: "تم إلغاء العملية. لم يحدث أي تغيير.", embeds: [], components: [] });
      }
      // Set state before awaiting to prevent duplicate button clicks.
      item.status = "executing";
      await interaction.deferUpdate();
      try {
        const guild = await client.guilds.fetch(item.guildId);
        const channel = await guild.channels.fetch(item.channelId);
        if (!channel || !isControlRoom(channel)) throw new Error("روم EM7 غير موجود أو لم يعد روم الحماية.");
        const result = await runTool(item.action, item.args, {
          guild, channel, userId: interaction.user.id
        }, true);
        pending.delete(id);
        await interaction.message.edit({
          content: "✅ **تم تنفيذ العملية بنجاح**\n```json\n" + JSON.stringify(result, null, 2).slice(0, 1300) + "\n```",
          embeds: [], components: [], allowedMentions: { parse: [] }
        });
      } catch (error) {
        pending.delete(id);
        await interaction.message.edit({
          content: `❌ **فشل التنفيذ**\n${clean(error.message, 800)}`,
          embeds: [], components: []
        });
      }
    }
  } catch (error) {
    console.error("[EM7 INTERACTION ERROR]", error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "حدث خطأ أثناء معالجة الطلب.", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

// ----------------------- Message handler -----------------------
client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;
  if (!isControlRoom(message.channel)) return;
  if (!isOwner(message.author.id)) {
    await message.reply("⛔ هذا المركز مخصص للمالك فقط.").catch(() => {});
    return;
  }
  if (!message.content.trim()) return;
  await handleAI(message);
});

// ----------------------- Cleanup and errors -----------------------
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of pending) {
    if (now > item.expires && item.status !== "executing") pending.delete(id);
  }
  for (const [key, time] of cooldowns) {
    if (now - time > 60000) cooldowns.delete(key);
  }
}, 30000).unref();

client.on(Events.Error, error => console.error("[EM7 CLIENT ERROR]", error));
process.on("unhandledRejection", error => console.error("[EM7 UNHANDLED REJECTION]", error));
process.on("uncaughtException", error => console.error("[EM7 UNCAUGHT EXCEPTION]", error));

client.login(CONFIG.TOKEN);
