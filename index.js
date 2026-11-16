require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  PermissionsBitField,
  AuditLogEvent
} = require('discord.js');
const Groq = require('groq-sdk');
const crypto = require('crypto');

// ====================== CONFIG ======================
const OWNER_ID = '1354814086021644320';
const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOOL_ITERATIONS = 7;
const MAX_MEMORY_MESSAGES = 18;
const APPROVAL_TTL_MS = 5 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 2500;

if (!process.env.DISCORD_TOKEN || !process.env.GROQ_API_KEY) {
  console.error('Missing DISCORD_TOKEN or GROQ_API_KEY');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ====================== STATE ======================
const conversationMemory = new Map(); // owner only
const pendingApprovals = new Map();   // approvalId -> data
const processingLocks = new Set();    // guildId
const lastRequestAt = new Map();      // userId -> timestamp

// ====================== HELPERS ======================
function isOwner(userId) {
  return String(userId) === OWNER_ID;
}

function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

async function audit(guild, action, details, result, executorId = OWNER_ID) {
  const entry = {
    ts: new Date().toISOString(),
    guildId: guild?.id || 'DM',
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details).slice(0, 800),
    result: result?.success ? 'SUCCESS' : 'FAIL',
    message: result?.message || '',
    executor: executorId
  };
  console.log('[AUDIT]', JSON.stringify(entry));

  if (process.env.LOG_CHANNEL_ID && guild) {
    try {
      const ch = await guild.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
      if (ch?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle(`Audit: ${action}`)
          .setColor(result?.success ? 0x00c853 : 0xd50000)
          .addFields(
            { name: 'النتيجة', value: entry.result, inline: true },
            { name: 'التفاصيل', value: entry.details.slice(0, 1000) || '-' }
          )
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (_) {}
  }
}

async function getBotMember(guild) {
  return guild.members.me || await guild.members.fetchMe();
}

function canManageRole(botMember, targetRole) {
  if (!targetRole || targetRole.managed) return false;
  return botMember.roles.highest.position > targetRole.position;
}

function canManageMember(botMember, targetMember) {
  if (!targetMember || targetMember.id === botMember.id) return false;
  if (targetMember.id === targetMember.guild.ownerId) return false;
  return botMember.roles.highest.position > targetMember.roles.highest.position;
}

function stripAdministrator(permissions) {
  if (!permissions) return new PermissionsBitField(0n);
  const perms = new PermissionsBitField(permissions);
  perms.remove(PermissionFlagsBits.Administrator);
  return perms;
}

function rateLimitOk(userId) {
  const now = Date.now();
  const last = lastRequestAt.get(userId) || 0;
  if (now - last < MIN_REQUEST_INTERVAL_MS) return false;
  lastRequestAt.set(userId, now);
  return true;
}

function getMemory() {
  if (!conversationMemory.has(OWNER_ID)) {
    conversationMemory.set(OWNER_ID, []);
  }
  return conversationMemory.get(OWNER_ID);
}

function pushMemory(role, content) {
  const mem = getMemory();
  mem.push({ role, content: String(content).slice(0, 4000) });
  while (mem.length > MAX_MEMORY_MESSAGES) mem.shift();
}

// ====================== TOOL DEFINITIONS (Groq format) ======================
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_server_info',
      description: 'الحصول على معلومات السيرفر الأساسية (الاسم، عدد الأعضاء، المالك، إلخ)',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_channels',
      description: 'قائمة القنوات والتصنيفات في السيرفر',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['all', 'text', 'voice', 'category'], description: 'نوع القنوات' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_roles',
      description: 'قائمة الرتب مع مواضعها وصلاحياتها الأساسية',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: 'إنشاء تصنيف (Category) جديد',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'اسم التصنيف' },
          position: { type: 'number', description: 'الموضع (اختياري)' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_text_channel',
      description: 'إنشاء قناة نصية',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string', description: 'معرف التصنيف (اختياري)' },
          topic: { type: 'string' },
          nsfw: { type: 'boolean' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_voice_channel',
      description: 'إنشاء قناة صوتية',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string' },
          userLimit: { type: 'number' },
          bitrate: { type: 'number' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_channel',
      description: 'حذف قناة أو تصنيف (عملية حساسة تحتاج موافقة)',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string', description: 'معرف القناة' },
          reason: { type: 'string' }
        },
        required: ['channelId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_channel',
      description: 'تعديل اسم أو موضوع أو تصنيف قناة',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          name: { type: 'string' },
          topic: { type: 'string' },
          parentId: { type: 'string' },
          position: { type: 'number' }
        },
        required: ['channelId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_role',
      description: 'إنشاء رتبة جديدة (لا يُمنح Administrator تلقائياً أبداً)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          color: { type: 'string', description: 'hex مثل #ff0000' },
          hoist: { type: 'boolean' },
          mentionable: { type: 'boolean' },
          permissions: { type: 'array', items: { type: 'string' }, description: 'أسماء الصلاحيات بدون Administrator' }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_role',
      description: 'حذف رتبة (حساسة - تحتاج موافقة)',
      parameters: {
        type: 'object',
        properties: {
          roleId: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['roleId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_role',
      description: 'تعديل رتبة موجودة',
      parameters: {
        type: 'object',
        properties: {
          roleId: { type: 'string' },
          name: { type: 'string' },
          color: { type: 'string' },
          hoist: { type: 'boolean' },
          mentionable: { type: 'boolean' },
          permissions: { type: 'array', items: { type: 'string' } }
        },
        required: ['roleId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'assign_role',
      description: 'إعطاء رتبة لعضو',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          roleId: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['userId', 'roleId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'remove_role',
      description: 'سحب رتبة من عضو',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          roleId: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['userId', 'roleId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'kick_member',
      description: 'طرد عضو (حساسة - تحتاج موافقة)',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['userId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'ban_member',
      description: 'حظر عضو (حساسة - تحتاج موافقة)',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          reason: { type: 'string' },
          deleteMessageDays: { type: 'number', description: '0-7' }
        },
        required: ['userId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'unban_member',
      description: 'فك حظر عضو',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['userId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'timeout_member',
      description: 'إعطاء Timeout لعضو (حساسة إذا طويلة)',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          durationMinutes: { type: 'number', description: 'بالدقائق، أقصى 40320' },
          reason: { type: 'string' }
        },
        required: ['userId', 'durationMinutes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_nickname',
      description: 'تغيير لقب عضو',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          nickname: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['userId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'إرسال رسالة في قناة محددة',
      parameters: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['channelId', 'content']
      }
    }
  }
];

const SENSITIVE_TOOLS = new Set([
  'delete_channel', 'delete_role', 'kick_member', 'ban_member', 'timeout_member'
]);

// ====================== TOOL HANDLERS ======================
const toolHandlers = {
  async get_server_info(args, ctx) {
    const g = ctx.guild;
    return {
      success: true,
      message: `السيرفر: ${g.name}\nالمعرف: ${g.id}\nالمالك: ${g.ownerId}\nالأعضاء: ${g.memberCount}\nالقنوات: ${g.channels.cache.size}\nالرتب: ${g.roles.cache.size}`
    };
  },

  async list_channels(args, ctx) {
    const typeFilter = args.type || 'all';
    const channels = ctx.guild.channels.cache
      .filter(c => {
        if (typeFilter === 'text') return c.type === ChannelType.GuildText;
        if (typeFilter === 'voice') return c.type === ChannelType.GuildVoice;
        if (typeFilter === 'category') return c.type === ChannelType.GuildCategory;
        return true;
      })
      .sort((a, b) => a.position - b.position)
      .map(c => `${c.type === ChannelType.GuildCategory ? '📁' : c.isTextBased() ? '#' : '🔊'} ${c.name} (${c.id})`)
      .slice(0, 40);
    return { success: true, message: channels.length ? channels.join('\n') : 'لا توجد قنوات مطابقة' };
  },

  async list_roles(args, ctx) {
    const roles = ctx.guild.roles.cache
      .sort((a, b) => b.position - a.position)
      .map(r => `${r.name} | pos:${r.position} | id:${r.id} | color:${r.hexColor}`)
      .slice(0, 40);
    return { success: true, message: roles.join('\n') };
  },

  async create_category(args, ctx) {
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { success: false, message: 'البوت لا يملك صلاحية Manage Channels' };
    }
    const cat = await ctx.guild.channels.create({
      name: args.name.slice(0, 100),
      type: ChannelType.GuildCategory,
      position: args.position
    });
    await audit(ctx.guild, 'create_category', { name: args.name, id: cat.id }, { success: true });
    return { success: true, message: `تم إنشاء التصنيف: ${cat.name} (${cat.id})` };
  },

  async create_text_channel(args, ctx) {
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { success: false, message: 'البوت لا يملك صلاحية Manage Channels' };
    }
    const options = {
      name: args.name.slice(0, 100),
      type: ChannelType.GuildText,
      topic: args.topic?.slice(0, 1024),
      nsfw: !!args.nsfw
    };
    if (args.parentId) options.parent = args.parentId;
    const ch = await ctx.guild.channels.create(options);
    await audit(ctx.guild, 'create_text_channel', { name: args.name, id: ch.id }, { success: true });
    return { success: true, message: `تم إنشاء القناة النصية: #${ch.name} (${ch.id})` };
  },

  async create_voice_channel(args, ctx) {
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { success: false, message: 'البوت لا يملك صلاحية Manage Channels' };
    }
    const options = {
      name: args.name.slice(0, 100),
      type: ChannelType.GuildVoice,
      userLimit: args.userLimit || 0,
      bitrate: args.bitrate || 64000
    };
    if (args.parentId) options.parent = args.parentId;
    const ch = await ctx.guild.channels.create(options);
    await audit(ctx.guild, 'create_voice_channel', { name: args.name, id: ch.id }, { success: true });
    return { success: true, message: `تم إنشاء القناة الصوتية: ${ch.name} (${ch.id})` };
  },

  async delete_channel(args, ctx) {
    // sensitive - handled by approval system
    const ch = await ctx.guild.channels.fetch(args.channelId).catch(() => null);
    if (!ch) return { success: false, message: 'القناة غير موجودة' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { success: false, message: 'البوت لا يملك Manage Channels' };
    }
    await ch.delete(args.reason || 'EM7 AI');
    await audit(ctx.guild, 'delete_channel', { channelId: args.channelId, name: ch.name }, { success: true });
    return { success: true, message: `تم حذف القناة: ${ch.name}` };
  },

  async edit_channel(args, ctx) {
    const ch = await ctx.guild.channels.fetch(args.channelId).catch(() => null);
    if (!ch) return { success: false, message: 'القناة غير موجودة' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { success: false, message: 'البوت لا يملك Manage Channels' };
    }
    const data = {};
    if (args.name) data.name = args.name.slice(0, 100);
    if (args.topic !== undefined) data.topic = args.topic?.slice(0, 1024) || null;
    if (args.parentId) data.parent = args.parentId;
    if (args.position !== undefined) data.position = args.position;
    await ch.edit(data);
    await audit(ctx.guild, 'edit_channel', { channelId: args.channelId, changes: data }, { success: true });
    return { success: true, message: `تم تعديل القناة ${ch.name}` };
  },

  async create_role(args, ctx) {
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return { success: false, message: 'البوت لا يملك Manage Roles' };
    }
    let perms = new PermissionsBitField(0n);
    if (Array.isArray(args.permissions)) {
      for (const p of args.permissions) {
        if (PermissionFlagsBits[p] && p !== 'Administrator') {
          perms.add(PermissionFlagsBits[p]);
        }
      }
    }
    perms = stripAdministrator(perms);
    const role = await ctx.guild.roles.create({
      name: args.name.slice(0, 100),
      colors: args.color ? [args.color] : undefined,
      hoist: !!args.hoist,
      mentionable: !!args.mentionable,
      permissions: perms,
      reason: 'EM7 AI'
    });
    await audit(ctx.guild, 'create_role', { name: role.name, id: role.id }, { success: true });
    return { success: true, message: `تم إنشاء الرتبة: ${role.name} (${role.id})` };
  },

  async delete_role(args, ctx) {
    const role = await ctx.guild.roles.fetch(args.roleId).catch(() => null);
    if (!role) return { success: false, message: 'الرتبة غير موجودة' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles) || !canManageRole(bot, role)) {
      return { success: false, message: 'لا يمكن إدارة هذه الرتبة (هرمية أو صلاحيات)' };
    }
    await role.delete(args.reason || 'EM7 AI');
    await audit(ctx.guild, 'delete_role', { roleId: args.roleId, name: role.name }, { success: true });
    return { success: true, message: `تم حذف الرتبة: ${role.name}` };
  },

  async edit_role(args, ctx) {
    const role = await ctx.guild.roles.fetch(args.roleId).catch(() => null);
    if (!role) return { success: false, message: 'الرتبة غير موجودة' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles) || !canManageRole(bot, role)) {
      return { success: false, message: 'لا يمكن إدارة هذه الرتبة' };
    }
    const data = {};
    if (args.name) data.name = args.name.slice(0, 100);
    if (args.color) data.colors = [args.color];
    if (args.hoist !== undefined) data.hoist = !!args.hoist;
    if (args.mentionable !== undefined) data.mentionable = !!args.mentionable;
    if (Array.isArray(args.permissions)) {
      let perms = new PermissionsBitField(0n);
      for (const p of args.permissions) {
        if (PermissionFlagsBits[p] && p !== 'Administrator') perms.add(PermissionFlagsBits[p]);
      }
      data.permissions = stripAdministrator(perms);
    }
    await role.edit(data);
    await audit(ctx.guild, 'edit_role', { roleId: args.roleId, changes: Object.keys(data) }, { success: true });
    return { success: true, message: `تم تعديل الرتبة ${role.name}` };
  },

  async assign_role(args, ctx) {
    const member = await ctx.guild.members.fetch(args.userId).catch(() => null);
    const role = await ctx.guild.roles.fetch(args.roleId).catch(() => null);
    if (!member || !role) return { success: false, message: 'العضو أو الرتبة غير موجودين' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles) || !canManageRole(bot, role) || !canManageMember(bot, member)) {
      return { success: false, message: 'فشل فحص الهرمية أو الصلاحيات' };
    }
    await member.roles.add(role, args.reason || 'EM7 AI');
    await audit(ctx.guild, 'assign_role', { userId: args.userId, roleId: args.roleId }, { success: true });
    return { success: true, message: `تم إعطاء رتبة ${role.name} للعضو ${member.user.tag}` };
  },

  async remove_role(args, ctx) {
    const member = await ctx.guild.members.fetch(args.userId).catch(() => null);
    const role = await ctx.guild.roles.fetch(args.roleId).catch(() => null);
    if (!member || !role) return { success: false, message: 'العضو أو الرتبة غير موجودين' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageRoles) || !canManageRole(bot, role) || !canManageMember(bot, member)) {
      return { success: false, message: 'فشل فحص الهرمية أو الصلاحيات' };
    }
    await member.roles.remove(role, args.reason || 'EM7 AI');
    await audit(ctx.guild, 'remove_role', { userId: args.userId, roleId: args.roleId }, { success: true });
    return { success: true, message: `تم سحب رتبة ${role.name} من ${member.user.tag}` };
  },

  async kick_member(args, ctx) {
    const member = await ctx.guild.members.fetch(args.userId).catch(() => null);
    if (!member) return { success: false, message: 'العضو غير موجود' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.KickMembers) || !canManageMember(bot, member)) {
      return { success: false, message: 'لا يمكن طرد هذا العضو' };
    }
    await member.kick(args.reason || 'EM7 AI');
    await audit(ctx.guild, 'kick_member', { userId: args.userId }, { success: true });
    return { success: true, message: `تم طرد ${member.user.tag}` };
  },

  async ban_member(args, ctx) {
    const member = await ctx.guild.members.fetch(args.userId).catch(() => null);
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.BanMembers)) {
      return { success: false, message: 'البوت لا يملك Ban Members' };
    }
    if (member && !canManageMember(bot, member)) {
      return { success: false, message: 'لا يمكن حظر هذا العضو (هرمية)' };
    }
    await ctx.guild.members.ban(args.userId, {
      reason: args.reason || 'EM7 AI',
      deleteMessageSeconds: Math.min(Math.max((args.deleteMessageDays || 0) * 86400, 0), 604800)
    });
    await audit(ctx.guild, 'ban_member', { userId: args.userId }, { success: true });
    return { success: true, message: `تم حظر المستخدم ${args.userId}` };
  },

  async unban_member(args, ctx) {
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.BanMembers)) {
      return { success: false, message: 'البوت لا يملك Ban Members' };
    }
    await ctx.guild.members.unban(args.userId, args.reason || 'EM7 AI');
    await audit(ctx.guild, 'unban_member', { userId: args.userId }, { success: true });
    return { success: true, message: `تم فك حظر ${args.userId}` };
  },

  async timeout_member(args, ctx) {
    const member = await ctx.guild.members.fetch(args.userId).catch(() => null);
    if (!member) return { success: false, message: 'العضو غير موجود' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ModerateMembers) || !canManageMember(bot, member)) {
      return { success: false, message: 'لا يمكن إعطاء Timeout لهذا العضو' };
    }
    const ms = Math.min(Math.max(args.durationMinutes * 60 * 1000, 0), 28 * 24 * 60 * 60 * 1000);
    await member.timeout(ms, args.reason || 'EM7 AI');
    await audit(ctx.guild, 'timeout_member', { userId: args.userId, minutes: args.durationMinutes }, { success: true });
    return { success: true, message: `تم إعطاء Timeout لمدة ${args.durationMinutes} دقيقة لـ ${member.user.tag}` };
  },

  async set_nickname(args, ctx) {
    const member = await ctx.guild.members.fetch(args.userId).catch(() => null);
    if (!member) return { success: false, message: 'العضو غير موجود' };
    const bot = await getBotMember(ctx.guild);
    if (!bot.permissions.has(PermissionFlagsBits.ManageNicknames) || !canManageMember(bot, member)) {
      return { success: false, message: 'لا يمكن تغيير لقب هذا العضو' };
    }
    await member.setNickname(args.nickname?.slice(0, 32) || null, args.reason || 'EM7 AI');
    await audit(ctx.guild, 'set_nickname', { userId: args.userId, nick: args.nickname }, { success: true });
    return { success: true, message: `تم تغيير اللقب` };
  },

  async send_message(args, ctx) {
    const ch = await ctx.guild.channels.fetch(args.channelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return { success: false, message: 'قناة نصية غير صالحة' };
    const bot = await getBotMember(ctx.guild);
    if (!ch.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages)) {
      return { success: false, message: 'البوت لا يستطيع الإرسال في هذه القناة' };
    }
    await ch.send({ content: args.content.slice(0, 2000) });
    return { success: true, message: 'تم إرسال الرسالة' };
  }
};

