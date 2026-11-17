# EM7 SYSTEM V6

نسخة نظيفة من نظام EM7 SYSTEM. تعمل على Node.js 22 وDiscord.js 14 مع SQLite.

## التثبيت
1. npm install
2. أضف متغيرات البيئة من ملف .env.example إلى إعدادات الاستضافة.
3. npm run deploy
4. npm start

## الأوامر
/e7 help - المساعدة
/e7 status - الحالة
/e7 balance - رصيد العملات
/e7 shop - الباقات
/e7 buy-plan - شراء باقة تجريبية
/e7 request-coins - طلب شحن يدوي
/e7 ledger - سجل المعاملات
/e7 requests - طلبات الشحن للمالك
/e7 approve-request - اعتماد بعد التحقق للمالك
/e7 credit - إضافة موثقة للمالك
/e7 test-room - غرفة اختبار خاصة للمالك
/e7 ask - مساعد Groq اختياري

أسعار الباقات تجريبية: Starter 5، Basic 10، Pro 20، Ultimate 40 EM7 Coins.
سعر التحويل التجريبي: 90,000,000 ProBot Credits لكل عملة.
الشراء يسجل طلبًا بحالة pending_provisioning ولا ينشئ استضافة تلقائيًا.
لا تعتمد أي شحنة تلقائيًا من صورة أو رسالة. تحقق يدويًا قبل اعتمادها.

لا تحفظ أي توكن أو مفتاح API في GitHub. ضع DISCORD_TOKEN وGROQ_API_KEY في Environment Variables على FadeHost.