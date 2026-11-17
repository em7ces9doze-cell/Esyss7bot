'use strict';
function cleanName(v,max=90){return String(v||'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max);}
function isSnowflake(v){return typeof v==='string'&&/^\d{17,20}$/.test(v);}
module.exports={cleanName,isSnowflake};
