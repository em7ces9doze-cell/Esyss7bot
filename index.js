const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
    ]
});

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('يعرض سرعة استجابة البوت (البينج)'),
    
    new SlashCommandBuilder()
        .setName('bots-status')
        .setDescription('فحص حالة الاتصال الحقيقية للبوتات في السيرفر'),

    new SlashCommandBuilder()
        .setName('server-info')
        .setDescription('عرض معلومات تفصيلية عن السيرفر الحالي'),

    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('إرسال لوحة التذاكر الاحترافية في الروم الحالي'),

    new SlashCommandBuilder()
        .setName('send')
        .setDescription('لوحة إرسال الرسائل المتقدمة (لروم معين أو رسالة خاصة عبر أزرار)'),
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[LOG] Emsys7 is online! Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// حماية الروابط
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.includes('discord.gg/') || message.content.includes('discord.com/invite/')) {
        await message.delete().catch(() => {});
        message.channel.send(`⚠️ **${message.author.username}**، ممنوع نشر روابط الديسكورد هنا!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
        return;
    }
});

// التعامل مع الأوامر والأزرار والمودالات
client.on('interactionCreate', async interaction => {
    
    // 1. التعامل مع الأوامر الأساسية (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'ping') {
            const latency = Date.now() - interaction.createdTimestamp;
            await interaction.reply(`🏓 Pong! سرعة الاستجابة: **${Math.abs(latency)}ms**`);
        }

        else if (commandName === 'send') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة فقط!', ephemeral: true });
            }

            const panelEmbed = new EmbedBuilder()
                .setTitle('📤 لوحة إرسال الرسائل الاحترافية')
                .setDescription('اختر الطريقة المناسبة لإرسال رسالتك عبر الأزرار أدناه:\n\n🔹 **إرسال روم**: لإرسال رسالة Embed لروم معين عبر الآي دي.\n🔹 **رسالة خاصة (DM)**: لإرسال رسالة خاصة لعضو عبر الآي دي الخاص به.')
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'EM7 Panel System', iconURL: client.user.displayAvatarURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_send_channel')
                    .setLabel('💬 إرسال روم')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('btn_send_dm')
                    .setLabel('✉️ رسالة خاصة')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [panelEmbed], components: [row], ephemeral: true });
        }

        else if (commandName === 'setup-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ عذراً، هذا الأمر للإدارة فقط!', ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setTitle('🎫 نظام الدعم الفني والتذاكر')
                .setDescription('إذا كان لديك أي استفسار، مشكلة، أو تريد التواصل مع الإدارة:\n\n**اضغط على الزر أدناه لفتح تذكرة خاصة بك.**')
                .setColor(0xF1C40F)
                .setTimestamp()
                .setFooter({ text: 'EM7 Support System', iconURL: client.user.displayAvatarURL() });

            const ticketRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('🎫 فتح تذكرة جديدة')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({ embeds: [ticketEmbed], components: [ticketRow] });
            await interaction.reply({ content: '✅ تم إرسال لوحة التذاكر بنجاح!', ephemeral: true });
        }

        else if (commandName === 'bots-status') {
            await interaction.deferReply();
            await interaction.guild.members.fetch();
            const bots = interaction.guild.members.cache.filter(member => member.user.bot);

            let statusText = `🤖 **حالة اتصال البوتات في ${interaction.guild.name}:**\n\n`;
            bots.forEach(bot => {
                const status = bot.presence?.status;
                let statusEmoji = '🟢', statusName = 'متصل';
                if (!status || status === 'offline') {
                    statusEmoji = '🔴';
                    statusName = 'غير متصل';
                }
                statusText += `${statusEmoji} **${bot.user.username}** — *${statusName}* (ID: \`${bot.id}\`)\n`;
            });

            const statusEmbed = new EmbedBuilder()
                .setTitle('📡 لوحة المراقبة وواقعية الاتصال')
                .setDescription(statusText)
                .setColor(0x00AE86)
                .setTimestamp()
                .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [statusEmbed] });
        }

        else if (commandName === 'server-info') {
            const guild = interaction.guild;
            const owner = await guild.fetchOwner();
            const serverEmbed = new EmbedBuilder()
                .setTitle(`📊 معلومات سيرفر: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setColor(0xF1C40F)
                .addFields(
                    { name: '👑 صاحب السيرفر', value: `<@${owner.id}>`, inline: true },
                    { name: '👥 عدد الأعضاء', value: `${guild.memberCount} عضو`, inline: true },
                    { name: '🔒 الرتب', value: `${guild.roles.cache.size} رتبة`, inline: true },
                    { name: '📁 الرومات', value: `${guild.channels.cache.size} روم`, inline: true },
                    { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

            await interaction.reply({ embeds: [serverEmbed] });
        }
    }

    // 2. التعامل مع الأزرار (Buttons)
    else if (interaction.isButton()) {
        const customId = interaction.customId;

        // أزرار لوحة الإرسال
        if (customId === 'btn_send_channel') {
            const modal = new ModalBuilder()
                .setCustomId('modal_send_channel')
                .setTitle('إرسال رسالة إلى روم معين');

            const channelIdInput = new TextInputBuilder()
                .setCustomId('channel_id')
                .setLabel('أدخل آي دي الروم (Channel ID)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const messageInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('محتوى الرسالة (Embed)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(channelIdInput), new ActionRowBuilder().addComponents(messageInput));
            return interaction.showModal(modal);
        }

        else if (customId === 'btn_send_dm') {
            const modal = new ModalBuilder()
                .setCustomId('modal_send_dm')
                .setTitle('إرسال رسالة خاصة (DM)');

            const userIdInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('أدخل آي دي العضو (User ID)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const messageInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('محتوى الرسالة الخاصة')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userIdInput), new ActionRowBuilder().addComponents(messageInput));
            return interaction.showModal(modal);
        }

        // نظام التذاكر المطور
        else if (customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setTitle(`🎫 تذكرة العضو: ${user.username}`)
                    .setDescription(`أهلاً بك **${user.username}**!\nفضلاً اشرح مشكلتك أو طلبك، وسيتم الرد عليك قريباً من قبل الإدارة.\n\n*الرجاء استخدام الأزرار أدناه للتحكم بالتذكرة.*`)
                    .setColor(0x5865F2)
                    .setTimestamp()
                    .setFooter({ text: 'EM7 Advanced Tickets', iconURL: client.user.displayAvatarURL() });

                const ticketControls = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_ticket')
                        .setLabel('🙋‍♂️ استلام التذكرة')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 إغلاق التذكرة')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ content: `<@${user.id}>`, embeds: [ticketEmbed], components: [ticketControls] });
                return interaction.reply({ content: `✅ تم فتح تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

            } catch (err) {
                console.error(err);
                return interaction.reply({ content: '❌ حدث خطأ، تأكد من صلاحيات البوت.', ephemeral: true });
            }
        }

        else if (customId === 'claim_ticket') {
            const staff = interaction.user;
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .addFields({ name: '🛠️ تم استلام التذكرة بواسطة', value: `<@${staff.id}>`, inline: false });
            
            await interaction.update({ embeds: [embed] });
            await interaction.followUp({ content: `✅ قام الإداري <@${staff.id}> باستلام هذه التذكرة.` });
        }

        else if (customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 جاري إغلاق التذكرة وحذفها خلال 5 ثواني...', ephemeral: true });
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    }

    // 3. التعامل مع النماذج (Modals) لإدخال الرسائل
    else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_send_channel') {
            const channelId = interaction.fields.getTextInputValue('channel_id');
            const messageText = interaction.fields.getTextInputValue('message_text');

            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) {
                return interaction.reply({ content: '❌ آي دي الروم غير صحيح أو أن البوت لا يراه!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setDescription(messageText)
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

            const inviteButton = new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('🔗 انضم إلى السيرفر')
                .setURL('https://discord.gg/qqKG4W6WK');
            const row = new ActionRowBuilder().addComponents(inviteButton);

            await targetChannel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: `✅ تم إرسال الـ Embed بنجاح إلى الروم <#${channelId}>!`, ephemeral: true });
        }

        else if (interaction.customId === 'modal_send_dm') {
            const userId = interaction.fields.getTextInputValue('user_id');
            const messageText = interaction.fields.getTextInputValue('message_text');

            try {
                const targetUser = await client.users.fetch(userId);
                const embed = new EmbedBuilder()
                    .setDescription(messageText)
                    .setColor(0x5865F2)
                    .setTimestamp()
                    .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

                const inviteButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('🔗 انضم إلى السيرفر')
                    .setURL('https://discord.gg/qqKG4W6WK');
                const row = new ActionRowBuilder().addComponents(inviteButton);

                await targetUser.send({ embeds: [embed], components: [row] });
                return interaction.reply({ content: `✅ تم إرسال الرسالة الخاصة بنجاح لـ **${targetUser.tag}**!`, ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: '❌ الآي دي غير صحيح أو أن الشخص مقفل رسائل الخاص (DM)!', ephemeral: true });
            }
        }
    }
});

client.login(TOKEN);
