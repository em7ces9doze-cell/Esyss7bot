
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");

// ==============================
// EM7 SYS - CONFIGURATION
// ==============================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
const DEV_GUILD_ID = process.env.DEV_GUILD_ID;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

const CHANNEL_NAME = "🔐・حماية";

if (!DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is missing");
}

if (!CLIENT_ID) {
  throw new Error("CLIENT_ID is missing");
}

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing");
}

// ==============================
// DISCORD CLIENT
// ==============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==============================
// GEMINI
// ==============================

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY
});

const sessions = new Map();
const cooldowns = new Map();

const SYSTEM_PROMPT = `
أنت EM7 AI، المساعد الذكي الرسمي لنظام EM7 SYS.

تخصصك:
- حماية سيرفرات Discord.
- إدارة الرتب والقنوات والصلاحيات.
- تحليل أخطاء البوتات وسجلاتها.
- المساعدة في تنظيم السيرفر.
- تقديم حلول تقنية دقيقة.

قواعد العمل:
1. تحدث بالعربية بوضوح واحترافية.
2. افهم طلب المستخدم قبل الإجابة.
3. لا تدّع تنفيذ عملية لم تنفذها فعلياً.
4. لا تخترع معلومات عن السيرفر.
5. لا تطلب كلمات المرور أو توكنات البوتات.
6. لا تنفذ أو تقترح إجراءات خطيرة دون موافقة.
7. في هذه النسخة أنت للمحادثة والتحليل فقط.
8. لا تدّع أنك تستطيع تعديل بوت آخر دون الوصول إلى ملفاته.
`;

// ==============================
// SLASH COMMAND
// ==============================

const commands = [
  new SlashCommandBuilder()
    .setName("em7")
    .setDescription("إنشاء مركز قيادة EM7 AI")
];

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(DISCORD_TOKEN);

  const route = DEV_GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, DEV_GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, {
    body: commands.map(command => command.toJSON())
  });

  console.log("EM7 slash commands registered");
}

// ==============================
// ADMIN CHECK
// ==============================

function canManage(member) {
  if (!member) return false;

  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

// ==============================
// CREATE PRIVATE SECURITY ROOM
// ==============================

async function createSecurityRoom(guild) {
  const existing = guild.channels.cache.find(
    channel =>
      channel.name === CHANNEL_NAME &&
      channel.type === ChannelType.GuildText
  );

  if (existing) {
    return {
      channel: existing,
      created: false
    };
  }

  const roles = await guild.roles.fetch();

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  // السماح للرتب الإدارية فقط
  for (const role of roles.values()) {
    if (role.id === guild.roles.everyone.id) continue;

    const isAdminRole =
      role.permissions.has(PermissionFlagsBits.Administrator) ||
      role.permissions.has(PermissionFlagsBits.ManageGuild);

    if (isAdminRole) {
      overwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }
  }

  // السماح لمالك السيرفر
  overwrites.push({
    id: guild.ownerId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory
    ]
  });

  const channel = await guild.channels.create({
    name: CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: "مركز قيادة EM7 AI - إدارة وحماية السيرفر",
    permissionOverwrites: overwrites
  });

  return {
    channel,
    created: true
  };
}

// ==============================
// INTERACTIONS
// ==============================

client.on("interactionCreate", async interaction => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "em7") return;

    if (!interaction.guild) {
      return interaction.reply({
        content: "هذا الأمر يعمل داخل السيرفر فقط.",
        ephemeral: true
      });
    }

    if (!canManage(interaction.member)) {
      return interaction.reply({
        content: "ليس لديك صلاحية استخدام هذا الأمر.",
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await createSecurityRoom(interaction.guild);

    await interaction.editReply({
      content: result.created
        ? `تم إنشاء مركز EM7 AI: ${result.channel}`
        : `مركز EM7 AI موجود بالفعل: ${result.channel}`
    });

  } catch (error) {
    console.error("EM7 COMMAND ERROR:", error);

    const response = {
      content: "حدث خطأ أثناء تنفيذ الأمر. راجع سجلات الاستضافة.",
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(response).catch(() => {});
    } else {
      await interaction.reply(response).catch(() => {});
    }
  }
});

// ==============================
// AI MESSAGE HANDLER
// ==============================

client.on("messageCreate", async message => {
  try {
    if (message.author.bot || !message.guild) return;

    if (message.channel.name !== CHANNEL_NAME) return;

    if (!canManage(message.member)) return;

    const prompt = message.content.trim();

    if (!prompt) return;

    if (prompt.length > 3000) {
      return message.reply("الرسالة طويلة جداً. اختصر طلبك.");
    }

    const now = Date.now();
    const lastUsed = cooldowns.get(message.author.id) || 0;

    if (now - lastUsed < 6000) {
      return message.reply("انتظر قليلاً قبل إرسال طلب آخر.");
    }

    cooldowns.set(message.author.id, now);

    await message.channel.sendTyping();

    const sessionKey =
      `${message.guild.id}:${message.author.id}`;

    let chat = sessions.get(sessionKey);

    if (!chat) {
      chat = ai.chats.create({
        model: GEMINI_MODEL,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.4,
          maxOutputTokens: 1500
        }
      });

      sessions.set(sessionKey, chat);
    }

    const result = await chat.sendMessage({
      message: prompt
    });

    const answer =
      result.text || "لم أتمكن من إنشاء رد.";

    for (let i = 0; i < answer.length; i += 1900) {
      await message.reply({
        content: answer.slice(i, i + 1900),
        allowedMentions: { parse: [] }
      });
    }

  } catch (error) {
    console.error("EM7 AI ERROR:", error);

    await message.reply(
      "تعذر الاتصال بالذكاء الاصطناعي. تحقق من إعدادات Gemini وسجلات الاستضافة."
    ).catch(() => {});
  }
});

// ==============================
// START BOT
// ==============================

client.once("ready", async () => {
  console.log(`EM7 SYS online as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (error) {
    console.error("COMMAND REGISTRATION ERROR:", error);
  }
});

client.on("error", error => {
  console.error("DISCORD CLIENT ERROR:", error);
});

process.on("unhandledRejection", error => {
  console.error("UNHANDLED REJECTION:", error);
});

client.login(DISCORD_TOKEN);
