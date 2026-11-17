'use strict';
function createRepositories(db){
 const get=db.prepare('SELECT history_json FROM ai_memory WHERE user_id=?');
 const put=db.prepare(`INSERT INTO ai_memory VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET history_json=excluded.history_json,updated_at=excluded.updated_at`);
 const usage=db.prepare('SELECT requests FROM daily_usage WHERE user_id=? AND day=?');
 const inc=db.prepare(`INSERT INTO daily_usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET requests=requests+1`);
 const rate=db.prepare('SELECT last_request_ms FROM rate_limits WHERE user_id=?');
 const ratePut=db.prepare(`INSERT INTO rate_limits VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_request_ms=excluded.last_request_ms`);
 return {memory:{get:id=>{try{return JSON.parse(get.get(id)?.history_json||'[]')}catch{return[]}},set:(id,h)=>put.run(id,JSON.stringify(h.slice(-12)),new Date().toISOString())},
 usage:{count:id=>usage.get(id,new Date().toISOString().slice(0,10))?.requests||0,inc:id=>inc.run(id,new Date().toISOString().slice(0,10))},
 rate:{last:id=>rate.get(id)?.last_request_ms||0,set:(id,t)=>ratePut.run(id,t)}};
}
module.exports={createRepositories};
