
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

const crypto = require("crypto");

// ==============================
// EM7 SYS CONFIG
// ==============================

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const DEV_GUILD_ID = process.env.DEV_GUILD_ID || null;

if (!TOKEN || !CLIENT_ID || !GROQ_KEY) {
  console.error("EM7 ERROR: Missing environment variables.");
  process.exit(1);
}

const GROQ_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const PROTECTION_TOPIC = "EM7_PROTECTION_ROOM";

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
const confirmations = new Map();

// ==============================
// EM7 AI IDENTITY
// ==============================

const SYSTEM_PROMPT = `
أنت EM7 AI، المساعد الإداري والبرمجي لسيرفر Discord.

أنت لست مجرد روبوت محادثة.
لديك أدوات حقيقية للتعامل مع السيرفر.

قواعدك:

1. افهم اللغة العربية واللهجات العربية.
2. نفذ طلب المستخدم باستخدام الأدوات المتاحة.
3. لا تدّع تنفيذ شيء لم تنفذه الأداة فعلياً.
4. إذا طلب المستخدم عرض الرتب، استخدم أداة عرض الرتب.
5. إذا طلب إنشاء قناة، استخدم أداة إنشاء القناة.
6. لا تخترع أسماء أعضاء أو قنوات أو رتب.
7. إذا لم تعرف العضو أو القناة، اطلب توضيحاً.
8. لا تطلب توكنات أو مفاتيح API.
9. لا تنفذ JavaScript أو أوامر نظام أو أكواد عشوائية.
10. لا تتجاوز صلاحيات Discord.
11. لا تمنح Administrator لأي رتبة.
12. لا تنفذ عملية حساسة قبل التأكيد.
13. اشرح نتيجة التنفيذ بوضوح.
14. إذا فشل التنفيذ، اذكر السبب الحقيقي.
15. عند طلب كتابة كود، اكتب كوداً منظماً واحترافياً.

تحدث بالعربية الواضحة.
أنت EM7 AI.
`;

// ==============================
// TOOL DEFINITIONS
// ==============================

