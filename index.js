const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');

// إعداد صلاحيات البوت (Intents) عشان يقدر يقرأ الرسائل والأعضاء والسيرفرات
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// عند اشتغال البوت بنجاح
client.once('ready', async () => {
    console.log(`[LOG] Emsys7 is online! Logged in as ${client.user.tag}`);

    // تسجيل الأوامر (Slash Commands)
    const commands = [
        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('يعرض سرعة استجابة البوت (البينج).'),
        
        new SlashCommandBuilder()
            .setName('say')
            .setDescription('يخلي البوت يكرر كلامك.')
            .addStringOption(option => 
                option.setName('message').setDescription('الكلام اللي تبي البوت يقوله').setRequired(true)),

        new SlashCommandBuilder()
            .setName('game')
            .setDescription('لعبة سريعة: خمن الرقم!')
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || process.env.TOKEN);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('[LOG] Successfully registered application commands.');
    } catch (error) {
        console.error(error);
    }
});

// 1. نظام الردود التلقائية والحماية البسيطة (مراقبة الشات)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // حماية مبدئية: منع الروابط الخارجية (مثلاً روابط دعوات ديسكورد أخرى)
    if (message.content.includes('discord.gg/') || message.content.includes('discord.com/invite/')) {
        // استثني المشرفين لو حاب (هنا مثال بسيط يحذف الروابط)
        await message.delete().catch(() => {});
        message.channel.send(`⚠️ **${message.author.username}**، ممنوع نشر روابط الديسكورد هنا!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        });
        return;
    }

    // ردود تلقائية سريعة
    if (message.content === 'السلام عليكم' || message.content === 'السلام') {
        message.reply('وعليكم السلام ورحمة الله وبركاته! نورت سرفرنا 🤍');
    }
    
    if (message.content === 'ايش وضع البوت؟' || message.content === 'من انت؟') {
        message.reply('أنا **Emsys7**، بوت السيستم الخاص فيك وجاهز لخدمة السيرفر! 🚀');
    }
});

// 2. نظام التفاعل مع الأوامر (Slash Commands)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // أمر البينج
    if (commandName === 'ping') {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`🏓 Pong! سرعة الاستجابة: **${Math.abs(latency)}ms**`);
    }

    // أمر الرد (Say)
    else if (commandName === 'say') {
        const text = interaction.options.getString('message');
        await interaction.reply({ content: 'تم إرسال رسالتك بنجاح ✅', ephemeral: true });
        await interaction.channel.send(text);
    }

    // 3. قسم الفعاليات والألعاب (لعبة خمن الرقم)
    else if (commandName === 'game') {
        const secretNumber = Math.floor(Math.random() * 10) + 1; // رقم من 1 إلى 10
        
        const embed = new EmbedBuilder()
            .setTitle('🎮 لعبة تخمين الرقم - Emsys7')
            .setDescription('اخترت رقم عشوائي بين **1 و 10**.\n اكتب الرقم في الشات بسرعة أول واحد يجيبها صح يفوز!')
            .setColor(0x00AE86)
            .setFooter({ text: 'فعاليات سيرفر Emsys7' });

        await interaction.reply({ embeds: [embed] });

        // استقبال الإجابة من الشات
        const filter = response => !response.author.bot;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000 }); // مدتها 15 ثانية

        collector.on('collect', m => {
            if (parseInt(m.content) === secretNumber) {
                m.reply(`🎉 كفوو يا **${m.author.username}**! صكت إجابتك صحيحة والرقم كان **${secretNumber}**!`);
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.followcano?.(`⏰ انتهى الوقت! محد عرف الرقم، وكان هو: **${secretNumber}**`).catch(() => {
                    interaction.channel.send(`⏰ انتهى الوقت! محد عرف الرقم، وكان هو: **${secretNumber}**`);
                });
            }
        });
    }
});

// تشغيل البوت عبر التوكن (يتوافق مع استضافات ديسكورد اللي تخزن التوكن كمتغير بيئي)
client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
