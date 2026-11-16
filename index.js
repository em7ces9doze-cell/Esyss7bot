const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

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

// قاعدة بيانات بسيطة مؤقتة (تخزين الفلوس بالذاكرة)
// المفتاح: userId، القيمة: عدد الكوينز (Coins)
const economyDB = new Map();

// الأوامر الأساسية لبوت المتجر والاقتصاد
const commands = [
    new SlashCommandBuilder()
        .setName('balance')
        .setDescription('التحقق من رصيدك أو رصيد أي عضو (Coins)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('العضو المراد فحص رصيده (اختياري)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('daily')
        .setDescription('استلام جائزتك اليومية من الكوينز'),

    new SlashCommandBuilder()
        .setName('shop')
        .setDescription('عرض متجر السيرفر والشراء بالكوینز'),

    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('يعرض سرعة استجابة البوت'),
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[LOG] EM7 Shop Bot is online! Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded economy (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// التعامل مع الأوامر والنظام الاقتصادي
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const userId = interaction.user.id;

    // 1. أمر الرصيد (Balance)
    if (commandName === 'balance') {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const balance = economyDB.get(targetUser.id) || 0;

        const embed = new EmbedBuilder()
            .setTitle(`💰 رصيد الحساب`)
            .setDescription(`عضو: <@${targetUser.id}>\nالرصيد الحالي: **${balance} 🪙 Coin**`)
            .setColor(0xF1C40F)
            .setTimestamp()
            .setFooter({ text: 'EM7 Economy System', iconURL: client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }

    // 2. أمر الجائزة اليومية (Daily)
    else if (commandName === 'daily') {
        // التحقق البسيط من الجائزة (يمكن تطويرها بنظام الوقت لاحقاً)
        const currentBalance = economyDB.get(userId) || 0;
        const dailyReward = 500; // مبلغ الهدية اليومية
        
        economyDB.set(userId, currentBalance + dailyReward);

        const embed = new EmbedBuilder()
            .setTitle(`🎁 الجائزة اليومية`)
            .setDescription(`مبروك يا **${interaction.user.username}**!\nاستلمت جائزتك اليومية وقدرها **${dailyReward} 🪙 Coin**!`)
            .setColor(0x2ECC71)
            .setTimestamp()
            .setFooter({ text: 'EM7 Daily Reward', iconURL: client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    }

    // 3. متجر السيرفر (Shop)
    else if (commandName === 'shop') {
        const shopEmbed = new EmbedBuilder()
            .setTitle(`🛍️ متجر سيرفر EM7 الرسمي`)
            .setDescription('أهلاً بك في متجر السيرفر! اختر المنتج الذي تبي تشتريها:\n\n' +
                          '1️⃣ **رتبة VIP مميزة** — السعر: `5000 🪙`\n' +
                          '2️⃣ **لون خاص بروم الشات** — السعر: `2000 🪙`\n' +
                          '3️⃣ **صلاحية إرسال ميديا** — السعر: `1000 🪙`\n\n' +
                          '*استخدم الأزرار أدناه للشراء (قيد التفعيل)*')
            .setColor(0x9B59B6)
            .setTimestamp()
            .setFooter({ text: 'EM7 Shop Center', iconURL: client.user.displayAvatarURL() });

        await interaction.reply({ embeds: [shopEmbed] });
    }

    else if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong! سرعة استجابة المتجر: **${Math.abs(latency)}ms**`);
    }
});

client.login(TOKEN);
