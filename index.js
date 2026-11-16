
const geminiReady = import("@google/genai").then(({ GoogleGenAI }) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing");
  }

  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
});

const aiSessions = new Map();
const aiCooldowns = new Map();

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.8-flash";

const EM7_SYSTEM_PROMPT = `
أنت EM7 AI، المساعد الذكي الرسمي لنظام EM7 SYS.

تخصصك:
- حماية سيرفرات Discord.
- إدارة الرتب والقنوات والصلاحيات.
- تحليل أخطاء البوتات وسجلاتها.
- مساعدة الإدارة في تنظيم السيرفر.
- تقديم حلول تقنية دقيقة.

قواعدك:
1. تحدث باللغة العربية بوضوح واحترافية.
2. افهم الطلب قبل اقتراح الحل.
3. لا تدّعِ أنك نفذت أي إجراء لم تنفذه فعلياً.
4. لا تخترع معلومات عن السيرفر أو البوتات.
5. لا تطلب من المستخدم إرسال كلمات المرور أو التوكنات.
6. العمليات الحساسة تتطلب موافقة واضحة.
7. في هذه المرحلة أنت للمحادثة والتحليل فقط.
`;

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot || !message.guild) return;

    // الاستجابة داخل روم الحماية فقط
    if (
      message.channelId !==
      process.env.EM7_SECURITY_CHANNEL_ID
    ) return;

    // السماح للإدارة فقط
    const permissions = message.member?.permissions;

    const isAdmin =
      permissions?.has("Administrator") ||
      permissions?.has("ManageGuild");

    if (!isAdmin) return;

    const prompt = message.content.trim();

    if (!prompt) return;

    if (prompt.length > 2000) {
      return message.reply("الرسالة طويلة جداً. اختصر طلبك.");
    }

    // تحديد معدل الاستخدام
    const now = Date.now();
    const lastUsed = aiCooldowns.get(message.author.id) || 0;

    if (now - lastUsed < 6000) {
      return message.reply("انتظر قليلاً قبل إرسال طلب آخر.");
    }

    aiCooldowns.set(message.author.id, now);

    await message.channel.sendTyping();

    const ai = await geminiReady;

    let chat = aiSessions.get(message.author.id);

    if (!chat) {
      chat = ai.chats.create({
        model: GEMINI_MODEL,
        config: {
          systemInstruction: EM7_SYSTEM_PROMPT,
          temperature: 0.4,
          maxOutputTokens: 1200
        }
      });

      aiSessions.set(message.author.id, chat);
    }

    const result = await chat.sendMessage({
      message: prompt
    });

    const answer =
      result.text || "لم أتمكن من إنشاء رد.";

    // تقسيم الرد إذا تجاوز حد Discord
    for (let i = 0; i < answer.length; i += 1900) {
      await message.reply({
        content: answer.slice(i, i + 1900),
        allowedMentions: { parse: [] }
      });
    }

  } catch (error) {
    console.error("EM7 AI ERROR:", error);

    await message.reply(
      "حدث خطأ أثناء الاتصال بـ EM7 AI. راجع سجلات الاستضافة."
    ).catch(() => {});
  }
});
