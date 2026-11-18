"use strict";
const MAX_COINS = 100000000;
function createCommerce(db) {
 const wallet = db.prepare("SELECT balance FROM wallets WHERE user_id = ?");
 const ensureWallet = db.prepare("INSERT OR IGNORE INTO wallets(user_id,balance) VALUES(?,0)");
 const addLedger = db.prepare("INSERT INTO ledger(user_id,delta,balance_after,reason,actor_id) VALUES(?,?,?,?,?)");
 const audit = db.prepare("INSERT INTO audit_log(actor_id,action,details) VALUES(?,?,?)");
 function balance(userId) { return wallet.get(userId)?.balance ?? 0; }
 const creditTx = db.transaction((userId, amount, reason, actorId) => { if (!Number.isSafeInteger(amount)||amount<=0||amount>MAX_COINS) throw new Error("Invalid coin amount"); ensureWallet.run(userId); const current=balance(userId); if(current+amount>MAX_COINS) throw new Error("Wallet balance limit exceeded"); db.prepare("UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").run(current+amount,userId); addLedger.run(userId,amount,current+amount,reason,actorId); audit.run(actorId,"wallet.credit",JSON.stringify({userId,amount,reason})); return current+amount; });
 const debitTx = db.transaction((userId,amount,reason,actorId) => { if(!Number.isSafeInteger(amount)||amount<=0) throw new Error("Invalid coin amount"); ensureWallet.run(userId); const current=balance(userId); if(current<amount) throw new Error("Insufficient balance"); db.prepare("UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").run(current-amount,userId); addLedger.run(userId,-amount,current-amount,reason,actorId); audit.run(actorId,"wallet.debit",JSON.stringify({userId,amount,reason})); return current-amount; });
 const requestTx = db.transaction((userId,amount,note) => { if(!Number.isSafeInteger(amount)||amount<1||amount>1000000) throw new Error("Amount must be between 1 and 1,000,000"); const result=db.prepare("INSERT INTO topup_requests(user_id,amount,note) VALUES(?,?,?)").run(userId,amount,String(note).slice(0,300)); return Number(result.lastInsertRowid); });
 const approveTx = db.transaction((requestId,ownerId) => { const request=db.prepare("SELECT * FROM topup_requests WHERE id=?").get(requestId); if(!request||request.status!=="pending") throw new Error("Request not found or already reviewed"); ensureWallet.run(request.user_id); const current=balance(request.user_id); if(current+request.amount>MAX_COINS) throw new Error("Wallet balance limit exceeded"); db.prepare("UPDATE wallets SET balance=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").run(current+request.amount,request.user_id); addLedger.run(request.user_id,request.amount,current+request.amount,"Approved top-up #"+requestId,ownerId); const changed=db.prepare("UPDATE topup_requests SET status='approved',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").run(ownerId,requestId); if(changed.changes!==1) throw new Error("Request was already reviewed"); audit.run(ownerId,"topup.approve",JSON.stringify({requestId,userId:request.user_id,amount:request.amount})); return {userId:request.user_id,amount:request.amount,balance:current+request.amount}; });
 const rejectTx = db.transaction((requestId,ownerId,reason) => {
  const request = db.prepare("SELECT * FROM topup_requests WHERE id=?").get(requestId);
  if (!request || request.status !== "pending") throw new Error("Request not found or already reviewed");
  const changed = db.prepare("UPDATE topup_requests SET status='rejected',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'").run(ownerId,requestId);
  if (changed.changes !== 1) throw new Error("Request was already reviewed");
  audit.run(ownerId,"topup.reject",JSON.stringify({requestId,userId:request.user_id,amount:request.amount,reason:String(reason).slice(0,200)}));
  return {userId:request.user_id,amount:request.amount,reason:String(reason).slice(0,200)};
 });

 const listAudit = (limit=15) => db.prepare("SELECT id,actor_id,action,details,created_at FROM audit_log ORDER BY id DESC LIMIT ?").all(Math.min(Math.max(limit,1),50));
 const adminSummary = () => ({
  wallets: db.prepare("SELECT COUNT(*) AS users, COALESCE(SUM(balance),0) AS coins FROM wallets").get(),
  pendingTopups: db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM topup_requests WHERE status='pending'").get(),
  approvedTopups: db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS amount FROM topup_requests WHERE status='approved'").get()
 });
 return { balance, credit:creditTx, debit:debitTx, requestTopup:requestTx, approveTopup:approveTx, rejectTopup:rejectTx, adminSummary, listAudit, listPending:(limit=10)=>db.prepare("SELECT id,user_id,amount,note,created_at FROM topup_requests WHERE status='pending' ORDER BY id LIMIT ?").all(Math.min(Math.max(limit,1),50)), ledger:(userId,limit=10)=>db.prepare("SELECT id,delta,balance_after,reason,created_at FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT ?").all(userId,Math.min(Math.max(limit,1),25)) };
}
module.exports = { createCommerce };
