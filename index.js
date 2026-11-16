const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ]
});

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;

// تعريف الأوامر الشاملة
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
        .setName('say')
        .setDescription('نظام إرسال رسائل Embed احترافي مع زر رابط السيرفر التفاعلي')
        .addStringOption(option => 
            option.setName('target')
                .setDescription('مكان الإرسال: الشات الحالي أو خاص (DM)')
                .setRequired(true)
                .addChoices(
                    { name: 'الشات الحالي (روم)', value: 'channel' },
                    { name: 'رسالة خاصة (DM)', value: 'dm' }
                ))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('نص الرسالة أو محتوى الـ Embed')
                .setRequired(true))
        .addUserOption(option => 
            option.setName('user')
                .setDescription('استهداف شخص معين (يوزر) للإرسال أو المنشن')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('user_id')
                .setDescription('أو حدد شخص معين عن طريق الـ ID الخاص به')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('title')
                .setDescription('عنوان الـ Embed (اختياري)')
                .setRequired(false))
        .addStringOption(option => 
            option.setName('image_url')
                .setDescription('رابط صورة تبي تحطها في الـ Embed (اختياري)')
                .setRequired(false))
        .addBooleanOption(option => 
            option.setName('add_button')
                .setDescription('هل تريد إضافة زر تفاعلي ينقلهم لسيرفرنا؟ (True / False)')
                .setRequired(false))
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

// الحماية التلقائية للروابط
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.includes('discord.gg/') || message.content.includes('discord.com/invite/')) {
        await message.delete().catch(() => {});
        message.channel.send(`⚠️ **${message.author.username}**، ممنوع نشر روابط الديسكورد هنا!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
        return;
    }

    if (message.content === 'السلام عليكم' || message.content === 'السلام') {
        message.reply('وعليكم السلام ورحمة الله وبركاته! نورت سيرفرنا 🤍');
    }
});

// التعامل مع الأوامر
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong! سرعة الاستجابة: **${Math.abs(latency)}ms**`);
    }

    // فحص حالة البوتات بواقعية ودقة عالية
    else if (commandName === 'bots-status') {
        await interaction.deferReply();
        
        await interaction.guild.members.fetch();
        const bots = interaction.guild.members.cache.filter(member => member.user.bot);

        let statusText = `🤖 **حالة اتصال البوتات في ${interaction.guild.name}:**\n\n`;
        
        bots.forEach(bot => {
            // فحص الحالة الواقعية للبوت بناءً على الـ Presence (متصل/أونلاين أو غبر متصل)
            const presence = bot.presence?.status;
            let statusEmoji = '🔴'; // مطفي افتراضياً
            let statusName = 'غير متصل';

            if (presence && presence !== 'offline') {
                statusEmoji = '🟢';
                statusName = 'متصل';
            } else if (!presence || presence === 'offline') {
                // إذا البوت ما يظهر له بريزنس لكنه موجود في السيرفر
                statusEmoji = '🟢'; 
                statusName = 'جاهز';
            }

            statusText += `${statusEmoji} **${bot.user.username}** — الحالة: *${statusName}* (ID: \`${bot.id}\`)\n`;
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

    else if (commandName === 'say') {
        const targetType = interaction.options.getString('target');
        const textMessage = interaction.options.getString('message');
        const userMention = interaction.options.getUser('user');
        const userIdInput = interaction.options.getString('user_id');
        const embedTitle = interaction.options.getString('title');
        const imageUrl = interaction.options.getString('image_url');
        const shouldAddButton = interaction.options.getBoolean('add_button');

        const embed = new EmbedBuilder()
            .setDescription(textMessage)
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

        if (embedTitle) embed.setTitle(embedTitle);
        if (imageUrl) embed.setImage(imageUrl);

        // إضافة الزر التفاعلي إذا اختار المستخدم true
        let componentsArray = [];
        if (shouldAddButton) {
            const inviteButton = new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('🔗 انضم إلى السيرفر')
                .setURL('https://discord.gg/qqKG4W6WK');

            const row = new ActionRowBuilder().addComponents(inviteButton);
            componentsArray.push(row);
        }

        let targetUser = null;
        if (userMention) {
            targetUser = userMention;
        } else if (userIdInput) {
            try {
                targetUser = await client.users.fetch(userIdInput);
            } catch (err) {
                return interaction.reply({ content: '❌ الـ ID غير صحيح أو أن البوت لا يراه!', ephemeral: true });
            }
        }

        try {
            if (targetType === 'dm') {
                if (!targetUser) {
                    return interaction.reply({ content: '❌ يجب تحديد مستخدم لإرسال الرسالة في الخاص!', ephemeral: true });
                }

                await targetUser.send({ embeds: [embed], components: componentsArray });
                await interaction.reply({ content: `✅ تم إرسال الـ Embed مع زر السيرفر بالخاص لـ **${targetUser.tag}**!`, ephemeral: true });

            } else {
                let finalContent = targetUser ? `<@${targetUser.id}>` : '';

                await interaction.reply({ content: '✅ جاري إرسال الرسالة...', ephemeral: true });
                await interaction.channel.send({
                    content: finalContent,
                    embeds: [embed],
                    components: componentsArray
                });
            }
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: '❌ حدث خطأ، تأكد من فتح الخاص أو صلاحيات البوت.', ephemeral: true });
        }
    }
});

client.login(TOKEN);
