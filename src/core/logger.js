'use strict';
module.exports={createLogger:()=>({info:(...a)=>console.log(new Date().toISOString(),'INFO',...a),warn:(...a)=>console.warn(new Date().toISOString(),'WARN',...a),error:(...a)=>console.error(new Date().toISOString(),'ERROR',...a)})};
