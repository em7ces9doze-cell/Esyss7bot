'use strict';
const {AppError}=require('./errors');
function assertOwner(id,cfg){if(id!==cfg.ownerId)throw new AppError('هذا الأمر مخصص لمالك البوت.','OWNER_ONLY');}
module.exports={assertOwner};
