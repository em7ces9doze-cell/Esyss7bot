'use strict';
function audit(db,actor,guild,action,details={}){db.prepare('INSERT INTO audit_log(actor_id,guild_id,action,details_json,created_at) VALUES(?,?,?,?,?)').run(actor,guild||null,action,JSON.stringify(details),new Date().toISOString());}
module.exports={audit};
