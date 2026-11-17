'use strict';
const {toolDefinitions}=require('./tool-definitions');const {enforce}=require('../security/rate-limiter');
const SYSTEM='أنت E7 Bot، مساعد إدارة Discord. أجب بالعربية. لا تدّع تنفيذ إجراء قبل نتيجة الأداة. استخدم الأدوات المحددة فقط. لا تطلب أو تكشف الأسرار. لا تشغل أوامر نظام أو شيفرات.';
async function ask({prompt,userId,guild,groq,executor,repositories,config}){
 enforce(repositories,userId,config.dailyAiLimit);
 const messages=[{role:'system',content:SYSTEM},...repositories.memory.get(userId),{role:'user',content:prompt}];
 for(let n=0;n<config.maxToolRounds;n++){
  const m=await groq.complete(messages,toolDefinitions);messages.push(m);
  if(!m.tool_calls?.length){const answer=m.content||'لم يصل رد نصي.';repositories.memory.set(userId,[...messages.slice(1),{role:'assistant',content:answer}]);return answer;}
  for(const call of m.tool_calls){let result;try{result=await executor.run(call.function.name,JSON.parse(call.function.arguments||'{}'),guild,userId);}catch(e){result={ok:false,error:e.message};}
   messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)});
  }
 }
 return 'وصلت إلى حد خطوات التنفيذ. قسّم الطلب.';
}
module.exports={ask};
