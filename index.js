
"use strict";

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits: P,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require("discord.js");

const crypto = require("node:crypto");

// =====================================================
// EM7 ULTIMATE — CONFIG
// =====================================================

const CONFIG = {
  OWNER_ID: "1354814086021644320",
  OWNER_NAME: "k_zi",

  TOKEN: process.env.DISCORD_TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GROQ_KEY: process.env.GROQ_API_KEY,

  MODEL: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  DEV_GUILD_ID: process.env.DEV_GUILD_ID || null,

  GROQ_URL: "https://api.groq.com/openai/v1/chat/completions",

  PROTECTION_TOPIC: "EM7_ULTIMATE_PRIVATE_ROOM",

  COOLDOWN_MS: 4000,
  CONFIRM_TIMEOUT_MS: 90000,
  MAX_TOOL_ROUNDS: 7,
  MAX_HISTORY: 12
};

for (const key of ["TOKEN", "CLIENT_ID", "GROQ_KEY"]) {
  if (!CONFIG[key]) {
    console.error(`[EM7] Missing environment variable: ${key}`);
    process.exit(1);
  }
}

// =====================================================
// DISCORD CLIENT
// =====================================================

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

// =====================================================
// OWNER SECURITY
// =====================================================

function isOwner(userId) {
  return String(userId) === CONFIG.OWNER_ID;
}

function requireOwner(userId) {
  if (!isOwner(userId)) {
    throw new Error("ACCESS DENIED: حسابك غير مصرح له باستخدام EM7.");
  }
}

// =====================================================
// AI INSTRUCTIONS
// =====================================================

const SYSTEM_PROMPT = `
أنت EM7 ULTIMATE، مساعد إدارة متقدم لسيرفر Discord.

أنت متصل بأدوات فعلية تنفذ عمليات Discord.js.
افهم الأوامر العربية واللهجات السعودية ونفذ المطلوب باستخدام الأدوات.

قواعد التنفيذ:
- لا تدّع تنفيذ عملية لم تنجح.
- لا تخترع بيانات أو نتائج.
- استخدم الأدوات عند طلب قراءة بيانات السيرفر أو تعديلها.
- إذا كان الهدف غير واضح، اطلب توضيحاً.
- لا تكرر عملية نجحت بالفعل.
- لا تنفذ أكواد JavaScript عشوائية.
- لا تنفذ أوامر نظام أو Shell.
- لا تطلب كلمات مرور أو مفاتيح API أو توكنات.
- لا تحاول تجاوز صلاحيات Discord أو ترتيب الرتب.
- لا تمنح Administrator.
- لا تنفذ عمليات جماعية غير محددة.
- العمليات الحساسة تحتاج تأكيداً من المالك.
- إذا كانت العملية تنتظر التأكيد، أخبر المستخدم أنها لم تنفذ بعد.
- أجب بالعربية وباختصار واضح.

عند إنشاء عدة قنوات أو رتب:
نفذ كل خطوة بأداة منفصلة، وتحقق من نتيجة كل خطوة.
إذا فشلت خطوة، اشرح ما نجح وما فشل.

أنت محرك إدارة Discord، وليس لديك وصول مباشر إلى ملفات الاستضافة أو نظام التشغيل.
`;

// =====================================================
// ALLOWED PERMISSIONS
// =====================================================

const ALLOWED_PERMISSIONS = [
  "ViewChannel",
  "ManageChannels",
  "ManageRoles",
  "ManageMessages",
  "SendMessages",
  "ReadMessageHistory",
  "EmbedLinks",
  "AttachFiles",
  "AddReactions",
  "UseExternalEmojis",
  "UseExternalStickers",
  "Connect",
  "Speak",
  "MuteMembers",
  "DeafenMembers",
  "MoveMembers",
  "KickMembers",
  "BanMembers",
  "ModerateMembers",
  "MentionEveryone",
  "CreatePublicThreads",
  "CreatePrivateThreads",
  "SendMessagesInThreads",
  "ManageThreads",
  "ManageNicknames",
  "ViewAuditLog",
  "ManageEvents",
  "CreateEvents",
  "UseApplicationCommands"
];

function validatePermissions(names) {
  if (!Array.isArray(names)) {
    throw new Error("قائمة الصلاحيات غير صحيحة.");
  }

  const unique = [...new Set(names)];

  for (const name of unique) {
    if (
      !ALLOWED_PERMISSIONS.includes(name) ||
      !P[name]
    ) {
      throw new Error(`الصلاحية غير مسموحة: ${name}`);
    }
  }

  return unique;
}

// =====================================================
// TOOL DEFINITIONS
// =====================================================