const tools = [
  {
    type: "function",
    function: {
      name: "server_info",
      description: "عرض معلومات السيرفر",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_roles",
      description: "عرض جميع رتب السيرفر",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_channels",
      description: "عرض قنوات السيرفر",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_channel",
      description: "إنشاء قناة نصية",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          topic: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_channel",
      description: "تعديل اسم قناة أو وصفها",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string" },
          name: { type: "string" },
          topic: { type: "string" }
        },
        required: ["channel"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_channel",
      description: "حذف قناة محددة",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string" }
        },
        required: ["channel"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_role",
      description: "إنشاء رتبة عادية بدون صلاحيات إدارية",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_members",
      description: "عرض بعض أعضاء السيرفر",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "timeout_member",
      description: "إيقاف عضو مؤقتاً بالدقائق",
      parameters: {
        type: "object",
        properties: {
          member: { type: "string" },
          minutes: { type: "integer" },
          reason: { type: "string" }
        },
        required: ["member", "minutes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "kick_member",
      description: "طرد عضو من السيرفر",
      parameters: {
        type: "object",
        properties: {
          member: { type: "string" },
          reason: { type: "string" }
        },
        required: ["member"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ban_member",
      description: "حظر عضو من السيرفر",
      parameters: {
        type: "object",
        properties: {
          member: { type: "string" },
          reason: { type: "string" }
        },
        required: ["member"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "purge_messages",
      description: "حذف عدد من الرسائل الحديثة",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "integer" }
        },
        required: ["amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_slowmode",
      description: "تغيير Slowmode للقناة الحالية",
      parameters: {
        type: "object",
        properties: {
          seconds: { type: "integer" }
        },
        required: ["seconds"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "lock_channel",
      description: "قفل أو فتح الكتابة في القناة الحالية",
      parameters: {
        type: "object",
        properties: {
          locked: { type: "boolean" }
        },
        required: ["locked"]
      }
    }
  }
];

// ==============================
// PERMISSIONS
// ==============================

const userPermissions = {
  server_info: P.ManageGuild,
  list_roles: P.ManageGuild,
  list_channels: P.ManageGuild,
  list_members: P.ManageGuild,
  create_channel: P.ManageChannels,
  edit_channel: P.ManageChannels,
  delete_channel: P.ManageChannels,
  create_role: P.ManageRoles,
  timeout_member: P.ModerateMembers,
  kick_member: P.KickMembers,
  ban_member: P.BanMembers,
  purge_messages: P.ManageMessages,
  set_slowmode: P.ManageChannels,
  lock_channel: P.ManageChannels
};

const botPermissions = {
  create_channel: P.ManageChannels,
  edit_channel: P.ManageChannels,
  delete_channel: P.ManageChannels,
  create_role: P.ManageRoles,
  timeout_member: P.ModerateMembers,
  kick_member: P.KickMembers,
  ban_member: P.BanMembers,
  purge_messages: P.ManageMessages,
  set_slowmode: P.ManageChannels,
  lock_channel: P.ManageChannels
};

const sensitiveActions = new Set([
  "delete_channel",
  "timeout_member",
  "kick_member",
  "ban_member",
  "purge_messages"
]);

// ==============================
// HELPERS
// ==============================

function clean(value, max = 100) {
  return String(value || "").trim().slice(0, max);
}

function isProtection(channel) {
  return channel?.topic === PROTECTION_TOPIC;
}

async function checkAccess(ctx, action) {
  if (!ctx.guild) {
    throw new Error("هذا الأمر يعمل داخل السيرفر فقط.");
  }

  if (!isProtection(ctx.channel)) {
    throw new Error("استخدم EM7 داخل روم الحماية.");
  }

  const member = await ctx.guild.members.fetch(ctx.userId);

  const botMember =
    ctx.guild.members.me ||
    await ctx.guild.members.fetch(client.user.id);

  const needed = userPermissions[action];

  if (
    needed &&
    !member.permissions.has(P.Administrator) &&
    !member.permissions.has(needed)
  ) {
    throw new Error("ليس لديك الصلاحية المطلوبة لتنفيذ هذا الطلب.");
  }

  const botNeeded = botPermissions[action];

  if (
    botNeeded &&
    !botMember.permissions.has(P.Administrator) &&
    !botMember.permissions.has(botNeeded)
  ) {
    throw new Error("البوت لا يملك الصلاحية المطلوبة.");
  }

  return { member, botMember };
}

async function findChannel(guild, value) {
  const id = String(value).match(/\d{17,20}/)?.[0];

  if (id) {
    return guild.channels.fetch(id).catch(() => null);
  }

  return guild.channels.cache.find(
    channel => channel.name === clean(value)
  ) || null;
}

async function findMember(guild, value) {
  const id = String(value).match(/\d{17,20}/)?.[0];

  if (id) {
    return guild.members.fetch(id).catch(() => null);
  }

  const name = clean(value).toLowerCase();

  const matches = guild.members.cache.filter(member =>
    member.user.username.toLowerCase() === name ||
    member.displayName.toLowerCase() === name
  );

  if (matches.size > 1) {
    throw new Error("يوجد أكثر من عضو بهذا الاسم. استخدم المنشن أو ID.");
  }

  return matches.first() || null;
}

function checkHierarchy(target, actor, botMember) {
  if (target.id === actor.id) {
    throw new Error("لا يمكنك تنفيذ هذا الإجراء على نفسك.");
  }

  if (target.id === target.guild.ownerId) {
    throw new Error("لا يمكن تنفيذ هذا الإجراء على مالك السيرفر.");
  }

  if (
    target.roles.highest.position >=
    botMember.roles.highest.position
  ) {
    throw new Error("رتبة العضو أعلى من رتبة البوت أو مساوية لها.");
  }

  if (
    actor.id !== target.guild.ownerId &&
    target.roles.highest.position >=
    actor.roles.highest.position
  ) {
    throw new Error("رتبة العضو أعلى من رتبتك أو مساوية لها.");
  }
}

// ==============================
// CONFIRMATION SYSTEM
// ==============================

async function askConfirmation(ctx, action, args) {
  const id = crypto.randomBytes(8).toString("hex");

  confirmations.set(id, {
    action,
    args,
    guildId: ctx.guild.id,
    channelId: ctx.channel.id,
    userId: ctx.userId,
    expires: Date.now() + 60000
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`em7_confirm:${id}`)
      .setLabel("تأكيد التنفيذ")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId(`em7_cancel:${id}`)
      .setLabel("إلغاء")
      .setStyle(ButtonStyle.Secondary)
  );

  await ctx.channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xD97706)
        .setTitle("EM7 — تأكيد عملية إدارية")
        .setDescription(
          `العملية المطلوبة: **${action}**\n\n` +
          "لم يتم تنفيذ العملية حتى الآن.\n" +
          "اضغط تأكيد إذا كنت متأكداً."
        )
        .setTimestamp()
    ],
    components: [row]
  });

  return {
    success: true,
    awaiting_confirmation: true
  };
}

// ==============================
// ACTION EXECUTOR
// ==============================

async function execute(action, args, ctx, confirmed = false) {
  const { member, botMember } =
    await checkAccess(ctx, action);

  if (sensitiveActions.has(action) && !confirmed) {
    return askConfirmation(ctx, action, args);
  }

  const guild = ctx.guild;

  switch (action) {

    case "server_info": {
      return {
        name: guild.name,
        id: guild.id,
        members: guild.memberCount,
        channels: guild.channels.cache.size,
        roles: guild.roles.cache.size,
        owner: guild.ownerId
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
          managed: role.managed
        }))
        .slice(0, 80);
    }

    case "list_channels": {
      return guild.channels.cache.map(channel => ({
        name: channel.name,
        id: channel.id,
        type: channel.type,
        category: channel.parent?.name || null
      })).slice(0, 100);
    }

    case "list_members": {
      await guild.members.fetch();

      return guild.members.cache
        .filter(m => !m.user.bot)
        .map(m => ({
          username: m.user.username,
          nickname: m.displayName,
          id: m.id
        }))
        .slice(0, 50);
    }

    case "create_channel": {
      const name = clean(args.name)
        .toLowerCase()
        .replace(/\s+/g, "-");

      if (!/^[\p{L}\p{N}_-]+$/u.test(name)) {
        throw new Error("اسم القناة غير صالح.");
      }

      if (guild.channels.cache.some(c => c.name === name)) {
        throw new Error("توجد قناة بهذا الاسم بالفعل.");
      }

      const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        topic: clean(args.topic, 900) || null,
        reason: "Created by EM7 AI"
      });

      return {
        success: true,
        name: channel.name,
        id: channel.id
      };
    }

    case "edit_channel": {
      const channel = await findChannel(guild, args.channel);

      if (!channel || !channel.isTextBased()) {
        throw new Error("لم أجد القناة النصية المطلوبة.");
      }

      if (isProtection(channel)) {
        throw new Error("لا يمكن تعديل روم الحماية بهذه الأداة.");
      }

      const changes = {};

      if (args.name) {
        changes.name = clean(args.name)
          .toLowerCase()
          .replace(/\s+/g, "-");
      }

      if (typeof args.topic === "string") {
        changes.topic = clean(args.topic, 900);
      }

      if (!Object.keys(changes).length) {
        throw new Error("حدد التعديل المطلوب.");
      }

      await channel.edit(changes);

      return { success: true, changes };
    }

    case "delete_channel": {
      const channel = await findChannel(guild, args.channel);

      if (!channel) {
        throw new Error("لم أجد القناة.");
      }

      if (isProtection(channel)) {
        throw new Error("حذف روم الحماية ممنوع.");
      }

      const name = channel.name;

      await channel.delete("Deleted by EM7 AI");

      return { success: true, deleted: name };
    }

    case "create_role": {
      const name = clean(args.name);

      if (!name) {
        throw new Error("اسم الرتبة مطلوب.");
      }

      if (guild.roles.cache.some(r => r.name === name)) {
        throw new Error("هذه الرتبة موجودة بالفعل.");
      }

      const color = args.color || "#5865F2";

      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        throw new Error("صيغة اللون غير صحيحة.");
      }

      const role = await guild.roles.create({
        name,
        color,
        permissions: [],
        reason: "Created by EM7 AI"
      });

      return {
        success: true,
        role: role.name,
        id: role.id
      };
    }

    case "timeout_member":
    case "kick_member":
    case "ban_member": {
      const target = await findMember(guild, args.member);

      if (!target) {
        throw new Error("لم أجد العضو المطلوب.");
      }

      checkHierarchy(target, member, botMember);

      const reason = clean(args.reason || "EM7 moderation");

      if (action === "timeout_member") {
        const minutes = Number(args.minutes);

        if (
          !Number.isInteger(minutes) ||
          minutes < 1 ||
          minutes > 40320
        ) {
          throw new Error("المدة يجب أن تكون بين دقيقة و28 يوماً.");
        }

        await target.timeout(minutes * 60000, reason);

        return {
          success: true,
          member: target.user.tag,
          minutes
        };
      }

      if (action === "kick_member") {
        const username = target.user.tag;
        await target.kick(reason);

        return { success: true, kicked: username };
      }

      if (action === "ban_member") {
        const username = target.user.tag;
        await target.ban({ reason });

        return { success: true, banned: username };
      }
    }

    case "purge_messages": {
      const amount = Number(args.amount);

      if (
        !Number.isInteger(amount) ||
        amount < 2 ||
        amount > 100
      ) {
        throw new Error("حدد عدداً بين 2 و100.");
      }

      if (
        !ctx.channel.isTextBased() ||
        !("bulkDelete" in ctx.channel)
      ) {
        throw new Error("القناة لا تدعم حذف الرسائل بهذه الطريقة.");
      }

      const deleted = await ctx.channel.bulkDelete(amount, true);

      return {
        success: true,
        deleted: deleted.size,
        note: "رسائل Discord الأقدم من 14 يوماً لا تحذف بهذه الطريقة."
      };
    }

    case "set_slowmode": {
      const seconds = Number(args.seconds);

      if (
        !Number.isInteger(seconds) ||
        seconds < 0 ||
        seconds > 21600
      ) {
        throw new Error("القيمة يجب أن تكون من 0 إلى 21600 ثانية.");
      }

      if (!("setRateLimitPerUser" in ctx.channel)) {
        throw new Error("القناة لا تدعم Slowmode.");
      }

      await ctx.channel.setRateLimitPerUser(seconds);

      return { success: true, seconds };
    }

    case "lock_channel": {
      if (!("permissionOverwrites" in ctx.channel)) {
        throw new Error("لا يمكن قفل هذه القناة.");
      }

      await ctx.channel.permissionOverwrites.edit(
        guild.roles.everyone,
        {
          SendMessages: args.locked ? false : null
        }
      );

      return {
        success: true,
        locked: Boolean(args.locked)
      };
    }

    default:
      throw new Error("الأداة غير معروفة.");
  }
}

