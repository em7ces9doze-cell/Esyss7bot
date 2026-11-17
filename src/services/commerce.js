'use strict';
const PRICES=Object.freeze({starter:5,basic:10,pro:20,ultimate:40});
const CREDITS=90000000n;
function createCommerce(db){
 const now=()=>new Date().toISOString();
 function ensure(id){const t=now();db.prepare('INSERT OR IGNORE INTO wallets(user_id,balance,created_at,updated_at) VALUES(?,0,?,?)').run(id,t,t);}
 function balance(id){ensure(id);return db.prepare('SELECT balance FROM wallets WHERE user_id=?').get(id).balance;}
 function addCoins({userId,amount,actorId,reason}){
  if(!Number.isSafeInteger(amount)||amount<1||amount>100000)throw Error('قيمة العملات غير صالحة.');
  ensure(userId);
  return db.transaction(()=>{const next=balance(userId)+amount;if(!Number.isSafeInteger(next))throw Error('تجاوز حد الرصيد.');
   const t=now();db.prepare('UPDATE wallets SET balance=?,updated_at=? WHERE user_id=?').run(next,t,userId);
   db.prepare('INSERT INTO ledger(user_id,delta,balance_after,kind,actor_id,details,created_at) VALUES(?,?,?,?,?,?,?)').run(userId,amount,next,'admin_credit',actorId,String(reason).slice(0,200),t);
   db.prepare('INSERT INTO audit_log(actor_id,action,target_id,details,created_at) VALUES(?,?,?,?,?)').run(actorId,'coin_credit',userId,String(reason).slice(0,200),t);return next;})();
 }
 function requestCoins(userId,coins){if(!Number.isSafeInteger(coins)||coins<1||coins>1000)throw Error('العدد يجب أن يكون بين 1 و1000.');const credits=String(BigInt(coins)*CREDITS);const r=db.prepare("INSERT INTO coin_requests(user_id,coins,credits,status,created_at) VALUES(?,?,?,'pending',?)").run(userId,coins,credits,now());return{id:Number(r.lastInsertRowid),coins,credits};}
 function approveRequest(id,actorId){return db.transaction(()=>{const q=db.prepare("SELECT * FROM coin_requests WHERE id=? AND status='pending'").get(id);if(!q)throw Error('الطلب غير موجود أو سبق اعتماده.');ensure(q.user_id);const next=balance(q.user_id)+q.coins,t=now();db.prepare("UPDATE coin_requests SET status='approved',reviewed_at=?,reviewed_by=? WHERE id=? AND status='pending'").run(t,actorId,id);db.prepare('UPDATE wallets SET balance=?,updated_at=? WHERE user_id=?').run(next,t,q.user_id);db.prepare('INSERT INTO ledger(user_id,delta,balance_after,kind,reference,actor_id,details,created_at) VALUES(?,?,?,?,?,?,?,?)').run(q.user_id,q.coins,next,'topup',String(id),actorId,'Manually verified',t);db.prepare('INSERT INTO audit_log(actor_id,action,target_id,details,created_at) VALUES(?,?,?,?,?)').run(actorId,'approve_topup',q.user_id,'request='+id,t);return{userId:q.user_id,coins:q.coins,balance:next};})();}
 function buyPlan(userId,plan){const price=PRICES[plan];if(!price)throw Error('الباقة غير معروفة.');ensure(userId);return db.transaction(()=>{const before=balance(userId);if(before<price)throw Error('رصيدك غير كافٍ. تحتاج '+price+' عملات.');const next=before-price,t=now();const r=db.prepare('INSERT INTO purchases(user_id,plan,coins_paid,status,created_at) VALUES(?,?,?, ?,?)').run(userId,plan,price,'pending_provisioning',t);db.prepare('UPDATE wallets SET balance=?,updated_at=? WHERE user_id=?').run(next,t,userId);db.prepare('INSERT INTO ledger(user_id,delta,balance_after,kind,reference,actor_id,details,created_at) VALUES(?,?,?,?,?,?,?,?)').run(userId,-price,next,'plan_purchase',String(r.lastInsertRowid),'system',plan,t);return{id:Number(r.lastInsertRowid),plan,price,balance:next,status:'pending_provisioning'};})();}
 return{balance,addCoins,requestCoins,approveRequest,buyPlan,history:id=>(ensure(id),db.prepare('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 10').all(id)),pending:()=>db.prepare("SELECT * FROM coin_requests WHERE status='pending' ORDER BY id LIMIT 25").all(),prices:PRICES};
}
module.exports={createCommerce,PRICES};