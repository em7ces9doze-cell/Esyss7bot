"use strict";
async function askGroq({apiKey,model,prompt}) {
 if(!apiKey) throw new Error("AI is not configured. Set GROQ_API_KEY in hosting environment variables.");
 const response=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model,messages:[{role:"system",content:"You are EM7 assistant. Be accurate, concise, and never claim to have performed Discord actions."},{role:"user",content:String(prompt).slice(0,3000)}],temperature:0.3,max_tokens:700}),signal:AbortSignal.timeout(20000)});
 if(!response.ok) throw new Error("AI provider error ("+response.status+"): "+(await response.text()).slice(0,250));
 const data=await response.json(); return data.choices?.[0]?.message?.content?.trim()||"لم يصل رد من مزود الذكاء الاصطناعي.";
}
module.exports = { askGroq };
