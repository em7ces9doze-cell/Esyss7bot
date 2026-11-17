'use strict';
function truncate(v,n=1900){v=String(v??'');return v.length>n?v.slice(0,n-1)+'…':v;}
module.exports={truncate};
