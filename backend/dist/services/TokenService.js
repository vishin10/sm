"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class TokenService {
    static generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.SECRET, { expiresIn: this.EXPIRES_IN });
    }
    static verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.SECRET);
    }
}
exports.TokenService = TokenService;
TokenService.SECRET = process.env.JWT_SECRET || 'secret';
TokenService.EXPIRES_IN = '7d';
