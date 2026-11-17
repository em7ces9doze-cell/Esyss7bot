"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {openDatabase}=require("../src/database");
const {createCommerce}=require("../src/services/commerce");
test("wallet credits, debits and records ledger",()=>{const db=openDatabase(":memory:");const c=createCommerce(db);assert.equal(c.balance("u1"),0);assert.equal(c.credit("u1",25,"seed","owner"),25);assert.equal(c.debit("u1",5,"test","u1"),20);assert.equal(c.balance("u1"),20);assert.equal(c.ledger("u1").length,2);db.close();});
test("top-up request is not credited before approval and cannot be approved twice",()=>{const db=openDatabase(":memory:");const c=createCommerce(db);const id=c.requestTopup("u2",12,"payment reference");assert.equal(c.balance("u2"),0);assert.equal(c.approveTopup(id,"owner").balance,12);assert.throws(()=>c.approveTopup(id,"owner"),/already reviewed/);assert.equal(c.balance("u2"),12);db.close();});
test("purchase debits wallet and remains pending provisioning",()=>{const db=openDatabase(":memory:");const c=createCommerce(db);c.credit("u3",20,"seed","owner");const purchase=c.buyPlan("u3","pro");assert.equal(purchase.status,"pending_provisioning");assert.equal(c.balance("u3"),0);db.close();});