const toolDefinitions = [
  {
    name: "server_info",
    description: "عرض معلومات السيرفر.",
    properties: {},
    required: []
  },
  {
    name: "list_roles",
    description: "عرض رتب السيرفر وصلاحياتها.",
    properties: {},
    required: []
  },
  {
    name: "list_channels",
    description: "عرض قنوات السيرفر وتصنيف كل قناة.",
    properties: {},
    required: []
  },
  {
    name: "list_members",
    description: "عرض عينة من أعضاء السيرفر.",
    properties: {},
    required: []
  },
  {
    name: "create_channel",
    description: "إنشاء قناة نصية أو صوتية.",
    properties: {
      name: { type: "string" },
      type: { type: "string", enum: ["text", "voice"] },
      topic: { type: "string" },
      category: { type: "string" }
    },
    required: ["name"]
  },
  {
    name: "create_category",
    description: "إنشاء تصنيف للقنوات.",
    properties: {
      name: { type: "string" }
    },
    required: ["name"]
  },
  {
    name: "edit_channel",
    description: "تعديل اسم أو وصف أو Slowmode قناة.",
    properties: {
      channel: { type: "string" },
      name: { type: "string" },
      topic: { type: "string" },
      slowmode: { type: "integer" },
      nsfw: { type: "boolean" }
    },
    required: ["channel"]
  },
  {
    name: "delete_channel",
    description: "حذف قناة أو تصنيف محدد.",
    properties: {
      channel: { type: "string" }
    },
    required: ["channel"]
  },
  {
    name: "create_role",
    description: "إنشاء رتبة بصلاحيات محددة.",
    properties: {
      name: { type: "string" },
      color: { type: "string" },
      permissions: {
        type: "array",
        items: { type: "string" }
      },
      hoist: { type: "boolean" },
      mentionable: { type: "boolean" }
    },
    required: ["name"]
  },
  {
    name: "edit_role",
    description: "تعديل اسم ولون وصلاحيات رتبة.",
    properties: {
      role: { type: "string" },
      name: { type: "string" },
      color: { type: "string" },
      permissions: {
        type: "array",
        items: { type: "string" }
      },
      hoist: { type: "boolean" },
      mentionable: { type: "boolean" },
      position: { type: "integer" }
    },
    required: ["role"]
  },
  {
    name: "delete_role",
    description: "حذف رتبة.",
    properties: {
      role: { type: "string" }
    },
    required: ["role"]
  },
  {
    name: "assign_role",
    description: "إسناد رتبة لعضو.",
    properties: {
      member: { type: "string" },
      role: { type: "string" }
    },
    required: ["member", "role"]
  },
  {
    name: "remove_role",
    description: "إزالة رتبة من عضو.",
    properties: {
      member: { type: "string" },
      role: { type: "string" }
    },
    required: ["member", "role"]
  },
  {
    name: "set_channel_permissions",
    description: "تعيين صلاحيات السماح والمنع لرتبة أو عضو في قناة.",
    properties: {
      channel: { type: "string" },
      target_type: { type: "string", enum: ["role", "member"] },
      target: { type: "string" },
      allow: { type: "array", items: { type: "string" } },
      deny: { type: "array", items: { type: "string" } }
    },
    required: ["channel", "target_type", "target"]
  },
  {
    name: "timeout_member",
    description: "إسكات عضو مؤقتاً بالدقائق.",
    properties: {
      member: { type: "string" },
      minutes: { type: "integer" },
      reason: { type: "string" }
    },
    required: ["member", "minutes"]
  },
  {
    name: "kick_member",
    description: "طرد عضو من السيرفر.",
    properties: {
      member: { type: "string" },
      reason: { type: "string" }
    },
    required: ["member"]
  },
  {
    name: "ban_member",
    description: "حظر عضو من السيرفر.",
    properties: {
      member: { type: "string" },
      reason: { type: "string" }
    },
    required: ["member"]
  },
  {
    name: "unban_member",
    description: "فك حظر مستخدم باستخدام Discord ID.",
    properties: {
      user_id: { type: "string" }
    },
    required: ["user_id"]
  },
  {
    name: "purge_messages",
    description: "حذف عدد محدد من الرسائل الحديثة في القناة الحالية.",
    properties: {
      amount: { type: "integer" }
    },
    required: ["amount"]
  },
  {
    name: "lock_channel",
    description: "قفل أو فتح الكتابة في القناة الحالية.",
    properties: {
      locked: { type: "boolean" }
    },
    required: ["locked"]
  },
  {
    name: "set_slowmode",
    description: "تحديد مدة Slowmode للقناة الحالية بالثواني.",
    properties: {
      seconds: { type: "integer" }
    },
    required: ["seconds"]
  }
];

const tools = toolDefinitions.map(tool => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "object",
      properties: tool.properties,
      required: tool.required,
      additionalProperties: false
    }
  }
}));

// =====================================================
// ACTION PERMISSIONS
// =====================================================

