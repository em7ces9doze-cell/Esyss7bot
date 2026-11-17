'use strict';

const { ChannelType } = require('discord.js');
const { cleanName } = require('../security/validation');

const MAX_ROLES = 20;
const MAX_CATEGORIES = 20;
const MAX_CHANNELS_PER_CATEGORY = 30;

function safeName(value) {
  const name = cleanName(String(value || '')).trim().toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  if (!name) throw new Error('اسم Discord غير صالح.');
  return name;
}

function createControlBridge({ client, db, config, logger }) {
  if (!config.controlApiUrl || !config.controlBridgeSecret) {
    logger.info('EM7 CONTROL bridge disabled: API URL or bridge secret is not configured.');
    return { enabled: false, stop() {} };
  }

  const base = config.controlApiUrl.replace(/\/+$/, '');
  const headers = {
    Authorization: 'Bearer ' + config.controlBridgeSecret,
    'Content-Type': 'application/json',
    'User-Agent': 'EM7-SYSTEM-Control-Bridge/1.0'
  };
  let stopped = false;
  let timer = null;
  let running = false;

  async function api(path, body) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error('EM7 CONTROL API returned HTTP ' + response.status);
    return data;
  }

  async function execute(command) {
    if (!command || typeof command.id !== 'string' || typeof command.action !== 'string') {
      throw new Error('Invalid command envelope.');
    }
    const guildId = String(command.guildId || '');
    if (!guildId || (config.controlGuildId && guildId !== config.controlGuildId)) {
      throw new Error('Target guild is not allowed.');
    }

    const prior = db.prepare('SELECT status,result_json FROM control_commands WHERE command_id=?').get(command.id);
    if (prior && prior.status === 'completed') {
      return { ok: true, duplicate: true, result: JSON.parse(prior.result_json || '{}') };
    }
    db.prepare("INSERT OR IGNORE INTO control_commands(command_id,guild_id,action,status,created_at) VALUES(?,?,?,'processing',?)")
      .run(command.id, guildId, command.action, new Date().toISOString());

    const guild = await client.guilds.fetch(guildId);
    const me = await guild.members.fetchMe();
    if (!me.permissions.has('ManageChannels') && ['create_server_structure', 'create_text_channel'].includes(command.action)) {
      throw new Error('Bot is missing Manage Channels permission.');
    }
    if (!me.permissions.has('ManageRoles') && ['create_server_structure', 'create_role'].includes(command.action)) {
      throw new Error('Bot is missing Manage Roles permission.');
    }

    const payload = command.payload || {};
    const result = { roles: [], categories: [], channels: [] };

    if (command.action === 'create_role') {
      const role = await guild.roles.create({
        name: safeName(payload.name),
        color: /^#[0-9a-fA-F]{6}$/.test(payload.color || '') ? payload.color : undefined,
        permissions: [],
        reason: 'Requested through authenticated EM7 CONTROL'
      });
      result.roles.push({ id: role.id, name: role.name });
    } else if (command.action === 'create_text_channel') {
      const channel = await guild.channels.create({
        name: safeName(payload.name),
        type: ChannelType.GuildText,
        reason: 'Requested through authenticated EM7 CONTROL'
      });
      result.channels.push({ id: channel.id, name: channel.name, type: 'text' });
    } else if (command.action === 'create_server_structure') {
      const roles = Array.isArray(payload.roles) ? payload.roles : [];
      const categories = Array.isArray(payload.categories) ? payload.categories : [];
      if (roles.length > MAX_ROLES || categories.length > MAX_CATEGORIES) {
        throw new Error('Structure exceeds configured safety limits.');
      }
      for (const item of roles) {
        const role = await guild.roles.create({
          name: safeName(item.name),
          color: /^#[0-9a-fA-F]{6}$/.test(item.color || '') ? item.color : undefined,
          permissions: [],
          reason: 'Requested through authenticated EM7 CONTROL'
        });
        result.roles.push({ id: role.id, name: role.name });
      }
      for (const item of categories) {
        const category = await guild.channels.create({
          name: safeName(item.name),
          type: ChannelType.GuildCategory,
          reason: 'Requested through authenticated EM7 CONTROL'
        });
        result.categories.push({ id: category.id, name: category.name });
        const channels = Array.isArray(item.channels) ? item.channels : [];
        if (channels.length > MAX_CHANNELS_PER_CATEGORY) {
          throw new Error('A category contains too many channels.');
        }
        for (const entry of channels) {
          const type = entry.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText;
          const channel = await guild.channels.create({
            name: safeName(entry.name),
            type,
            parent: category.id,
            reason: 'Requested through authenticated EM7 CONTROL'
          });
          result.channels.push({
            id: channel.id,
            name: channel.name,
            type: type === ChannelType.GuildVoice ? 'voice' : 'text',
            parentId: category.id
          });
        }
      }
    } else {
      throw new Error('Action is not in the EM7 CONTROL allowlist.');
    }

    const serialized = JSON.stringify(result);
    db.prepare("UPDATE control_commands SET status='completed',result_json=?,completed_at=? WHERE command_id=?")
      .run(serialized, new Date().toISOString(), command.id);
    return { ok: true, ...result };
  }

  async function poll() {
    if (stopped || running || !client.isReady()) return schedule();
    running = true;
    try {
      const claimed = await api('/api/internal/discord/commands/claim', {
        botUserId: client.user.id,
        guildId: config.controlGuildId || null
      });
      if (claimed && claimed.command) {
        let outcome;
        try {
          outcome = await execute(claimed.command);
          await api('/api/internal/discord/commands/' + encodeURIComponent(claimed.command.id) + '/complete', {
            status: 'completed',
            result: outcome
          });
        } catch (error) {
          logger.warn('EM7 CONTROL command failed:', error.message);
          await api('/api/internal/discord/commands/' + encodeURIComponent(claimed.command.id) + '/complete', {
            status: 'failed',
            error: error.message
          }).catch(ackError => logger.warn('Could not report command failure:', ackError.message));
        }
      }
    } catch (error) {
      logger.warn('EM7 CONTROL bridge poll failed:', error.message);
    } finally {
      running = false;
      schedule();
    }
  }

  function schedule() {
    if (!stopped) timer = setTimeout(poll, config.controlPollMs);
  }

  schedule();
  logger.info('EM7 CONTROL bridge enabled.');
  return {
    enabled: true,
    stop() { stopped = true; if (timer) clearTimeout(timer); }
  };
}

module.exports = { createControlBridge };
