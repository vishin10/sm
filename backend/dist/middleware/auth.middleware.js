"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const TokenService_1 = require("../services/TokenService");
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!(authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer '))) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No token provided' } });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = TokenService_1.TokenService.verifyToken(token);
        req.user = decoded; // Attach user to request
        next();
    }
    catch (err) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
};
exports.authenticate = authenticate;