const userPermissions = {
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

const botPermissions = {
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

const sensitiveActions = new Set([
  "delete_channel",
  "delete_role",
  "edit_role",
  "set_channel_permissions",
  "assign_role",
  "remove_role",
  "timeout_member",
  "kick_member",
  "ban_member",
  "unban_member",
  "purge_messages",
  "lock_channel"
]);

// =====================================================
// GENERAL HELPERS
// =====================================================

function clean(value, max = 100) {
  return String(value ?? "").trim().slice(0, max);
}

function isProtection(channel) {
  return channel?.topic === CONFIG.PROTECTION_TOPIC;
}

function isTextChannel(channel) {
  return channel?.type === ChannelType.GuildText;
}

async function getAccess(ctx, action) {
  requireOwner(ctx.userId);

  if (!ctx.guild || !ctx.channel) {
    throw new Error("هذه العملية تعمل داخل السيرفر فقط.");
  }

  if (!isProtection(ctx.channel)) {
    throw new Error("استخدم EM7 داخل روم الحماية.");
  }

  const actor = await ctx.guild.members.fetch(ctx.userId);

  const botMember =
    ctx.guild.members.me ||
    await ctx.guild.members.fetch(client.user.id);

  const userRequired = userPermissions[action];

  if (
    userRequired &&
    !actor.permissions.has(P.Administrator) &&
    !actor.permissions.has(userRequired)
  ) {
    throw new Error("لا تملك صلاحية Discord المطلوبة لهذه العملية.");
  }

  const botRequired = botPermissions[action];

  if (
    botRequired &&
    !botMember.permissions.has(P.Administrator) &&
    !botMember.permissions.has(botRequired)
  ) {
    throw new Error("البوت لا يملك صلاحية Discord المطلوبة.");
  }

  return { actor, botMember };
}

// =====================================================
// RESOLVE CHANNEL / ROLE / MEMBER
// =====================================================

async function resolveChannel(guild, input) {
  const value = clean(input);
  const id = value.match(/\d{17,20}/)?.[0];

  if (id) {
    return guild.channels.fetch(id).catch(() => null);
  }

  const matches = guild.channels.cache.filter(
    channel => channel.name.toLowerCase() === value.toLowerCase()
  );

  if (matches.size > 1) {
    throw new Error("يوجد أكثر من قناة بهذا الاسم. استخدم ID.");
  }

  return matches.first() || null;
}

async function resolveRole(guild, input) {
  await guild.roles.fetch();

  const value = clean(input);
  const id = value.match(/\d{17,20}/)?.[0];

  if (id) {
    return guild.roles.fetch(id).catch(() => null);
  }

  const matches = guild.roles.cache.filter(
    role => role.name.toLowerCase() === value.toLowerCase()
  );

  if (matches.size > 1) {
    throw new Error("يوجد أكثر من رتبة بهذا الاسم. استخدم ID.");
  }

  return matches.first() || null;
}

async function resolveMember(guild, input) {
  const value = clean(input);
  const id = value.match(/\d{17,20}/)?.[0];

  if (id) {
    return guild.members.fetch(id).catch(() => null);
  }

  const cached = guild.members.cache.filter(member =>
    member.user.username.toLowerCase() === value.toLowerCase() ||
    member.displayName.toLowerCase() === value.toLowerCase()
  );

  if (cached.size > 1) {
    throw new Error("يوجد أكثر من عضو بهذا الاسم. استخدم ID.");
  }

  if (cached.size === 1) {
    return cached.first();
  }

  const results = await guild.members.fetch({
    query: value,
    limit: 10
  }).catch(() => null);

  if (!results) return null;

  const matches = results.filter(member =>
    member.user.username.toLowerCase() === value.toLowerCase() ||
    member.displayName.toLowerCase() === value.toLowerCase()
  );

  if (matches.size > 1) {
    throw new Error("يوجد أكثر من عضو بهذا الاسم. استخدم ID.");
  }

  return matches.first() || null;
}

// =====================================================
// ROLE HIERARCHY
// =====================================================

function checkRoleHierarchy(role, actor, botMember) {
  if (
    role.id === role.guild.id ||
    role.managed
  ) {
    throw new Error("هذه الرتبة لا يمكن إدارتها.");
  }

  if (role.position >= botMember.roles.highest.position) {
    throw new Error("رتبة الهدف أعلى من رتبة البوت أو مساوية لها.");
  }

  if (
    actor.id !== role.guild.ownerId &&
    role.position >= actor.roles.highest.position
  ) {
    throw new Error("رتبة الهدف أعلى من رتبتك أو مساوية لها.");
  }
}

function checkMemberHierarchy(target, actor, botMember) {
  if (target.id === actor.id) {
    throw new Error("لا يمكنك تنفيذ هذا الإجراء على نفسك.");
  }

  if (target.id === target.guild.ownerId) {
    throw new Error("لا يمكن إدارة مالك السيرفر.");
  }

  if (target.roles.highest.position >= botMember.roles.highest.position) {
    throw new Error("رتبة العضو أعلى من رتبة البوت أو مساوية لها.");
  }

  if (
    actor.id !== target.guild.ownerId &&
    target.roles.highest.position >= actor.roles.highest.position
  ) {
    throw new Error("رتبة العضو أعلى من رتبتك أو مساوية لها.");
  }
}

// =====================================================
// CONFIRMATION SYSTEM
// =====================================================

async function requestConfirmation(ctx, action, args) {
  const id = crypto.randomBytes(12).toString("hex");

  pending.set(id, {
    action,
    args,
    userId: CONFIG.OWNER_ID,
    guildId: ctx.guild.id,
    channelId: ctx.channel.id,
    expires: Date.now() + CONFIG.CONFIRM_TIMEOUT_MS
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`em7_yes:${id}`)
      .setLabel("تأكيد التنفيذ")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId(`em7_no:${id}`)
      .setLabel("إلغاء")
      .setStyle(ButtonStyle.Secondary)
  );

  const embed = new EmbedBuilder()
    .setColor(0xD97706)
    .setTitle("EM7 SECURITY GATE")
    .setDescription(
      `**العملية:** \`${action}\`\n\n` +
      "هذه العملية تحتاج تأكيدك.\n" +
      "لم يتم تنفيذها حتى الآن."
    )
    .setFooter({
      text: "EM7 ULTIMATE • Owner Confirmation"
    })
    .setTimestamp();

  await ctx.channel.send({
    embeds: [embed],
    components: [row]
  });

  return {
    success: true,
    awaiting_confirmation: true,
    message: "بانتظار تأكيد المالك."
  };
}

// =====================================================
// EXECUTE TOOL
// =====================================================

async function executeTool(action, args, ctx, confirmed = false) {
  const { actor, botMember } = await getAccess(ctx, action);
  const guild = ctx.guild;

  if (sensitiveActions.has(action) && !confirmed) {
    return requestConfirmation(ctx, action, args);
  }

  switch (action) {

    // -----------------------------------------------
    // SERVER INFORMATION
    // -----------------------------------------------

    case "server_info": {
      await guild.roles.fetch();

      return {
        name: guild.name,
        id: guild.id,
        memberCount: guild.memberCount,
        roleCount: guild.roles.cache.size - 1,
        channelCount: guild.channels.cache.size,
        ownerId: guild.ownerId,
        createdAt: guild.createdAt.toISOString()
      };
    }

    case "list_roles": {
      await guild.roles.fetch();

      return guild.roles.cache
        .filter(role => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => ({
          name: role.name,
          id: role.id,
          position: role.position,
          color: role.hexColor,
          permissions: role.permissions.toArray(),
          managed: role.managed
        }))
        .slice(0, 100);
    }

    case "list_channels": {
      return guild.channels.cache
        .sort((a, b) => a.rawPosition - b.rawPosition)
        .map(channel => ({
          name: channel.name,
          id: channel.id,
          type: channel.type,
          category: channel.parent?.name || null
        }))
        .slice(0, 150);
    }

    case "list_members": {
      await guild.members.fetch();

      return guild.members.cache
        .filter(member => !member.user.bot)
        .map(member => ({
          username: member.user.username,
          displayName: member.displayName,
          id: member.id
        }))
        .slice(0, 100);
    }

    // -----------------------------------------------
    // CHANNEL MANAGEMENT
    // -----------------------------------------------

    case "create_channel": {
      const name = clean(args.name)
        .toLowerCase()
        .replace(/\s+/g, "-");

      if (!name || !/^[\p{L}\p{N}_-]+$/u.test(name)) {
        throw new Error("اسم القناة غير صالح.");
      }

      if (guild.channels.cache.some(channel => channel.name === name)) {
        throw new Error("توجد قناة بهذا الاسم.");
      }

      let parent = null;

      if (args.category) {
        parent = await resolveChannel(guild, args.category);

        if (!parent || parent.type !== ChannelType.GuildCategory) {
          throw new Error("لم أجد التصنيف المطلوب.");
        }
      }

      const type = args.type === "voice"
        ? ChannelType.GuildVoice
        : ChannelType.GuildText;

      const options = {
        name,
        type,
        reason: "Created by EM7 ULTIMATE"
      };

      if (parent) options.parent = parent.id;

      if (type === ChannelType.GuildText && args.topic) {
        options.topic = clean(args.topic, 900);
      }

      const channel = await guild.channels.create(options);

      return {
        success: true,
        channel: channel.name,
        id: channel.id,
        type: channel.type
      };
    }

    case "create_category": {
      const name = clean(args.name);

      if (!name) {
        throw new Error("اسم التصنيف مطلوب.");
      }

      const category = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        reason: "Created by EM7 ULTIMATE"
      });

      return {
        success: true,
        category: category.name,
        id: category.id
      };
    }

    case "edit_channel": {
      const channel = await resolveChannel(guild, args.channel);

      if (!channel) {
        throw new Error("لم أجد القناة.");
      }

      if (isProtection(channel)) {
        throw new Error("لا يمكن تعديل روم الحماية.");
      }

      const changes = {};

      if (args.name) {
        changes.name = clean(args.name)
          .toLowerCase()
          .replace(/\s+/g, "-");
      }

      if (
        typeof args.topic === "string" &&
        channel.type === ChannelType.GuildText
      ) {
        changes.topic = clean(args.topic, 900);
      }

      if (
        typeof args.nsfw === "boolean" &&
        "nsfw" in channel
      ) {
        changes.nsfw = args.nsfw;
      }

      if (args.slowmode !== undefined) {
        const seconds = Number(args.slowmode);

        if (
          !Number.isInteger(seconds) ||
          seconds < 0 ||
          seconds > 21600
        ) {
          throw new Error("Slowmode يجب أن يكون بين 0 و21600 ثانية.");
        }

        if (!("setRateLimitPerUser" in channel)) {
          throw new Error("هذه القناة لا تدعم Slowmode.");
        }

        await channel.setRateLimitPerUser(seconds);
      }

      if (Object.keys(changes).length) {
        await channel.edit(changes);
      }

      return {
        success: true,
        channel: channel.name,
        changes
      };
    }

    case "delete_channel": {
      const channel = await resolveChannel(guild, args.channel);

      if (!channel) {
        throw new Error("لم أجد القناة.");
      }

      if (isProtection(channel)) {
        throw new Error("حذف روم الحماية ممنوع.");
      }

      const deletedName = channel.name;

      await channel.delete("Deleted by EM7 ULTIMATE");

      return {
        success: true,
        deletedChannel: deletedName
      };
    }

    // -----------------------------------------------
    // ROLE MANAGEMENT
    // -----------------------------------------------

    case "create_role": {
      const name = clean(args.name);

      if (!name) {
        throw new Error("اسم الرتبة مطلوب.");
      }

      const color = args.color || "#5865F2";

      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new Error("لون HEX غير صحيح.");
      }

      const permissions = validatePermissions(args.permissions || []);

      const role = await guild.roles.create({
        name,
        color,
        permissions: permissions.map(name => P[name]),
        hoist: Boolean(args.hoist),
        mentionable: Boolean(args.mentionable),
        reason: "Created by EM7 ULTIMATE"
      });

      return {
        success: true,
        role: role.name,
        id: role.id,
        permissions
      };
    }

    case "edit_role": {
      const role = await resolveRole(guild, args.role);

      if (!role) {
        throw new Error("لم أجد الرتبة.");
      }

      checkRoleHierarchy(role, actor, botMember);

      const changes = {};

      if (args.name) changes.name = clean(args.name);

      if (args.color) {
        if (!/^#[0-9a-fA-F]{6}$/.test(args.color)) {
          throw new Error("لون HEX غير صحيح.");
        }

        changes.color = args.color;
      }

      if (typeof args.hoist === "boolean") {
        changes.hoist = args.hoist;
      }

      if (typeof args.mentionable === "boolean") {
        changes.mentionable = args.mentionable;
      }

      if (args.permissions !== undefined) {
        const permissions = validatePermissions(args.permissions);
        changes.permissions = permissions.map(name => P[name]);
      }

      if (Object.keys(changes).length) {
        await role.edit(changes, "Edited by EM7 ULTIMATE");
      }

      if (args.position !== undefined) {
        const position = Number(args.position);

        if (
          !Number.isInteger(position) ||
          position < 1 ||
          position >= botMember.roles.highest.position
        ) {
          throw new Error("موضع الرتبة غير صالح أو يتجاوز رتبة البوت.");
        }

        await role.setPosition(position);
      }

      return {
        success: true,
        role: role.name,
        changes
      };
    }

    case "delete_role": {
      const role = await resolveRole(guild, args.role);

      if (!role) {
        throw new Error("لم أجد الرتبة.");
      }

      checkRoleHierarchy(role, actor, botMember);

      const deletedName = role.name;

      await role.delete("Deleted by EM7 ULTIMATE");

      return {
        success: true,
        deletedRole: deletedName
      };
    }

    case "assign_role":
    case "remove_role": {
      const target = await resolveMember(guild, args.member);
      const role = await resolveRole(guild, args.role);

      if (!target) throw new Error("لم أجد العضو.");
      if (!role) throw new Error("لم أجد الرتبة.");

      checkMemberHierarchy(target, actor, botMember);
      checkRoleHierarchy(role, actor, botMember);

      if (action === "assign_role") {
        await target.roles.add(role);
      } else {
        await target.roles.remove(role);
      }

      return {
        success: true,
        action,
        member: target.user.tag,
        role: role.name
      };
    }

    // -----------------------------------------------
    // CHANNEL PERMISSIONS
    // -----------------------------------------------

    case "set_channel_permissions": {
      const channel = await resolveChannel(guild, args.channel);

      if (!channel || !("permissionOverwrites" in channel)) {
        throw new Error("لم أجد قناة تدعم صلاحيات القنوات.");
      }

      if (isProtection(channel)) {
        throw new Error("تعديل صلاحيات روم الحماية ممنوع.");
      }

      let target;

      if (args.target_type === "role") {
        target = await resolveRole(guild, args.target);

        if (!target || target.id === guild.id) {
          throw new Error("الرتبة غير صالحة.");
        }

        checkRoleHierarchy(target, actor, botMember);

      } else if (args.target_type === "member") {
        const member = await resolveMember(guild, args.target);

        if (!member) {
          throw new Error("لم أجد العضو.");
        }

        target = member.user;

      } else {
        throw new Error("نوع الهدف يجب أن يكون role أو member.");
      }

      const allow = validatePermissions(args.allow || []);
      const deny = validatePermissions(args.deny || []);

      if (allow.some(permission => deny.includes(permission))) {
        throw new Error("لا يمكن السماح والمنع للصلاحية نفسها.");
      }

      if (!allow.length && !deny.length) {
        throw new Error("حدد صلاحية واحدة على الأقل.");
      }

      const overwrite = {};

      for (const permission of allow) {
        overwrite[permission] = true;
      }

      for (const permission of deny) {
        overwrite[permission] = false;
      }

      await channel.permissionOverwrites.edit(
        target.id,
        overwrite,
        { reason: "Updated by EM7 ULTIMATE" }
      );

      return {
        success: true,
        channel: channel.name,
        target: target.id,
        allowed: allow,
        denied: deny
      };
    }

    // -----------------------------------------------
    // MEMBER MODERATION
    // -----------------------------------------------

    case "timeout_member":
    case "kick_member":
    case "ban_member": {
      const target = await resolveMember(guild, args.member);

      if (!target) {
        throw new Error("لم أجد العضو.");
      }

      checkMemberHierarchy(target, actor, botMember);

      const reason = clean(
        args.reason || "EM7 ULTIMATE moderation",
        400
      );

      if (action === "timeout_member") {
        const minutes = Number(args.minutes);

        if (
          !Number.isInteger(minutes) ||
          minutes < 1 ||
          minutes > 40320
        ) {
          throw new Error("المدة يجب أن تكون من دقيقة إلى 28 يوماً.");
        }

        await target.timeout(minutes * 60000, reason);

        return {
          success: true,
          member: target.user.tag,
          minutes,
          reason
        };
      }

      if (action === "kick_member") {
        const tag = target.user.tag;

        await target.kick(reason);

        return {
          success: true,
          kicked: tag,
          reason
        };
      }

      if (action === "ban_member") {
        const tag = target.user.tag;

        await target.ban({ reason });

        return {
          success: true,
          banned: tag,
          reason
        };
      }

      break;
    }

    case "unban_member": {
      const userId = String(args.user_id || "")
        .match(/^\d{17,20}$/)?.[0];

      if (!userId) {
        throw new Error("أرسل Discord User ID صحيحاً.");
      }

      await guild.bans.remove(
        userId,
        "Unbanned by EM7 ULTIMATE"
      );

      return {
        success: true,
        unbannedUserId: userId
      };
    }

    // -----------------------------------------------
    // MESSAGE MANAGEMENT
    // -----------------------------------------------

    case "purge_messages": {
      const amount = Number(args.amount);

      if (
        !Number.isInteger(amount) ||
        amount < 2 ||
        amount > 100
      ) {
        throw new Error("حدد عدداً من 2 إلى 100.");
      }

      if (
        !ctx.channel.isTextBased() ||
        !("bulkDelete" in ctx.channel)
      ) {
        throw new Error("هذه القناة لا تدعم حذف الرسائل بهذه الطريقة.");
      }

      const deleted = await ctx.channel.bulkDelete(amount, true);

      return {
        success: true,
        deleted: deleted.size,
        note: "الرسائل الأقدم من 14 يوماً لا تحذف بهذه الطريقة."
      };
    }

    case "lock_channel": {
      if (!("permissionOverwrites" in ctx.channel)) {
        throw new Error("القناة لا تدعم قفل الكتابة.");
      }

      await ctx.channel.permissionOverwrites.edit(
        guild.roles.everyone,
        {
          SendMessages: args.locked ? false : null
        },
        { reason: "Channel lock changed by EM7" }
      );

      return {
        success: true,
        channel: ctx.channel.name,
        locked: Boolean(args.locked)
      };
    }

    case "set_slowmode": {
      const seconds = Number(args.seconds);

      if (
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > 21600
      ) {
        throw new Error("Slowmode يجب أن يكون بين 0 و21600.");
      }

      if (!("setRateLimitPerUser" in ctx.channel)) {
        throw new Error("القناة لا تدعم Slowmode.");
      }

      await ctx.channel.setRateLimitPerUser(seconds);

      return {
        success: true,
        channel: ctx.channel.name,
        seconds
      };
    }

    default:
      throw new Error(`الأداة غير متاحة: ${action}`);
  }
}

