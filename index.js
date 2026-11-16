const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

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

// تعريف الأوامر
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('يعرض سرعة استجابة البوت (البينج)'),
    
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('نظام إرسال رسائل احترافي (Embed) للعام أو للخاص مع خيارات متقدمة')
        .addStringOption(option => 
            option.setName('target')
                .setDescription('مكان الإرسال: الشات الحالي (channel) أو خاص لشخص (dm)')
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
                .setDescription('استهداف شخص معين (يوزر) إذا اخترت إرسال خاص أو منشن بالشات')
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
        .addStringOption(option => 
            option.setName('link')
                .setDescription('رابط سيرفر أو موقع لإضافته (اختياري)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('bots-status')
        .setDescription('فحص حالة الاتصال والبينج للبوتات الأخرى في السيرفر')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[LOG] Emsys7 is online! Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// الردود التلقائية والحماية
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

// التفاعل مع الأوامر
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong! سرعة الاستجابة: **${Math.abs(latency)}ms**`);
    }

    else if (commandName === 'bots-status') {
        await interaction.deferReply();
        
        // جلب أعضاء السيرفر لمعرفة البوتات الموجودة
        await interaction.guild.members.fetch();
        const bots = interaction.guild.members.cache.filter(member => member.user.bot);

        let statusText = `🤖 **حالة البوتات في سيرفر ${interaction.guild.name}:**\n\n`;
        
        bots.forEach(bot => {
            let statusEmoji = '🟢'; // افتراضي متصل
            statusText += `${statusEmoji} **${bot.user.username}** (ID: \`${bot.id}\`)\n`;
        });

        const statusEmbed = new EmbedBuilder()
            .setTitle('📡 لوحة حالة اتصال البوتات')
            .setDescription(statusText)
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [statusEmbed] });
    }

    else if (commandName === 'say') {
        const targetType = interaction.options.getString('target');
        const textMessage = interaction.options.getString('message');
        const userMention = interaction.options.getUser('user');
        const userIdInput = interaction.options.getString('user_id');
        const embedTitle = interaction.options.getString('title');
        const imageUrl = interaction.options.getString('image_url');
        const linkUrl = interaction.options.getString('link');

        // تعديل الـ Footer بحيث يظهر اسم EM7 وصورة البوت فقط بدون اسمك
        const embed = new EmbedBuilder()
            .setDescription(textMessage)
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'EM7', iconURL: client.user.displayAvatarURL() });

        if (embedTitle) embed.setTitle(embedTitle);
        if (imageUrl) embed.setImage(imageUrl);
        if (linkUrl) embed.setURL(linkUrl);

        let targetUser = null;
        if (userMention) {
            targetUser = userMention;
        } else if (userIdInput) {
            try {
                targetUser = await client.users.fetch(userIdInput);
            } catch (err) {
                return interaction.reply({ content: '❌ الـ ID الذي أدخلته غير صحيح أو أن البوت لا يراه!', ephemeral: true });
            }
        }

        try {
            if (targetType === 'dm') {
                if (!targetUser) {
                    return interaction.reply({ content: '❌ يجب عليك تحديد مستخدم (عبر يوزر أو ID) لإرسال الرسالة في الخاص!', ephemeral: true });
                }

                await targetUser.send({ embeds: [embed] });
                if (linkUrl) await targetUser.send(`🔗 رابط مرفق: ${linkUrl}`);

                await interaction.reply({ content: `✅ تم إرسال الـ Embed بنجاح إلى الخاص لـ **${targetUser.tag}**!`, ephemeral: true });

            } else {
                let finalContent = targetUser ? `<@${targetUser.id}>` : '';

                await interaction.reply({ content: '✅ جاري إرسال الرسالة...', ephemeral: true });
                await interaction.channel.send({
                    content: finalContent,
                    embeds: [embed]
                });
            }
        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: '❌ حدث خطأ، ربما يكون الشخص مقفل رسائل الخاص (DM) أو صلاحيات البوت ناقصة.', ephemeral: true });
        }
    }
});

client.login(TOKEN);