// ==============================
// GROQ CONNECTION
// ==============================

async function askGroq(messages) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    45000
  );

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: false,
        temperature: 0.2,
        max_completion_tokens: 1800
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message || `Groq error ${response.status}`
      );
    }

    return data.choices?.[0]?.message;

  } finally {
    clearTimeout(timer);
  }
}

// ==============================
// AI MESSAGE HANDLER
// ==============================

async function handleAI(message) {
  const key = `${message.guild.id}:${message.author.id}`;

  const last = cooldowns.get(key) || 0;

  if (Date.now() - last < 4500) {
    await message.reply("انتظر قليلاً قبل الطلب التالي.");
    return;
  }

  cooldowns.set(key, Date.now());

  const history = (sessions.get(key) || []).slice(-10);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    {
      role: "user",
      content: message.content.slice(0, 1800)
    }
  ];

  await message.channel.sendTyping();

  try {
    let finalText = "";

    for (let round = 0; round < 5; round++) {
      const answer = await askGroq(messages);

      if (!answer) {
        throw new Error("Groq returned empty response.");
      }

      messages.push(answer);

      if (!answer.tool_calls?.length) {
        finalText = answer.content || "لم يصلني رد واضح.";
        break;
      }

      for (const call of answer.tool_calls) {
        const action = call.function.name;

        let args = {};

        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }

        let result;

        try {
          result = await execute(action, args, {
            guild: message.guild,
            channel: message.channel,
            userId: message.author.id
          });
        } catch (error) {
          result = {
            success: false,
            error: error.message
          };
        }

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 6000)
        });
      }
    }

    if (!finalText) {
      const lastAnswer = await askGroq(messages);
      finalText = lastAnswer?.content || "توقفت العملية بعد عدة خطوات.";
    }

    sessions.set(key, [
      ...history,
      { role: "user", content: message.content.slice(0, 1800) },
      { role: "assistant", content: finalText }
    ].slice(-12));

    for (let i = 0; i < finalText.length; i += 1900) {
      await message.channel.send({
        content: finalText.slice(i, i + 1900)
      });
    }

  } catch (error) {
    console.error("[EM7 AI]", error);

    let response = "حدث خطأ أثناء معالجة طلبك.";

    if (error.name === "AbortError") {
      response = "انتهت مهلة الاتصال بالذكاء الاصطناعي.";
    } else if (/401|invalid_api_key/i.test(error.message)) {
      response = "مفتاح Groq غير صحيح. راجع إعدادات FadeHost.";
    } else if (/429|rate limit/i.test(error.message)) {
      response = "وصلت إلى حد طلبات Groq. حاول لاحقاً.";
    }

    await message.channel.send(response);
  }
}