// ====================== APPROVAL SYSTEM ======================
async function requestApproval(toolName, args, ctx, originalMessage) {
  const approvalId = generateId();
  const expires = Date.now() + APPROVAL_TTL_MS;

  pendingApprovals.set(approvalId, {
    toolName,
    args,
    guildId: ctx.guild.id,
    channelId: ctx.channel.id,
    userId: OWNER_ID,
    expires,
    originalContent: originalMessage
  });

  const embed = new EmbedBuilder()
    .setTitle('طلب موافقة على عملية حساسة')
    .setColor(0xff9800)
    .setDescription(`**الأداة:** \`${toolName}\`\n**المعاملات:**\`\`\`json\n${JSON.stringify(args, null, 2).slice(0, 900)}\`\`\``)
    .addFields(
      { name: 'معرف الموافقة', value: approvalId, inline: true },
      { name: 'تنتهي خلال', value: '5 دقائق', inline: true }
    )
    .setFooter({ text: 'EM7 ULTIMATE AI • فقط المالك يمكنه الموافقة' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve_${approvalId}`).setLabel('موافقة').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${approvalId}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
  );

  const msg = await ctx.channel.send({ embeds: [embed], components: [row] });
  pendingApprovals.get(approvalId).messageId = msg.id;

  return {
    success: true,
    message: `العملية تتطلب موافقتك. تم إرسال طلب الموافقة (ID: ${approvalId}). انتظر أو اضغط الزر.`
  };
}

// ====================== AI AGENT LOOP ======================
async function runAgent(userContent, ctx) {
  const systemPrompt = `أنت EM7 ULTIMATE AI، مساعد خلفي متقدم لسيرفر Discord.
- تتحدث العربية الفصحى الطبيعية بطلاقة.
- لديك أدوات حقيقية لتنفيذ عمليات Discord.
- لا تدّع أبداً أن عملية نُفذت دون نتيجة حقيقية من الأداة.
- للعمليات الحساسة (حذف قنوات/رتب، طرد، حظر، timeout طويل) النظام يطلب موافقة المالك تلقائياً.
- خطط للطلبات المركبة خطوة بخطوة، نفذ، تحقق من النتيجة، ثم أكمل.
- لا تتجاوز هرمية الصلاحيات أبداً، ولا تمنح Administrator.
- إذا فشلت أداة، أخبر المالك بوضوح واقترح بديلاً.
- ردودك مختصرة ومهنية بعد تنفيذ الأدوات.
- المالك الوحيد المصرح: ${OWNER_ID}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...getMemory(),
    { role: 'user', content: userContent }
  ];

  let iterations = 0;
  let finalResponse = '';

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;
    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1024
      });
    } catch (err) {
      console.error('Groq error:', err.message);
      return { success: false, message: `خطأ في خدمة الذكاء الاصطناعي: ${err.message}` };
    }

    const choice = completion.choices[0];
    const msg = choice.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg);

      for (const toolCall of msg.tool_calls) {
        const name = toolCall.function.name;
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        let result;
        if (SENSITIVE_TOOLS.has(name)) {
          result = await requestApproval(name, args, ctx, userContent);
        } else if (toolHandlers[name]) {
          try {
            result = await toolHandlers[name](args, ctx);
          } catch (e) {
            result = { success: false, message: `خطأ تنفيذي: ${e.message}` };
            await audit(ctx.guild, name, args, result);
          }
        } else {
          result = { success: false, message: `أداة غير معروفة: ${name}` };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
      continue;
    }

    finalResponse = msg.content || 'تم.';
    break;
  }

  pushMemory('user', userContent);
  pushMemory('assistant', finalResponse);
  return { success: true, message: finalResponse };
}