// =====================================================
// GROQ REQUEST
// =====================================================

async function askGroq(messages) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    45000
  );

  try {
    const response = await fetch(CONFIG.GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${CONFIG.GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        messages,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: 0.2,
        max_completion_tokens: 2000
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error?.message || `Groq HTTP ${response.status}`
      );
    }

    const result = data.choices?.[0]?.message;

    if (!result) {
      throw new Error("Groq لم يرجع استجابة صالحة.");
    }

    return result;

  } finally {
    clearTimeout(timeout);
  }
}

// =====================================================
// AI ENGINE
// =====================================================

async function handleAI(message) {
  requireOwner(message.author.id);

  const sessionKey = `${message.guild.id}:${message.author.id}`;
  const lastRequest = cooldowns.get(sessionKey) || 0;

  if (Date.now() - lastRequest < CONFIG.COOLDOWN_MS) {
    await message.reply("انتظر قليلاً قبل إرسال طلب جديد.");
    return;
  }

  cooldowns.set(sessionKey, Date.now());

  const history = (sessions.get(sessionKey) || [])
    .slice(-CONFIG.MAX_HISTORY);

  const messages = [
    {
      role: "system",
      content: SYSTEM_PROMPT
    },
    ...history,
    {
      role: "user",
      content: message.content.slice(0, 3000)
    }
  ];

  await message.channel.sendTyping();

  try {
    let finalText = null;

    for (let round = 0; round < CONFIG.MAX_TOOL_ROUNDS; round++) {
      const answer = await askGroq(messages);

      messages.push(answer);

      const calls = answer.tool_calls || [];

      if (!calls.length) {
        finalText = answer.content ||
          "لم أتمكن من صياغة نتيجة واضحة.";
        break;
      }

      for (const call of calls) {
        const action = call.function?.name;
        let args = {};

        try {
          args = JSON.parse(call.function?.arguments || "{}");
        } catch {
          args = {};
        }

        let result;

        try {
          result = await executeTool(
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
            error: error.message || "حدث خطأ غير معروف."
          };
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 8000)
        });
      }
    }

    if (!finalText) {
      const lastAnswer = await askGroq(messages);

      finalText = lastAnswer.content ||
        "وصلت إلى حد خطوات التنفيذ.";
    }

    sessions.set(sessionKey, [
      ...history,
      {
        role: "user",
        content: message.content.slice(0, 3000)
      },
      {
        role: "assistant",
        content: finalText.slice(0, 5000)
      }
    ].slice(-CONFIG.MAX_HISTORY));

    for (let i = 0; i < finalText.length; i += 1900) {
      await message.channel.send({
        content: finalText.slice(i, i + 1900)
      });
    }

  } catch (error) {
    console.error("[EM7 GROQ ERROR]", error);

    let text = "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.";

    if (error.name === "AbortError") {
      text = "انتهت مهلة الاتصال بـ Groq.";
    } else if (/401|invalid_api_key/i.test(error.message)) {
      text = "مفتاح Groq غير صحيح.";
    } else if (/429|rate limit/i.test(error.message)) {
      text = "وصلت إلى حد طلبات Groq. حاول لاحقاً.";
    } else {
      text += `\n${String(error.message).slice(0, 400)}`;
    }

    await message.channel.send(text);
  }
}

