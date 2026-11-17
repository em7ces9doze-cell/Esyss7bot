'use strict';
const {AppError}=require('../core/errors');
function enforce(repos,id,dailyLimit){const now=Date.now();if(now-repos.rate.last(id)<2500)throw new AppError('انتظر قليلاً قبل الطلب التالي.','RATE_LIMIT');if(repos.usage.count(id)>=dailyLimit)throw new AppError('وصلت إلى الحد اليومي للذكاء الاصطناعي.','DAILY_LIMIT');repos.rate.set(id,now);repos.usage.inc(id);}
module.exports={enforce};
