"use strict";

const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { askGroq } = require("../services/ai");

const HOST_URL = "https://em7host-nvenijcy.manus.space";
const HOST_CHANNEL_NAME = "host-em7";
const HOST_EMBED_TITLE = "EM7 HOST | استضافة بوتات Discord";
const AI_COOLDOWN_MS = 20000;
const aiCooldowns = new Map();

function hostEmbed() {
  return new EmbedBuilder()
    .setColor(0x7655c9)
    .setAuthor({ name: "EM7 ECOSYSTEM" })
    .setTitle(HOST_EMBED_TITLE)
    .setDescription([
      "منصة **EM7 HOST** لإدارة واستضافة بوتات Discord.",
      "",
      "• استعرض الباقات والسعات المتاحة.",
      "• أنشئ حسابك وأدر مشاريعك من لوحة التحكم.",
      "• تابع حالة خدماتك وبيانات الاستضافة من حسابك.",
      "",
      "**تفاصيل الموارد والأسعار المعتمدة موجودة في الموقع الرسمي.**"
    ].join("\n"))
    .addFields(
      {
        name: "منصة EM7 HOST",
        value: HOST_URL,
        inline: false
      },
      {
        name: "EM7 Coins",
        value: "المحفظة وطلبات شحن العملات تدار من أوامر البوت. شراء الاستضافة بالعملات أو تفعيلها تلقائيًا غير متاح حتى اكتمال الربط الرسمي.",
        inline: false
      }
    )
    .setFooter({ text: "EM7 HOST • Official Hosting Portal" })
    .setTimestamp();
}

function hostLinkRow(label = "فتح منصة EM7 HOST") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(label)
      .setStyle(ButtonStyle.Link)
      .setURL(HOST_URL)
  );
}

function adminPanelRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("em7_host_create_room")
        .setLabel("إنشاء / تحديث روم الموقع")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("em7_admin_status")
        .setLabel("فحص حالة البوت")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("em7_topup_requests")
        .setLabel("طلبات شحن العملات")
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("em7_economy_stats")
        .setLabel("ملخص العملات")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("em7_audit_log")
        .setLabel("سجل الإدارة")
        .setStyle(ButtonStyle.Secondary)
    ),
    hostLinkRow()
  ];
}

function formatUptime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "غير متاح";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [days ? days + " يوم" : null, hours ? hours + " ساعة" : null, minutes ? minutes + " دقيقة" : null, seconds + " ثانية"]
    .filter(Boolean)
    .join("، ") || "أقل من ثانية";
}

function statusEmbed(client) {
  const ping = Number.isFinite(client.ws.ping) && client.ws.ping >= 0
    ? Math.round(client.ws.ping) + " ms"
    : "غير متاح";
  return new EmbedBuilder()
    .setColor(0x7655c9)
    .setTitle("EM7 SYSTEM | حالة التشغيل")
    .addFields(
      { name: "الحالة", value: "متصل", inline: true },
      { name: "زمن الاستجابة", value: ping, inline: true },
      { name: "مدة التشغيل", value: formatUptime(client.uptime), inline: true },
      { name: "السيرفرات", value: String(client.guilds.cache.size), inline: true },
      { name: "استخدام الذاكرة", value: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB", inline: true },
      { name: "المنصة المرتبطة", value: "[EM7 HOST](" + HOST_URL + ")", inline: false }
    )
    .setTimestamp();
}

const TICKET_CATEGORIES = {
  hosting: "استضافة بوت",
  billing: "العملات والفواتير",
  technical: "مشكلة تقنية",
  other: "طلب آخر"
};

function ticketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("em7_ticket_claim")
      .setLabel("استلام التذكرة")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("em7_ticket_close")
      .setLabel("إغلاق التذكرة")
      .setStyle(ButtonStyle.Danger)
  );
}

