'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {templates}=require('../src/factory/templates');
test('24 unique bot templates',()=>{assert.equal(templates.length,24);assert.equal(new Set(templates.map(x=>x.id)).size,24);});
