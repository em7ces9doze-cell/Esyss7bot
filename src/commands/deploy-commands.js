'use strict';
const cfg=require('../config');require('./register').registerCommands(cfg).then(()=>console.log('Commands deployed')).catch(e=>{console.error(e);process.exit(1);});