// =====================================================
// SLASH COMMAND
// =====================================================

const slashCommands = [
  new SlashCommandBuilder()
    .setName("em7")
    .setDescription("إنشاء مركز التحكم الخاص بـ EM7")
];

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(CONFIG.TOKEN);

  const body = slashCommands.map(command => command.toJSON());

  if (CONFIG.DEV_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(
        CONFIG.CLIENT_ID,
        CONFIG.DEV_GUILD_ID
      ),
      { body }
    );
  } else {
    await rest.put(
      Routes.applicationCommands(CONFIG.CLIENT_ID),
      { body }
    );
  }

  console.log("[EM7] Slash commands registered.");
}

// =====================================================
// BOT READY
// =====================================================

client.once(Events.ClientReady, async bot => {
  console.log("================================");
  console.log("EM7 ULTIMATE ONLINE");
  console.log(`BOT: ${bot.user.tag}`);
  console.log(`OWNER: ${CONFIG.OWNER_NAME}`);
  console.log(`OWNER ID: ${CONFIG.OWNER_ID}`);
  console.log(`MODEL: ${CONFIG.MODEL}`);
  console.log("================================");

  try {
    await registerCommands();
  } catch (error) {
    console.error("[EM7 COMMAND REGISTRATION]", error);
  }
});

