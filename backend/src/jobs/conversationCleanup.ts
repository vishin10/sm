import cron from 'node-cron';
import { ConversationService } from '../services/ConversationService';
import { Logger } from '../utils/logger';

/**
 * Run cleanup daily at 2am
 * Deletes conversations older than 90 days (except pinned)
 */
export function startConversationCleanupJob() {
    cron.schedule('0 2 * * *', async () => {
        try {
            Logger.info('Starting conversation cleanup job...');
            await ConversationService.cleanupOldConversations();
            Logger.info('Conversation cleanup completed');
        } catch (error) {
            Logger.error('Conversation cleanup failed', error);
        }
    });

    Logger.info('Conversation cleanup job scheduled (daily at 2am)');
}
