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

// الرتب المسموح لها استخدام الأوامر الإدارية والبوت
const ALLOWED_ROLES = ['1570880065426952303', '1570873121056227329'];

function hasAdminPermission(member) {
    if (!member) return false;
    // إذا كان صاحب السيرفر أو معه إحدى الرتب المحددة
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return member.roles.cache.some(role => ALLOWED_ROLES.includes(role.id));
}

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('يعرض سرعة استجابة البوت بدقة فائقة'),
    
    new SlashCommandBuilder()
        .setName('bots-status')
        .setDescription('فحص حالة الاتصال الحقيقية للبوتات في السيرفر'),

    new SlashCommandBuilder()
        .setName('server-info')
        .setDescription('عرض معلومات تفصيلية واحترافية عن السيرفر الحالي'),

    new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('إرسال لوحة التذاكر المطور في الروم الحالي (للإدارة فقط)'),

    new SlashCommandBuilder()
        .setName('send')
        .setDescription('لوحة إرسال الرسائل المتقدمة (لروم معين أو رسالة خاصة مع حفظها بروم سري)'),
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

// حماية الروابط والسبام
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

// التعامل مع التفاعلات والأوامر
client.on('interactionCreate', async interaction => {
    
    // 1. الأوامر (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'ping') {
            const latency = Date.now() - interaction.createdTimestamp;
            const pingEmbed = new EmbedBuilder()
                .setTitle('🏓 سرعة استجابة النظام')
                .setDescription(`البينج الحالي للبوت: **${Math.abs(latency)}ms** ⚡`)
                .setColor(0x00FF99)
                .setTimestamp()
                .setFooter({ text: 'EM7 Network', iconURL: client.user.displayAvatarURL() });

            await interaction.reply({ embeds: [pingEmbed], ephemeral: true });
        }

        else if (commandName === 'send') {
            if (!hasAdminPermission(interaction.member)) {
                return interaction.reply({ content: '❌ عذراً، هذا الأمر مخصص لأصحاب الرتب الإدارية المحددة فقط!', ephemeral: true });
            }

            const panelEmbed = new EmbedBuilder()
                .setTitle('📤 لوحة تحكم الإرسال والرسائل الذكية')
                .setDescription('اختر الطريقة المناسبة لإرسال رسالتك الاحترافية عبر الأزرار أدناه:\n\n🔹 **إرسال روم**: لإرسال رسالة Embed فخمة لروم محدد عبر الآي دي.\n🔹 **رسالة خاصة (DM)**: لإرسال رسالة خاصة لعضو مع توثيقها تلقائياً في روم **(رسائل-سرية)**.')
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'EM7 Dispatcher', iconURL: client.user.displayAvatarURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_send_channel')
                    .setLabel('💬 إرسال روم')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('btn_send_dm')
                    .setLabel('✉️ رسالة خاصة (سري)')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [panelEmbed], components: [row], ephemeral: true });
        }

        else if (commandName === 'setup-ticket') {
            if (!hasAdminPermission(interaction.member)) {
                return interaction.reply({ content: '❌ عذراً، هذا الأمر مخصص للإدارة المعتمدة فقط!', ephemeral: true });
            }

            const ticketEmbed = new EmbedBuilder()
                .setTitle('🎫 نظام الدعم الفني والتذاكر الاحترافي')
                .setDescription('إذا كان لديك أي استفسار، مشكلة، أو تريد التواصل مع الإدارة بشكل سري:\n\n**اضغط على الزر أدناه لفتح تذكرة خاصة بك فوراً.**')
                .setColor(0xF1C40F)
                .setTimestamp()
                .setFooter({ text: 'EM7 Support Security', iconURL: client.user.displayAvatarURL() });

            const ticketRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('🎫 فتح تذكرة جديدة')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({ embeds: [ticketEmbed], components: [ticketRow] });
            await interaction.reply({ content: '✅ تم إنشاء لوحة التذاكر الفخمة بنجاح!', ephemeral: true });
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
                .setTitle('📡 لوحة مراقبة البوتات والواقعية')
                .setDescription(statusText)
                .setColor(0x00AE86)
                .setTimestamp()
                .setFooter({ text: 'EM7 Monitoring', iconURL: client.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [statusEmbed] });
        }

        else if (commandName === 'server-info') {
            const guild = interaction.guild;
            const owner = await guild.fetchOwner();
            const serverEmbed = new EmbedBuilder()
                .setTitle(`📊 تقرير سيرفر: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setColor(0xF1C40F)
                .addFields(
                    { name: '👑 مالك السيرفر', value: `<@${owner.id}>`, inline: true },
                    { name: '👥 إجمالي الأعضاء', value: `${guild.memberCount} عضو`, inline: true },
                    { name: '🔒 الرتب المتاحة', value: `${guild.roles.cache.size} رتبة`, inline: true },
                    { name: '📁 الرومات الإجمالية', value: `${guild.channels.cache.size} روم`, inline: true },
                    { name: '📅 تاريخ التأسيس', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'EM7 Analytics', iconURL: client.user.displayAvatarURL() });

            await interaction.reply({ embeds: [serverEmbed] });
        }
    }

    // 2. الأزرار (Buttons)
    else if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId === 'btn_send_channel') {
            const modal = new ModalBuilder()
                .setCustomId('modal_send_channel')
                .setTitle('إرسال رسالة احترافية لروم');

            const channelIdInput = new TextInputBuilder()
                .setCustomId('channel_id')
                .setLabel('آي دي الروم المستهدف (Channel ID)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const messageInput = new TextInputBuilder()
                .setCustomId('message_text')
                .setLabel('محتوى رسالة الـ Embed')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(channelIdInput), new ActionRowBuilder().addComponents(messageInput));
            return interaction.showModal(modal);
        }

        else if (customId === 'btn_send_dm') {
            const modal = new ModalBuilder()
                .setCustomId('modal_send_dm')
                .setTitle('إرسال رسالة خاصة وحفظها بسرية');

            const userIdInput = new TextInputBuilder()
                .setCustomId('user_id')
                .setLabel('آي دي العضو المستهدف (User ID)')
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
                    .setDescription(`أهلاً بك **${user.username}**!\nفضلاً اشرح مشكلتك بالتفصيل، وسيتم الرد عليك من قبل فريق الإدارة قريباً.\n\n*استخدم الأزرار أدناه للتحكم بمسار التذكرة.*`)
                    .setColor(0x5865F2)
                    .setTimestamp()
                    .setFooter({ text: 'EM7 Tickets Control', iconURL: client.user.displayAvatarURL() });

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
                return interaction.reply({ content: `✅ تم فتح تذكرتك الخاصة بنجاح: ${ticketChannel}`, ephemeral: true });

            } catch (err) {
                console.error(err);
                return interaction.reply({ content: '❌ حدث خطأ، تأكد من صلاحيات البوت الإدارية.', ephemeral: true });
            }
        }

        else if (customId === 'claim_ticket') {
            const staff = interaction.user;
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .addFields({ name: '🛠️ تم استلام التذكرة بواسطة المشرف', value: `<@${staff.id}>`, inline: false });
            
            await interaction.update({ embeds: [embed] });
            await interaction.followUp({ content: `✅ قام الإداري <@${staff.id}> باستلام هذه التذكرة لمتابعتها.` });
        }

        else if (customId === 'close_ticket') {
            await interaction.reply({ content: '🔒 جاري إغلاق التذكرة وحذف الروم خلال 5 ثواني...', ephemeral: true });
            setTimeout(() => {
                interaction.channel.delete().catch(() => {});
            }, 5000);
        }
    }

    // 3. النماذج (Modals)
    else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_send_channel') {
            const channelId = interaction.fields.getTextInputValue('channel_id');
            const messageText = interaction.fields.getTextInputValue('message_text');

            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) {
                return interaction.reply({ content: '❌ آي دي الروم غير صحيح أو غير مرئي للبوت!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setDescription(messageText)
                .setColor(0x5865F2)
                .setTimestamp()
                .setFooter({ text: 'EM7 Official', iconURL: client.user.displayAvatarURL() });

            const inviteButton = new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('🔗 انضم إلى السيرفر')
                .setURL('https://discord.gg/qqKG4W6WK');
            const row = new ActionRowBuilder().addComponents(inviteButton);

            await targetChannel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: `✅ تم إرسال الـ Embed بنجاح للروم <#${channelId}>!`, ephemeral: true });
        }

        else if (interaction.customId === 'modal_send_dm') {
            const userId = interaction.fields.getTextInputValue('user_id');
            const messageText = interaction.fields.getTextInputValue('message_text');

            try {
                const targetUser = await client.users.fetch(userId);
                const embed = new EmbedBuilder()
                    .setTitle('📩 رسالة خاصة إدارية')
                    .setDescription(messageText)
                    .setColor(0x9B59B6)
                    .setTimestamp()
                    .setFooter({ text: 'EM7 Secure DM', iconURL: client.user.displayAvatarURL() });

                const inviteButton = new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('🔗 انضم إلى السيرفر')
                    .setURL('https://discord.gg/qqKG4W6WK');
                const row = new ActionRowBuilder().addComponents(inviteButton);

                // إرسال الرسالة الخاصة للعضو
                await targetUser.send({ embeds: [embed], components: [row] });

                // البحث عن روم "رسائل-سرية" أو إنشائه تلقائياً في السيرفر
                let secretChannel = interaction.guild.channels.cache.find(ch => ch.name === 'رسائل-سرية');
                if (!secretChannel) {
                    secretChannel = await interaction.guild.channels.create({
                        name: 'رسائل-سرية',
                        type: ChannelType.GuildText,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // مخفي عن الأعضاء العاديين
                            { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ]
                    }).catch(() => {});
                }

                // إذا وُجد الروم، يتم توثيق وحفظ نسخة من الإمبد والرسالة فيه
                if (secretChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('🔒 أرشيف رسالة خاصة مرسلة')
                        .setDescription(`**المُرسِل الإداري:** <@${interaction.user.id}>\n**المستهدف:** <@${targetUser.id}> (\`${targetUser.id}\`)\n\n**محتوى الرسالة:**\n${messageText}`)
                        .setColor(0xE74C3C)
                        .setTimestamp()
                        .setFooter({ text: 'EM7 Secret Archive', iconURL: client.user.displayAvatarURL() });

                    await secretChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }

                return interaction.reply({ content: `✅ تم إرسال الرسالة الخاصة بنجاح لـ **${targetUser.tag}** وتوثيقها في روم **رسائل-سرية**!`, ephemeral: true });
            } catch (err) {
                console.error(err);
                return interaction.reply({ content: '❌ الآي دي المدخل غير صحيح، أو أن العضو مقفل رسائل الخاص (DM)!', ephemeral: true });
            }
        }
    }
});

client.login(TOKEN);
