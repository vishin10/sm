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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startConversationCleanupJob = startConversationCleanupJob;
const node_cron_1 = __importDefault(require("node-cron"));
const ConversationService_1 = require("../services/ConversationService");
const logger_1 = require("../utils/logger");
/**
 * Run cleanup daily at 2am
 * Deletes conversations older than 90 days (except pinned)
 */
function startConversationCleanupJob() {
    node_cron_1.default.schedule('0 2 * * *', () => __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.Logger.info('Starting conversation cleanup job...');
            yield ConversationService_1.ConversationService.cleanupOldConversations();
            logger_1.Logger.info('Conversation cleanup completed');
        }
        catch (error) {
            logger_1.Logger.error('Conversation cleanup failed', error);
        }
    }));
    logger_1.Logger.info('Conversation cleanup job scheduled (daily at 2am)');
}
