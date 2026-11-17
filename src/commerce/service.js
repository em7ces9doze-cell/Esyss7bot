'use strict';
const PLAN_PRICES=Object.freeze({starter:5,basic:10,pro:20,ultimate:40});
const PLAN_LABELS=Object.freeze({starter:'Starter',basic:'Basic',pro:'Pro',ultimate:'Ultimate'});
const EXCHANGE_CREDITS_PER_COIN=90000000;
function createCommerce(db){
 const now=()=>new Date().toISOString();
 function ensureWallet(userId){const t=now();db.prepare('INSERT OR IGNORE INTO em7_wallets(user_id,balance,created_at,updated_at) VALUES(?,0,?,?)').run(userId,t,t);}
 function balance(userId){ensureWallet(userId);return db.prepare('SELECT balance FROM em7_wallets WHERE user_id=?').get(userId).balance;}
 function credit({userId,amount,actorId,reason}) {
  if(!Number.isSafeInteger(amount)||amount<1||amount>100000)throw new Error('قيمة العملات غير صالحة.');
  ensureWallet(userId);
  return db.transaction(()=>{
   const current=balance(userId);const next=current+amount;if(!Number.isSafeInteger(next))throw new Error('تجاوز حد الرصيد.');
   const t=now();db.prepare('UPDATE em7_wallets SET balance=?,updated_at=? WHERE user_id=?').run(next,t,userId);
   db.prepare('INSERT INTO em7_ledger(user_id,delta,balance_after,kind,reference,actor_id,details,created_at) VALUES(?,?,?,?,?,?,?,?)').run(userId,amount,next,'admin_credit',null,actorId,String(reason).slice(0,200),t);
   return next;
  })();
 }
 function buyPlan(userId,plan){
  const price=PLAN_PRICES[plan];if(!price)throw new Error('الباقة غير معروفة.');
  ensureWallet(userId);
  return db.transaction(()=>{
   const current=balance(userId);if(current<price)throw new Error('رصيدك غير كافٍ. تحتاج '+price+' EM7 Coins ورصيدك '+current+'.');
   const next=current-price;const t=now();const result=db.prepare('INSERT INTO em7_purchases(user_id,plan,coins_paid,status,created_at) VALUES(?,?,? ,?,?)').run(userId,plan,price,'pending_provisioning',t);
   db.prepare('UPDATE em7_wallets SET balance=?,updated_at=? WHERE user_id=?').run(next,t,userId);
   db.prepare('INSERT INTO em7_ledger(user_id,delta,balance_after,kind,reference,actor_id,details,created_at) VALUES(?,?,?,?,?,?,?,?)').run(userId,-price,next,'plan_purchase',String(result.lastInsertRowid),'system','Plan '+plan,t);
   return {purchaseId:Number(result.lastInsertRowid),plan,price,balance:next,status:'pending_provisioning'};
  })();
 }
 function requestCoins(userId,coins){
  if(!Number.isSafeInteger(coins)||coins<1||coins>1000)throw new Error('عدد العملات يجب أن يكون بين 1 و1000.');
  const credits=String(BigInt(coins)*BigInt(EXCHANGE_CREDITS_PER_COIN));
  const result=db.prepare("INSERT INTO em7_coin_requests(user_id,coins,probot_credits,status,created_at) VALUES(?,?,?,'pending',?)").run(userId,coins,credits,now());
  return {id:Number(result.lastInsertRowid),coins,credits};
 }
 function approveRequest(requestId,actorId){
  if(!Number.isSafeInteger(requestId)||requestId<1)throw new Error('رقم الطلب غير صالح.');
  return db.transaction(()=>{
   const req=db.prepare("SELECT * FROM em7_coin_requests WHERE id=? AND status='pending'").get(requestId);
   if(!req)throw new Error('الطلب غير موجود أو تمت مراجعته مسبقاً.');
   ensureWallet(req.user_id);
   const current=balance(req.user_id);const next=current+req.coins;if(!Number.isSafeInteger(next))throw new Error('تجاوز حد الرصيد.');
   const t=now();db.prepare('UPDATE em7_wallets SET balance=?,updated_at=? WHERE user_id=?').run(next,t,req.user_id);
   db.prepare('INSERT INTO em7_ledger(user_id,delta,balance_after,kind,reference,actor_id,details,created_at) VALUES(?,?,?,?,?,?,?,?)').run(req.user_id,req.coins,next,'probot_topup',String(requestId),actorId,'Verified ProBot transfer request #'+requestId,t);
   db.prepare("UPDATE em7_coin_requests SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").run(t,actorId,requestId);
   return {userId:req.user_id,coins:req.coins,balance:next};
  })();
 }
 function history(userId,limit=8){return db.prepare('SELECT delta,balance_after,kind,details,created_at FROM em7_ledger WHERE user_id=? ORDER BY id DESC LIMIT ?').all(userId,limit);}
 return {balance,credit,buyPlan,requestCoins,approveRequest,history,planPrices:PLAN_PRICES,planLabels:PLAN_LABELS,exchangeCreditsPerCoin:EXCHANGE_CREDITS_PER_COIN};
}
module.exports={createCommerce,PLAN_PRICES,PLAN_LABELS,EXCHANGE_CREDITS_PER_COIN};
