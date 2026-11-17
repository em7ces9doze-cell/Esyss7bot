'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {cleanName,isSnowflake}=require('../src/security/validation');
test('cleanName strips controls and limits length',()=>{assert.equal(cleanName('a\nb'),'ab');assert.equal(cleanName('x'.repeat(100)).length,90);});
test('snowflake shape',()=>{assert.equal(isSnowflake('123456789012345678'),true);assert.equal(isSnowflake('bad'),false);});
