const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
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
        .setDescription('يخلي البوت يكرر كلامك')
        .addStringOption(option => 
            option.setName('message').setDescription('الكلام اللي تبي البوت يقوله').setRequired(true)),

    new SlashCommandBuilder()
        .setName('game')
        .setDescription('لعبة سريعة: خمن الرقم من 1 إلى 10!')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[LOG] Emsys7 is online! Logged in as ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        // تسجيل الأوامر على مستوى ديسكورد بالكامل (Global)
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
    
    if (message.content === 'ايش وضع البوت؟' || message.content === 'من انت؟') {
        message.reply('أنا **Emsys7**، بوت السيستم الخاص فيك وجاهز لخدمة السيرفر! 🚀');
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

    else if (commandName === 'say') {
        const text = interaction.options.getString('message');
        await interaction.reply({ content: 'تم إرسال رسالتك بنجاح ✅', ephemeral: true });
        await interaction.channel.send(text);
    }

    else if (commandName === 'game') {
        const secretNumber = Math.floor(Math.random() * 10) + 1;
        
        const embed = new EmbedBuilder()
            .setTitle('🎮 لعبة تخمين الرقم - Emsys7')
            .setDescription('اخترت رقم عشوائي بين **1 و 10**.\nاكتب الرقم في الشات بسرعة أول واحد يجيبها صح يفوز!')
            .setColor(0x00AE86)
            .setFooter({ text: 'فعاليات سيرفر Emsys7' });

        await interaction.reply({ embeds: [embed] });

        const filter = response => !response.author.bot;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000 });

        collector.on('collect', m => {
            if (parseInt(m.content) === secretNumber) {
                m.reply(`🎉 كفوو يا **${m.author.username}**! صكت إجابتك صحيحة والرقم كان **${secretNumber}**!`);
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.channel.send(`⏰ انتهى الوقت! محد عرف الرقم، وكان هو: **${secretNumber}**`).catch(() => {});
            }
        });
    }
});

client.login(TOKEN);
