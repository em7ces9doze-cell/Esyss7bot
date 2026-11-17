'use strict';
module.exports={isoNow:()=>new Date().toISOString(),utcDay:()=>new Date().toISOString().slice(0,10)};