// =====================================================
// INTERACTION HANDLER
// =====================================================

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!isOwner(interaction.user.id)) {
      if (interaction.isRepliable()) {
        return interaction.reply({
          content: "⛔ تم رفض الطلب. حسابك غير مصرح له باستخدام EM7.",
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }

      return;
    }

    // /em7
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === "em7"
    ) {
      const guild = interaction.guild;

      if (!guild) {
        return interaction.reply({
          content: "استخدم الأمر داخل السيرفر.",
          flags: MessageFlags.Ephemeral
        });
      }

      const botMember =
        guild.members.me ||
        await guild.members.fetch(client.user.id);

      if (
        !botMember.permissions.has(P.ManageChannels) &&
        !botMember.permissions.has(P.Administrator)
      ) {
        return interaction.reply({
          content: "البوت يحتاج Manage Channels لإنشاء روم الحماية.",
          flags: MessageFlags.Ephemeral
        });
      }

      const existing = guild.channels.cache.find(isProtection);

      if (existing) {
        return interaction.reply({
          content: `مركز EM7 موجود بالفعل: ${existing}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const room = await guild.channels.create({
        name: "🔐・em7-ultimate",
        type: ChannelType.GuildText,
        topic: CONFIG.PROTECTION_TOPIC,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [P.ViewChannel]
          },
          {
            id: CONFIG.OWNER_ID,
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
        reason: "EM7 ULTIMATE private control room"
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("EM7 ULTIMATE")
        .setDescription(
          "**مركز التحكم الإداري والبرمجي**\n\n" +
          "أمثلة على الأوامر:\n" +
          "• اعرض جميع رتب السيرفر\n" +
          "• أنشئ تصنيف باسم الإدارة\n" +
          "• أنشئ قناة داخل تصنيف الإدارة\n" +
          "• أنشئ رتبة باسم الدعم بلون أزرق\n" +
          "• عدّل صلاحيات رتبة المشرف\n" +
          "• امنع الزوار من رؤية قناة الإدارة\n" +
          "• اعرض أعضاء السيرفر\n\n" +
          "كل عملية تخضع للتحقق من الصلاحيات."
        )
        .setFooter({
          text: "EM7 ULTIMATE • Owner Only"
        });

      await room.send({ embeds: [embed] });

      return interaction.reply({
        content: `تم إنشاء مركز EM7: ${room}`,
        flags: MessageFlags.Ephemeral
      });
    }

    // Confirmation buttons
    if (interaction.isButton()) {
      const [type, id] = interaction.customId.split(":");

      if (!["em7_yes", "em7_no"].includes(type)) {
        return;
      }

      const item = pending.get(id);

      if (!item) {
        return interaction.reply({
          content: "انتهت صلاحية التأكيد أو تم استخدامه.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (item.userId !== interaction.user.id) {
        return interaction.reply({
          content: "غير مصرح لك بتأكيد العملية.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (
        item.guildId !== interaction.guildId ||
        item.channelId !== interaction.channelId
      ) {
        return interaction.reply({
          content: "مكان التأكيد غير صحيح.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (Date.now() > item.expires) {
        pending.delete(id);

        return interaction.update({
          content: "انتهت مهلة التأكيد. لم يتم التنفيذ.",
          embeds: [],
          components: []
        });
      }

      if (type === "em7_no") {
        pending.delete(id);

        return interaction.update({
          content: "تم إلغاء العملية.",
          embeds: [],
          components: []
        });
      }

      await interaction.deferUpdate();
      pending.delete(id);

      try {
        const guild = await client.guilds.fetch(item.guildId);
        const channel = await guild.channels.fetch(item.channelId);

        if (!channel || !isProtection(channel)) {
          throw new Error("تعذر العثور على روم الحماية.");
        }

        const result = await executeTool(
          item.action,
          item.args,
          {
            guild,
            channel,
            userId: interaction.user.id
          },
          true
        );

        await interaction.message.edit({
          content:
            "✅ **تم تنفيذ العملية:**\n```json\n" +
            JSON.stringify(result, null, 2).slice(0, 1200) +
            "\n```",
          embeds: [],
          components: []
        });

      } catch (error) {
        await interaction.message.edit({
          content: `❌ فشل التنفيذ: ${error.message}`,
          embeds: [],
          components: []
        });
      }
    }

  } catch (error) {
    console.error("[EM7 INTERACTION ERROR]", error);

    if (
      interaction.isRepliable() &&
      !interaction.replied &&
      !interaction.deferred
    ) {
      await interaction.reply({
        content: "حدث خطأ أثناء تنفيذ العملية.",
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

  if (!isOwner(message.author.id)) {
    if (isProtection(message.channel)) {
      await message.reply(
        "⛔ تم رفض الطلب. هذا النظام مخصص للمالك فقط."
      ).catch(() => {});
    }

    return;
  }

  if (!isProtection(message.channel)) return;
  if (!message.content.trim()) return;

  await handleAI(message);
});

// =====================================================
// CLEANUP
// =====================================================

setInterval(() => {
  const now = Date.now();

  for (const [id, item] of pending.entries()) {
    if (now > item.expires) {
      pending.delete(id);
    }
  }

  for (const [key, time] of cooldowns.entries()) {
    if (now - time > 60000) {
      cooldowns.delete(key);
    }
  }
}, 60000).unref();

// =====================================================
// ERROR HANDLING
// =====================================================

client.on(Events.Error, error => {
  console.error("[EM7 CLIENT ERROR]", error);
});

process.on("unhandledRejection", error => {
  console.error("[EM7 UNHANDLED REJECTION]", error);
});

process.on("uncaughtException", error => {
  console.error("[EM7 UNCAUGHT EXCEPTION]", error);
});

// =====================================================
// LOGIN
// =====================================================

client.login(CONFIG.TOKEN);
