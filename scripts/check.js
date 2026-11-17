'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):[p];});}
const list=walk('src').filter(x=>x.endsWith('.js')).concat(['scripts/check.js']);for(const f of list){const r=cp.spawnSync(process.execPath,['--check',f],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}console.log('Syntax check passed:',list.length);
