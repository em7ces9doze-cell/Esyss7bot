'use strict';
const {AppError}=require('../core/errors');
const URL='https://api.groq.com/openai/v1/chat/completions';
function createGroqClient(cfg){return {async complete(messages,tools){
 const r=await fetch(URL,{method:'POST',headers:{Authorization:'Bearer '+cfg.groqApiKey,'Content-Type':'application/json'},body:JSON.stringify({model:cfg.groqModel,messages,tools,tool_choice:'auto',temperature:0.2,max_completion_tokens:1400}),signal:AbortSignal.timeout(45000)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new AppError('Groq API: '+(data.error?.message||r.status),'GROQ_ERROR');
 if(!data.choices?.[0]?.message)throw new AppError('استجابة Groq غير مكتملة.');return data.choices[0].message;
}};}
module.exports={createGroqClient};
