# EM7 SYSTEM

نسخة أساسية نظيفة لبوت Discord بنظام Node.js 22 وDiscord.js 14.

## التشغيل
1. استخدم Node.js 22 أو أحدث.
2. نفّذ npm install.
3. أضف DISCORD_TOKEN وCLIENT_ID وOWNER_ID في متغيرات الاستضافة. لا ترفع ملف .env.
4. أضف GUILD_ID للتسجيل السريع داخل سيرفر اختبار.
5. نفّذ npm run deploy مرة واحدة لتسجيل أوامر Slash.
6. شغّل npm start.

## الأوامر
/e7 help, status, balance, shop, buy-plan, request-coins, ledger, requests, approve-request, credit, test-room, ask.

## التخزين والشراء
SQLite مع WAL وعمليات معاملات. طلبات شحن الرصيد لا تضيف عملات إلا بعد موافقة المالك. الشراء يسجل طلب تجهيز بحالة pending_provisioning؛ لا يوجد اتصال فعلي بمنصة استضافة ولا يتم إنشاء بوت مستضاف تلقائياً في هذه النسخة.

## الأمان
- لا تضع أي Token أو API key في الكود أو GitHub.
- احفظ الأسرار في Environment Variables لدى FadeHost.
- صلاحيات الإدارة مقيدة بـ OWNER_ID ولا توجد أوامر shell أو تنفيذ JavaScript عن بُعد.
- لا تمنح البوت Administrator؛ امنحه أقل الصلاحيات اللازمة.

## التحقق
نفّذ npm run check ثم npm test. لا تعتبر البوت منشوراً أو مختبراً على Discord حتى تشغيله فعلياً في بيئة الاستضافة.