// ====================== EVENTS ======================
client.once('ready', async () => {
  console.log(`EM7 ULTIMATE AI online as ${client.user.tag}`);
  client.user.setActivity('EM7 ULTIMATE AI', { type: 3 });

  // Register slash commands
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  const commands = [
    new SlashCommandBuilder()
      .setName('em7')
      .setDescription('إرسال طلب إلى EM7 ULTIMATE AI')
      .addStringOption(o => o.setName('prompt').setDescription('الطلب بالعربية').setRequired(true)),
    new SlashCommandBuilder()
      .setName('em7-status')
      .setDescription('حالة النظام')
  ].map(c => c.toJSON());

  try {
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
      console.log('Guild slash commands registered');
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log('Global slash commands registered');
    }
  } catch (e) {
    console.error('Slash register error:', e.message);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!isOwner(message.author.id)) return;
  if (!rateLimitOk(message.author.id)) {
    return message.reply({ content: 'انتظر قليلاً بين الطلبات.', allowedMentions: { repliedUser: false } }).catch(() => {});
  }

  const content = message.content.trim();
  const isTrigger =
    content.toLowerCase().startsWith('em7 ') ||
    content.toLowerCase().startsWith('يا ام7 ') ||
    content.toLowerCase().startsWith('يا em7 ') ||
    message.mentions.has(client.user);

  if (!isTrigger) return;

  let prompt = content;
  if (message.mentions.has(client.user)) {
    prompt = content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  } else {
    prompt = content.replace(/^(em7|يا ام7|يا em7)\s+/i, '').trim();
  }
  if (!prompt) return;

  if (processingLocks.has(message.guild.id)) {
    return message.reply({ content: 'يوجد طلب قيد المعالجة حالياً في هذا السيرفر. انتظر انتهاءه.', allowedMentions: { repliedUser: false } });
  }

  processingLocks.add(message.guild.id);
  const statusMsg = await message.reply({ content: 'جاري معالجة طلبك...', allowedMentions: { repliedUser: false } }).catch(() => null);

  try {
    const ctx = {
      guild: message.guild,
      channel: message.channel,
      member: message.member,
      message
    };
    const result = await runAgent(prompt, ctx);
    const reply = result.message.slice(0, 1900);
    if (statusMsg) {
      await statusMsg.edit({ content: reply }).catch(() => message.channel.send(reply));
    } else {
      await message.channel.send(reply);
    }
  } catch (err) {
    console.error(err);
    await message.channel.send(`حدث خطأ غير متوقع: ${err.message}`).catch(() => {});
  } finally {
    processingLocks.delete(message.guild.id);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'هذا الأمر مخصص للمالك فقط.', ephemeral: true });
    }

    if (interaction.commandName === 'em7-status') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('EM7 ULTIMATE AI Status')
            .setColor(0x00bcd4)
            .addFields(
              { name: 'الذاكرة', value: `${getMemory().length} رسالة`, inline: true },
              { name: 'موافقات معلقة', value: `${pendingApprovals.size}`, inline: true },
              { name: 'أقفال نشطة', value: `${processingLocks.size}`, inline: true }
            )
            .setTimestamp()
        ],
        ephemeral: true
      });
    }

    if (interaction.commandName === 'em7') {
      const prompt = interaction.options.getString('prompt', true);
      if (!rateLimitOk(interaction.user.id)) {
        return interaction.reply({ content: 'انتظر قليلاً.', ephemeral: true });
      }
      if (processingLocks.has(interaction.guildId)) {
        return interaction.reply({ content: 'طلب آخر قيد المعالجة.', ephemeral: true });
      }

      await interaction.deferReply();
      processingLocks.add(interaction.guildId);

      try {
        const ctx = {
          guild: interaction.guild,
          channel: interaction.channel,
          member: interaction.member,
          interaction
        };
        const result = await runAgent(prompt, ctx);
        await interaction.editReply({ content: result.message.slice(0, 1900) });
      } catch (err) {
        await interaction.editReply({ content: `خطأ: ${err.message}` }).catch(() => {});
      } finally {
        processingLocks.delete(interaction.guildId);
      }
    }
    return;
  }

  // Buttons for approval
  if (interaction.isButton()) {
    const [action, approvalId] = interaction.customId.split('_');
    if (!['approve', 'reject'].includes(action) || !approvalId) return;

    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'فقط المالك يمكنه الموافقة أو الرفض.', ephemeral: true });
    }

    const data = pendingApprovals.get(approvalId);
    if (!data) {
      return interaction.reply({ content: 'طلب الموافقة منتهي أو غير موجود.', ephemeral: true });
    }
    if (Date.now() > data.expires) {
      pendingApprovals.delete(approvalId);
      return interaction.reply({ content: 'انتهت صلاحية طلب الموافقة.', ephemeral: true });
    }
    if (data.guildId !== interaction.guildId) {
      return interaction.reply({ content: 'هذا الطلب لسيرفر آخر.', ephemeral: true });
    }

    pendingApprovals.delete(approvalId);

    if (action === 'reject') {
      await interaction.update({
        content: `تم رفض العملية بواسطة المالك.`,
        embeds: [],
        components: []
      }).catch(() => {});
      await audit(interaction.guild, data.toolName, data.args, { success: false, message: 'Rejected by owner' });
      return;
    }

    // Approve → re-check permissions and execute
    await interaction.deferUpdate();
    const ctx = {
      guild: interaction.guild,
      channel: interaction.channel,
      member: interaction.member
    };

    let result;
    try {
      if (toolHandlers[data.toolName]) {
        result = await toolHandlers[data.toolName](data.args, ctx);
      } else {
        result = { success: false, message: 'أداة غير موجودة' };
      }
    } catch (e) {
      result = { success: false, message: e.message };
    }

    await audit(interaction.guild, data.toolName + '_approved', data.args, result);

    const embed = new EmbedBuilder()
      .setTitle(result.success ? 'تم التنفيذ بعد الموافقة' : 'فشل التنفيذ بعد الموافقة')
      .setColor(result.success ? 0x00c853 : 0xd50000)
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] }).catch(() => {});
  }
});

// Cleanup expired approvals
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of pendingApprovals) {
    if (now > data.expires) pendingApprovals.delete(id);
  }
}, 60 * 1000);

process.on('unhandledRejection', (err) => console.error('UnhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('UncaughtException:', err));

client.login(process.env.DISCORD_TOKEN);