async function ensureHostChannel(guild, client) {
  const me = guild.members.me || await guild.members.fetch(client.user.id);
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    throw new Error("BOT_PERMISSION_MISSING");
  }

  const channels = await guild.channels.fetch();
  let channel = channels.find(item =>
    item && item.type === ChannelType.GuildText && item.name === HOST_CHANNEL_NAME
  );
  let created = false;

  if (!channel) {
    channel = await guild.channels.create({
      name: HOST_CHANNEL_NAME,
      type: ChannelType.GuildText,
      topic: "القناة الرسمية لموقع EM7 HOST | " + HOST_URL,
      reason: "Create official EM7 HOST information channel",
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory
          ],
          deny: [PermissionFlagsBits.SendMessages]
        },
        {
          id: client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });
    created = true;
  }

  try {
    const channelPermissions = channel.permissionsFor(me);
    if (!channelPermissions || !channelPermissions.has([
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ReadMessageHistory
    ])) {
      throw new Error("BOT_CHANNEL_PERMISSION_MISSING");
    }
    const recent = await channel.messages.fetch({ limit: 50 });
    const existingPost = recent.find(message =>
      message.author.id === client.user.id &&
      message.embeds.some(embed => embed.title === HOST_EMBED_TITLE)
    );
    const payload = { embeds: [hostEmbed()], components: [hostLinkRow()] };

    if (existingPost) {
      await existingPost.edit(payload);
      return { channel, created, updated: true };
    }

    await channel.send(payload);
    return { channel, created, updated: false };
  } catch (error) {
    if (created) {
      await channel.delete("Rollback failed EM7 HOST channel publication").catch(() => null);
    }
    throw error;
  }
}

function audit(db, actorId, action, details) {
  if (!db) return;
  try {
    db.prepare("INSERT INTO audit_log(actor_id,action,details) VALUES(?,?,?)")
      .run(actorId, action, JSON.stringify(details));
  } catch (error) {
    console.error("EM7 audit write failed:", error.message);
  }
}

