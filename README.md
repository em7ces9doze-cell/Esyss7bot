# EM7 SYSTEM × EM7 HOST

بوت Discord مبني على Node.js 22+ وDiscord.js 14، مرتبط بمنصة [EM7 HOST](https://em7host-nvenijcy.manus.space).

## التشغيل والنشر
1. استخدم Node.js 22 أو أحدث.
2. نفّذ `npm install`.
3. أضف المتغيرات المطلوبة في إعدادات FadeHost: `DISCORD_TOKEN`, `CLIENT_ID`, `OWNER_ID`.
4. أضف `GUILD_ID` للتسجيل داخل سيرفر الاختبار (اختياري لكنه أسرع).
5. نفّذ `npm run check` ثم `npm test`.
6. نفّذ `npm run deploy` لتحديث أوامر Slash.
7. شغّل `npm start`.

لا تضع أي Token أو API key في GitHub أو داخل ملفات المشروع.

## أوامر الأعضاء
- `/e7 help` — دليل الأوامر.
- `/e7 website` — رابط EM7 HOST.
- `/e7 plans` و`/e7 shop` — الباقات الرسمية من الموقع.
- `/e7 buy-plan` — اختيار الباقة ثم متابعة الطلب في الموقع.
- `/e7 balance`, `/e7 request-coins`, `/e7 ledger` — محفظة EM7 Coins.
- `/e7 status` — حالة البوت.
- `/e7 ask` — مساعد EM7 AI (يتطلب GROQ_API_KEY).

## أوامر المالك
- `/e7 admin-panel` — لوحة الإدارة.
- `/e7 host-room` — إنشاء أو تحديث قناة `#host-em7` ورسالة التعريف دون تكرار الرسائل.
- `/e7 requests`, `/e7 approve-request`, `/e7 credit` — إدارة العملات.
- `/e7 test-room` — إنشاء قناة اختبار خاصة.

## التكامل مع EM7 HOST
- رابط الموقع الرسمي مضبوط في البوت: https://em7host-nvenijcy.manus.space
- البوت لا يعرض سعات أو أسعار غير مؤكدة؛ صفحة الباقات في الموقع هي المرجع.
- `/e7 buy-plan` لا يخصم العملات ولا ينشئ استضافة تلقائيًا. تفعيل الاستضافة يتطلب تكامل provisioning موثقًا بين الموقع والبوت.
- EM7 Coins مستقلة حاليًا عن مشتريات الاستضافة.

## الأمان والتخزين
- صلاحيات الإدارة تعتمد على `OWNER_ID`.
- لا تمنح البوت صلاحية Administrator؛ امنحه أقل الصلاحيات اللازمة.
- لإنشاء أو تحديث قناة `#host-em7` يحتاج البوت: Manage Channels, View Channel, Send Messages, Embed Links, Read Message History.
- بيانات المحافظ وسجل العملات مخزنة في SQLite مع WAL وعمليات معاملات.
- سجلات الإدارة تسجل الإجراءات الحساسة، ولا تسجل مفاتيح أو Tokens.

## التحقق
نفّذ `npm run check` و`npm test`. نجاح الفحوص البرمجية لا يثبت أن البوت نُشر أو أن أوامر Discord تعمل فعليًا؛ يلزم اختبارها في سيرفر الاختبار بعد النشر.