// ==============================
// SLASH COMMAND
// ==============================

const commands = [
  new SlashCommandBuilder()
    .setName("em7")
    .setDescription("إنشاء مركز حماية EM7")
];

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  const body = commands.map(command => command.toJSON());

  if (DEV_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID),
      { body }
    );
  } else {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body }
    );
  }
}

// ==============================
// BOT READY
// ==============================

client.once(Events.ClientReady, async bot => {
  console.log(`EM7 SYS ONLINE: ${bot.user.tag}`);

  try {
    await registerCommands();
    console.log("EM7 commands registered.");
  } catch (error) {
    console.error("Command registration error:", error);
  }
});

// ==============================
// INTERACTIONS
// ==============================

client.on(Events.InteractionCreate, async interaction => {
  try {

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

      const member = await guild.members.fetch(interaction.user.id);

      if (
        !member.permissions.has(P.ManageGuild) &&
        !member.permissions.has(P.Administrator)
      ) {
        return interaction.reply({
          content: "تحتاج Manage Server لإنشاء روم الحماية.",
          flags: MessageFlags.Ephemeral
        });
      }

      const existing = guild.channels.cache.find(isProtection);

      if (existing) {
        return interaction.reply({
          content: `روم الحماية موجود: ${existing}`,
          flags: MessageFlags.Ephemeral
        });
      }

      const botMember = guild.members.me;

      if (
        !botMember.permissions.has(P.ManageChannels) &&
        !botMember.permissions.has(P.Administrator)
      ) {
        return interaction.reply({
          content: "البوت يحتاج Manage Channels.",
          flags: MessageFlags.Ephemeral
        });
      }

      const overwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [P.ViewChannel]
        },
        {
          id: interaction.user.id,
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
      ];

      const adminRoles = guild.roles.cache.filter(role =>
        role.id !== guild.id &&
        (
          role.permissions.has(P.Administrator) ||
          role.permissions.has(P.ManageGuild)
        )
      );

      for (const role of adminRoles.values()) {
        overwrites.push({
          id: role.id,
          allow: [
            P.ViewChannel,
            P.SendMessages,
            P.ReadMessageHistory
          ]
        });
      }

      const room = await guild.channels.create({
        name: "🔐・حماية",
        type: ChannelType.GuildText,
        topic: PROTECTION_TOPIC,
        permissionOverwrites: overwrites
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("EM7 AI — مركز الإدارة")
        .setDescription(
          "مرحباً بك في مركز EM7.\n\n" +
          "أمثلة على الأوامر:\n" +
          "• اعرض رتب السيرفر\n" +
          "• اعرض قنوات السيرفر\n" +
          "• أنشئ قناة باسم الأخبار\n" +
          "• اقفل هذه القناة\n" +
          "• اعرض معلومات السيرفر\n" +
          "• نظّف 10 رسائل\n\n" +
          "العمليات الحساسة تتطلب تأكيداً."
        );

      await room.send({ embeds: [embed] });

      return interaction.reply({
        content: `تم إنشاء مركز الحماية: ${room}`,
        flags: MessageFlags.Ephemeral
      });
    }

    // CONFIRMATION BUTTONS

    if (interaction.isButton()) {
      const [type, id] = interaction.customId.split(":");

      if (!["em7_confirm", "em7_cancel"].includes(type)) {
        return;
      }

      const pending = confirmations.get(id);

      if (!pending) {
        return interaction.reply({
          content: "انتهت صلاحية العملية.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (pending.userId !== interaction.user.id) {
        return interaction.reply({
          content: "فقط صاحب الطلب يستطيع تأكيد العملية.",
          flags: MessageFlags.Ephemeral
        });
      }

      if (Date.now() > pending.expires) {
        confirmations.delete(id);

        return interaction.update({
          content: "انتهت مهلة التأكيد. لم يتم التنفيذ.",
          embeds: [],
          components: []
        });
      }

      if (type === "em7_cancel") {
        confirmations.delete(id);

        return interaction.update({
          content: "تم إلغاء العملية.",
          embeds: [],
          components: []
        });
      }

      await interaction.deferUpdate();

      confirmations.delete(id);

      const guild = await client.guilds.fetch(pending.guildId);
      const channel = await guild.channels.fetch(pending.channelId);

      try {
        const result = await execute(
          pending.action,
          pending.args,
          {
            guild,
            channel,
            userId: interaction.user.id
          },
          true
        );

        await interaction.message.edit({
          content:
            "تم تنفيذ العملية بنجاح:\n```json\n" +
            JSON.stringify(result, null, 2).slice(0, 1300) +
            "\n```",
          embeds: [],
          components: []
        });

      } catch (error) {
        await interaction.message.edit({
          content: `فشل التنفيذ: ${error.message}`,
          embeds: [],
          components: []
        });
      }
    }

  } catch (error) {
    console.error("[EM7 Interaction]", error);

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

// ==============================
// MESSAGE LISTENER
// ==============================

client.on(Events.MessageCreate, async message => {
  if (!message.guild || message.author.bot) return;

  if (!isProtection(message.channel)) return;

  if (!message.content.trim()) return;

  const member = await message.guild.members
    .fetch(message.author.id)
    .catch(() => null);

  if (!member) return;

  if (
    !member.permissions.has(P.ManageGuild) &&
    !member.permissions.has(P.Administrator)
  ) {
    return message.reply(
      "هذا النظام مخصص للإداريين. تحتاج Manage Server."
    );
  }

  await handleAI(message);
});

// ==============================
// ERROR HANDLING
// ==============================

client.on(Events.Error, error => {
  console.error("[EM7 CLIENT ERROR]", error);
});

process.on("unhandledRejection", error => {
  console.error("[EM7 UNHANDLED]", error);
});

client.login(TOKEN);
