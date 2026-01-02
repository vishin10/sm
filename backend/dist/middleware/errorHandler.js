"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    logger_1.Logger.error(err.stack || err.message);
    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message,
        }
    });
};
exports.errorHandler = errorHandler;