function createInteractionHandler({ config, commerce, tickets, db, client }) {
  return async function handle(interaction) {
    try {
      if (interaction.isButton()) {
        if (["em7_ticket_claim", "em7_ticket_close"].includes(interaction.customId)) {
          const ticket = tickets.findByChannel(interaction.channelId);
          if (!ticket || ticket.status !== "open") {
            return interaction.reply({ content: "هذه التذكرة غير موجودة أو مغلقة.", ephemeral: true });
          }
          if (interaction.customId === "em7_ticket_claim") {
            if (interaction.user.id !== config.ownerId) {
              return interaction.reply({ content: "استلام التذاكر مخصص لإدارة EM7.", ephemeral: true });
            }
            const result = tickets.claim(interaction.channelId, interaction.user.id);
            if (!result.claimed) {
              return interaction.reply({ content: "تم استلام هذه التذكرة مسبقًا.", ephemeral: true });
            }
            audit(db, interaction.user.id, "support.ticket.claim", { ticketId: ticket.id, channelId: ticket.channel_id });
            return interaction.reply({ content: "تم استلام التذكرة بنجاح.", ephemeral: true });
          }
          if (interaction.user.id !== ticket.user_id && interaction.user.id !== config.ownerId) {
            return interaction.reply({ content: "إغلاق التذكرة متاح لصاحبها أو إدارة EM7 فقط.", ephemeral: true });
          }
          await interaction.deferReply({ ephemeral: true });
          const closed = tickets.close(interaction.channelId, interaction.user.id);
          if (!closed) {
            return interaction.editReply({ content: "التذكرة مغلقة بالفعل." });
          }
          await interaction.channel.permissionOverwrites.edit(ticket.user_id, {
            SendMessages: false
          });
          await interaction.channel.setTopic(
            "EM7 Support | Ticket #" + ticket.id + " | CLOSED | " + ticket.category
          );
          await interaction.message.edit({ components: [] }).catch(() => null);
          audit(db, interaction.user.id, "support.ticket.close", { ticketId: ticket.id, channelId: ticket.channel_id });
          return interaction.editReply({ content: "تم إغلاق التذكرة. ستبقى القناة متاحة للقراءة." });
        }
        if (!["em7_host_create_room", "em7_admin_status", "em7_topup_requests", "em7_economy_stats", "em7_audit_log"].includes(interaction.customId)) return;
        if (interaction.user.id !== config.ownerId) {
          return interaction.reply({ content: "هذا الإجراء مخصص لإدارة EM7.", ephemeral: true });
        }
        if (interaction.customId === "em7_admin_status") {
          return interaction.reply({ embeds: [statusEmbed(client)], ephemeral: true });
        }
        if (interaction.customId === "em7_economy_stats") {
          const stats = commerce.adminSummary();
          const embed = new EmbedBuilder()
            .setColor(0x7655c9)
            .setTitle("EM7 Coins | الملخص المالي")
            .addFields(
              { name: "المحافظ المسجلة", value: String(stats.wallets.users), inline: true },
              { name: "إجمالي العملات", value: Number(stats.wallets.coins).toLocaleString("en-US"), inline: true },
              { name: "طلبات معلقة", value: String(stats.pendingTopups.count) + " • " + Number(stats.pendingTopups.amount).toLocaleString("en-US") + " Coins", inline: false },
              { name: "طلبات معتمدة", value: String(stats.approvedTopups.count) + " • " + Number(stats.approvedTopups.amount).toLocaleString("en-US") + " Coins", inline: false }
            )
            .setTimestamp();
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (interaction.customId === "em7_audit_log") {
          const rows = commerce.listAudit(15);
          const description = rows.length
            ? rows.map(row =>
              "`#" + row.id + "` • **" + String(row.action).slice(0, 70) +
              "** • <@" + row.actor_id + "> • " + String(row.created_at)
            ).join("\n").slice(0, 3900)
            : "لا توجد إجراءات مسجلة حتى الآن.";
          const embed = new EmbedBuilder()
            .setColor(0x7655c9)
            .setTitle("EM7 | سجل إجراءات الإدارة")
            .setDescription(description)
            .setFooter({ text: "آخر 15 إجراءً" })
            .setTimestamp();
          return interaction.reply({
            embeds: [embed],
            ephemeral: true,
            allowedMentions: { parse: [] }
          });
        }
        if (interaction.customId === "em7_topup_requests") {
          const rows = commerce.listPending(15);
          const description = rows.length
            ? rows.map(row =>
              "`#" + row.id + "` • <@" + row.user_id + "> • " +
              row.amount + " Coins • " + String(row.note).replace(/\s+/g, " ").slice(0, 70)
            ).join("\n").slice(0, 3900)
            : "لا توجد طلبات شحن معلقة.";
          const embed = new EmbedBuilder()
            .setColor(0x7655c9)
            .setTitle("طلبات شحن EM7 Coins")
            .setDescription(description)
            .setFooter({ text: "أحدث 15 طلبًا معلّقًا" })
            .setTimestamp();
          return interaction.reply({
            embeds: [embed],
            ephemeral: true,
            allowedMentions: { parse: [] }
          });
        }
        if (!interaction.guild) {
          return interaction.reply({ content: "استخدم هذا الزر داخل سيرفر Discord.", ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const result = await ensureHostChannel(interaction.guild, client);
        audit(db, interaction.user.id, "host.channel.publish", {
          guildId: interaction.guildId,
          channelId: result.channel.id,
          created: result.created,
          updated: result.updated
        });
        const action = result.created ? "إنشاء" : result.updated ? "تحديث" : "نشر";
        return interaction.editReply({
          content: "تم " + action + " معلومات EM7 HOST بنجاح في " + result.channel + "."
        });
      }

      if (!interaction.isChatInputCommand() || interaction.commandName !== "e7") return;

      const sub = interaction.options.getSubcommand();
      const isOwner = interaction.user.id === config.ownerId;
      const ownerOnly = new Set([
        "requests",
        "approve-request",
        "reject-request",
        "credit",
        "test-room",
        "host-room",
        "admin-panel"
      ]);

      if (ownerOnly.has(sub) && !isOwner) {
        return interaction.reply({ content: "هذا الأمر مخصص لإدارة EM7.", ephemeral: true });
      }

      if (["host-room", "test-room"].includes(sub) && !interaction.guild) {
        return interaction.reply({ content: "هذا الأمر يعمل داخل سيرفر Discord فقط.", ephemeral: true });
      }

      if (sub === "help") {
        return interaction.reply({
          ephemeral: true,
          content: [
            "**EM7 SYSTEM × EM7 HOST**",
            "",
            "**الموقع والاستضافة**",
            "`/e7 website` — فتح المنصة الرسمية",
            "`/e7 plans` — عرض الباقات في الموقع",
            "`/e7 buy-plan` — اختيار باقة ومتابعة الطلب في الموقع",
            "`/e7 support` — فتح تذكرة دعم خاصة مع فريق EM7",
            "",
            "**EM7 Coins**",
            "`/e7 balance` — رصيدك",
            "`/e7 request-coins` — طلب شحن",
            "`/e7 ledger` — سجل الحركات",
            "",
            "**النظام**",
            "`/e7 status` — حالة البوت",
            "`/e7 ask` — مساعد EM7 AI",
            "",
            "**أوامر الإدارة**",
            "`/e7 admin-panel` — لوحة إدارة EM7 HOST",
            "`/e7 host-room` — إنشاء أو تحديث روم الموقع",
            "`/e7 requests` و`/e7 approve-request` و`/e7 reject-request` و`/e7 credit`"
          ].join("\n")
        });
      }

      if (["website", "plans", "shop"].includes(sub)) {
        const isPlans = sub === "plans";
        const embed = new EmbedBuilder()
          .setColor(0x7655c9)
          .setAuthor({ name: "EM7 ECOSYSTEM" })
          .setTitle(isPlans ? "باقات EM7 HOST" : "منصة EM7 HOST")
          .setDescription(
            isPlans
              ? "راجع الباقات وحدود الموارد والأسعار الحالية مباشرة من الموقع. الموقع هو المرجع المعتمد لأي تغيير."
              : "منصة EM7 الرسمية لإدارة حسابك وخدمات استضافة بوتات Discord."
          )
          .addFields({ name: "الرابط الرسمي", value: HOST_URL })
          .setFooter({ text: "EM7 HOST • Official Hosting Portal" })
          .setTimestamp();
        return interaction.reply({
          embeds: [embed],
          components: [hostLinkRow(isPlans ? "استعراض الباقات" : "فتح الموقع الرسمي")],
          ephemeral: true
        });
      }

      if (sub === "buy-plan") {
        const plan = interaction.options.getString("plan");
        return interaction.reply({
          content: "تم تحديد باقة **" + plan + "**. أكمل الطلب من موقع EM7 HOST وراجع السعة والسعر الظاهرين هناك. لم يتم خصم أي EM7 Coins ولم يتم إنشاء استضافة من هذا الأمر.",
          components: [hostLinkRow("متابعة اختيار الباقة")],
          ephemeral: true
        });
      }

      if (sub === "admin-panel") {
        const embed = new EmbedBuilder()
          .setColor(0x7655c9)
          .setAuthor({ name: "EM7 SYSTEM ADMIN" })
          .setTitle("لوحة إدارة EM7 HOST")
          .setDescription("إدارة قناة التعريف الرسمية ومراجعة حالة تشغيل البوت.")
          .addFields(
            { name: "الموقع", value: HOST_URL },
            { name: "صلاحية اللوحة", value: "مالك النظام فقط" }
          )
          .setTimestamp();
        return interaction.reply({
          embeds: [embed],
          components: adminPanelRows(),
          ephemeral: true
        });
      }

      if (sub === "support") {
        if (!interaction.guild) {
          return interaction.reply({ content: "افتح تذكرة الدعم من داخل سيرفر EM7.", ephemeral: true });
        }
        const me = interaction.guild.members.me || await interaction.guild.members.fetch(client.user.id);
        if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.reply({ content: "البوت يحتاج صلاحية Manage Channels لفتح تذاكر الدعم.", ephemeral: true });
        }
        const ownerMember = config.ownerId === interaction.user.id
          ? null
          : await interaction.guild.members.fetch(config.ownerId).catch(() => null);
        if (config.ownerId !== interaction.user.id && !ownerMember) {
          return interaction.reply({
            content: "حساب إدارة EM7 غير موجود في هذا السيرفر؛ لا يمكن إنشاء تذكرة خاصة قابلة للمتابعة.",
            ephemeral: true
          });
        }
        const existing = tickets.findOpen(interaction.guildId, interaction.user.id);
        if (existing) {
          const existingChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
          if (existingChannel) {
            return interaction.reply({
              content: "لديك تذكرة مفتوحة بالفعل: " + existingChannel,
              ephemeral: true
            });
          }
          tickets.close(existing.channel_id, config.ownerId);
        }

        await interaction.deferReply({ ephemeral: true });
        let channel = null;
        try {
          const suffix = interaction.user.id.slice(-4);
          const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 16) || "member";
          channel = await interaction.guild.channels.create({
            name: "support-" + safeName + "-" + suffix,
            type: ChannelType.GuildText,
            topic: "EM7 Support | " + TICKET_CATEGORIES[interaction.options.getString("category")],
            reason: "Create private EM7 support ticket",
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: interaction.user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks
                ]
              },
              {
                id: client.user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.EmbedLinks
                ]
              },
              ...(config.ownerId !== interaction.user.id ? [{
                id: config.ownerId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks
                ]
              }] : [])
            ]
          });

          const created = tickets.create({
            guildId: interaction.guildId,
            userId: interaction.user.id,
            channelId: channel.id,
            category: interaction.options.getString("category")
          });
          if (!created.created) {
            await channel.delete("Duplicate open EM7 support ticket").catch(() => null);
            const duplicateChannel = await interaction.guild.channels.fetch(created.ticket.channel_id).catch(() => null);
            return interaction.editReply({
              content: duplicateChannel
                ? "لديك تذكرة مفتوحة بالفعل: " + duplicateChannel
                : "لديك تذكرة مفتوحة بالفعل. حاول تحديث القناة أو تواصل مع الإدارة."
            });
          }

          await channel.setTopic(
            "EM7 Support | Ticket #" + created.ticket.id + " | " +
            TICKET_CATEGORIES[created.ticket.category]
          );
          const embed = new EmbedBuilder()
            .setColor(0x7655c9)
            .setAuthor({ name: "EM7 HOST • SUPPORT CENTER" })
            .setTitle("تذكرة دعم جديدة #" + created.ticket.id)
            .setDescription(String(interaction.options.getString("details")).slice(0, 900))
            .addFields(
              { name: "صاحب التذكرة", value: "<@" + interaction.user.id + ">", inline: true },
              { name: "القسم", value: TICKET_CATEGORIES[created.ticket.category], inline: true },
              { name: "الحالة", value: "مفتوحة", inline: true }
            )
            .setFooter({ text: "EM7 SYSTEM • Support" })
            .setTimestamp();
          await channel.send({
            embeds: [embed],
            components: [ticketControls()],
            allowedMentions: { users: [interaction.user.id], parse: [] }
          });
          audit(db, interaction.user.id, "support.ticket.open", {
            ticketId: created.ticket.id,
            guildId: interaction.guildId,
            channelId: channel.id,
            category: created.ticket.category
          });
          return interaction.editReply({ content: "تم فتح تذكرة الدعم الخاصة بك: " + channel });
        } catch (error) {
          if (channel) await channel.delete("Rollback failed EM7 support ticket").catch(() => null);
          throw error;
        }
      }

      if (sub === "host-room") {
        await interaction.deferReply({ ephemeral: true });
        const result = await ensureHostChannel(interaction.guild, client);
        audit(db, interaction.user.id, "host.channel.publish", {
          guildId: interaction.guildId,
          channelId: result.channel.id,
          created: result.created,
          updated: result.updated
        });
        return interaction.editReply({
          content: (result.created ? "تم إنشاء" : result.updated ? "تم تحديث" : "تم نشر") +
            " معلومات EM7 HOST في " + result.channel + "."
        });
      }

      if (sub === "status") {
        return interaction.reply({ embeds: [statusEmbed(client)], ephemeral: true });
      }

      if (sub === "balance") {
        return interaction.reply({
          ephemeral: true,
          content: "رصيدك: **" + commerce.balance(interaction.user.id) + " EM7 Coins**"
        });
      }

      if (sub === "request-coins") {
        const id = commerce.requestTopup(
          interaction.user.id,
          interaction.options.getInteger("amount"),
          interaction.options.getString("note")
        );
        return interaction.reply({
          ephemeral: true,
          content: "تم تسجيل طلب الشحن **#" + id + "** للمراجعة. لم تتم إضافة العملات بعد."
        });
      }

      if (sub === "ledger") {
        const rows = commerce.ledger(interaction.user.id, 10);
        const description = rows.length
          ? rows.map(row =>
            "`#" + row.id + "` • " +
            (row.delta > 0 ? "+" : "") + row.delta + " Coins • " +
            String(row.reason).slice(0, 90)
          ).join("\n").slice(0, 3900)
          : "لا توجد حركات مسجلة في محفظتك.";
        const embed = new EmbedBuilder()
          .setColor(0x7655c9)
          .setTitle("سجل محفظة EM7 Coins")
          .setDescription(description)
          .setFooter({ text: "آخر 10 حركات" });
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === "requests") {
        const rows = commerce.listPending(15);
        const content = rows.length
          ? rows.map(row =>
            "`#" + row.id + "` • <@" + row.user_id + "> • " +
            row.amount + " Coins • " + String(row.note).slice(0, 80)
          ).join("\n").slice(0, 1900)
          : "لا توجد طلبات شحن معلقة.";
        return interaction.reply({ ephemeral: true, content, allowedMentions: { parse: [] } });
      }

      if (sub === "reject-request") {
        const result = commerce.rejectTopup(
          interaction.options.getInteger("id"),
          interaction.user.id,
          interaction.options.getString("reason")
        );
        await interaction.reply({
          ephemeral: true,
          content: "تم رفض طلب الشحن **#" + interaction.options.getInteger("id") +
            "** بقيمة " + result.amount + " Coins. لم تتم إضافة عملات إلى المحفظة."
        });
        const user = await client.users.fetch(result.userId).catch(() => null);
        if (user) {
          await user.send(
            "تم رفض طلب شحن EM7 Coins. السبب: " + result.reason
          ).catch(() => null);
        }
        audit(db, interaction.user.id, "coins.topup.reject", {
          userId: result.userId,
          amount: result.amount
        });
        return;
      }

      if (sub === "approve-request") {
        const result = commerce.approveTopup(interaction.options.getInteger("id"), interaction.user.id);
        await interaction.reply({
          ephemeral: true,
          content: "تم اعتماد الطلب وإضافة **" + result.amount +
            " Coins**. الرصيد الجديد: **" + result.balance + "**."
        });
        const user = await client.users.fetch(result.userId).catch(() => null);
        if (user) {
          await user.send("تم اعتماد طلب الشحن وإضافة " + result.amount + " EM7 Coins.")
            .catch(() => null);
        }
        audit(db, interaction.user.id, "coins.topup.approve", {
          userId: result.userId,
          amount: result.amount
        });
        return;
      }

      if (sub === "credit") {
        const user = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const balance = commerce.credit(
          user.id,
          amount,
          interaction.options.getString("reason"),
          interaction.user.id
        );
        return interaction.reply({
          ephemeral: true,
          content: "تمت إضافة **" + amount + " Coins** إلى " + user.tag +
            ". الرصيد الجديد: **" + balance + "**."
        });
      }

      if (sub === "test-room") {
        const me = interaction.guild.members.me || await interaction.guild.members.fetch(client.user.id);
        if (!me.permissions.has([
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ])) {
          return interaction.reply({
            ephemeral: true,
            content: "البوت لا يملك الصلاحيات المطلوبة لإنشاء روم الاختبار."
          });
        }
        await interaction.deferReply({ ephemeral: true });
        const channel = await interaction.guild.channels.create({
          name: "em7-private-test",
          type: ChannelType.GuildText,
          topic: "Private EM7 test channel",
          reason: "Create private EM7 test channel",
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });
        audit(db, interaction.user.id, "channel.test.create", {
          channelId: channel.id,
          guildId: interaction.guildId
        });
        return interaction.editReply({ content: "تم إنشاء روم الاختبار الخاص: " + channel });
      }

      if (sub === "ask") {
        const now = Date.now();
        const lastRequest = aiCooldowns.get(interaction.user.id) || 0;
        const waitMs = AI_COOLDOWN_MS - (now - lastRequest);
        if (waitMs > 0) {
          return interaction.reply({
            ephemeral: true,
            content: "انتظر " + Math.ceil(waitMs / 1000) + " ثانية قبل إرسال سؤال جديد إلى EM7 AI."
          });
        }
        aiCooldowns.set(interaction.user.id, now);
        if (aiCooldowns.size > 5000) {
          for (const [userId, timestamp] of aiCooldowns) {
            if (now - timestamp > AI_COOLDOWN_MS * 2) aiCooldowns.delete(userId);
          }
        }
        await interaction.deferReply({ ephemeral: true });
        const answer = await askGroq({
          apiKey: config.groqApiKey,
          model: config.groqModel,
          prompt: interaction.options.getString("prompt")
        });
        return interaction.editReply(answer.slice(0, 1900));
      }
    } catch (error) {
      console.error("EM7 interaction failed:", {
        command: interaction.commandName || "component",
        subcommand: interaction.isChatInputCommand() ? interaction.options.getSubcommand() : null,
        code: error.code || error.name || "UNKNOWN"
      });
      const message = error.message === "BOT_PERMISSION_MISSING"
        ? "البوت يحتاج صلاحية Manage Channels على مستوى السيرفر."
        : error.message === "BOT_CHANNEL_PERMISSION_MISSING"
          ? "البوت لا يملك صلاحيات View Channel وSend Messages وEmbed Links وRead Message History داخل قناة الموقع."
          : "تعذر تنفيذ العملية. تحقق من صلاحيات البوت وسجلات الاستضافة، ثم أعد المحاولة.";
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: message }).catch(() => null);
      }
      return interaction.reply({ ephemeral: true, content: message }).catch(() => null);
    }
  };
}

module.exports = { createInteractionHandler };
