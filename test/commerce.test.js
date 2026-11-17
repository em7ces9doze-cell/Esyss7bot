'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {openDatabase}=require('../src/database/database');
const {createCommerce}=require('../src/commerce/service');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'em7-commerce-'));
 const db=openDatabase(path.join(dir,'test.sqlite'));
 return {db,close(){db.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
test('wallet starts at zero and creates a coin request at 90M credits per coin',t=>{
 const f=fixture();t.after(f.close);const c=createCommerce(f.db);
 assert.equal(c.balance('user-a'),0);
 const request=c.requestCoins('user-a',3);
 assert.equal(request.credits,'270000000');
 assert.equal(c.balance('user-a'),0);
});
test('approved top-up credits once and writes a ledger entry',t=>{
 const f=fixture();t.after(f.close);const c=createCommerce(f.db);
 const req=c.requestCoins('user-b',5);
 const result=c.approveRequest(req.id,'owner-1');
 assert.equal(result.coins,5);assert.equal(result.balance,5);
 assert.throws(()=>c.approveRequest(req.id,'owner-1'),/غير موجود/);
 assert.equal(c.history('user-b').length,1);
});
test('plan purchase is atomic and rejects insufficient balance',t=>{
 const f=fixture();t.after(f.close);const c=createCommerce(f.db);
 assert.throws(()=>c.buyPlan('user-c','pro'),/غير كاف/);
 c.credit({userId:'user-c',amount:25,actorId:'owner-1',reason:'test credit'});
 const order=c.buyPlan('user-c','pro');
 assert.equal(order.price,20);assert.equal(order.balance,5);
 assert.equal(c.balance('user-c'),5);
});
test('invalid plan and invalid coin requests are rejected',t=>{
 const f=fixture();t.after(f.close);const c=createCommerce(f.db);
 assert.throws(()=>c.buyPlan('user-d','unknown'),/غير معروفة/);
 assert.throws(()=>c.requestCoins('user-d',0),/بين 1 و1000/);
});
