"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAgent = void 0;
const AgentService_1 = require("../services/AgentService");
/**
 * Middleware to authenticate agent requests using X-API-Key header
 */
const authenticateAgent = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({
            error: {
                code: 'MISSING_API_KEY',
                message: 'X-API-Key header is required'
            }
        });
    }
    if (!apiKey.startsWith('sk_agent_')) {
        return res.status(401).json({
            error: {
                code: 'INVALID_API_KEY_FORMAT',
                message: 'Invalid API key format'
            }
        });
    }
    try {
        const result = yield AgentService_1.AgentService.validateApiKey(apiKey);
        if (!result) {
            return res.status(401).json({
                error: {
                    code: 'INVALID_API_KEY',
                    message: 'API key is invalid or revoked'
                }
            });
        }
        // Attach store info to request
        req.agent = {
            storeId: result.storeId,
            keyId: result.keyId
        };
        next();
    }
    catch (err) {
        return res.status(500).json({
            error: {
                code: 'AUTH_ERROR',
                message: 'Failed to validate API key'
            }
        });
    }
});
exports.authenticateAgent = authenticateAgent;
