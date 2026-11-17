'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openDatabase}=require('../src/database'),{createCommerce}=require('../src/services/commerce');
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'em7-v6-')),db=openDatabase(path.join(dir,'test.sqlite'));return{db,close(){db.close();fs.rmSync(dir,{recursive:true,force:true});}};}
test('wallet and conversion',t=>{const f=fixture();t.after(f.close);const c=createCommerce(f.db);assert.equal(c.balance('u'),0);assert.equal(c.requestCoins('u',2).credits,'180000000');assert.equal(c.balance('u'),0);});
test('topup is approved once',t=>{const f=fixture();t.after(f.close);const c=createCommerce(f.db),r=c.requestCoins('u',3);assert.equal(c.approveRequest(r.id,'owner').balance,3);assert.throws(()=>c.approveRequest(r.id,'owner'));});
test('plan purchase deducts balance',t=>{const f=fixture();t.after(f.close);const c=createCommerce(f.db);c.addCoins({userId:'u',amount:25,actorId:'owner',reason:'test'});assert.equal(c.buyPlan('u','pro').balance,5);assert.throws(()=>c.buyPlan('u','ultimate'));});