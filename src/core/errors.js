'use strict';
class AppError extends Error{constructor(message,code='APP_ERROR'){super(message);this.code=code;}}
module.exports={AppError};
