import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Logger } from '../utils/logger';

// Initialize S3 client (will fail gracefully if not configured)
const s3Client = process.env.AWS_ACCESS_KEY_ID ? new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
}) : null;

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'silent-manager-uploads';
const RETENTION_DAYS = 30;

export class S3Service {
    /**
     * Check if S3 is configured
     */
    static isConfigured(): boolean {
        return s3Client !== null;
    }

    /**
     * Upload raw XML file to S3
     * Returns the S3 key
     */
    static async uploadRawFile(
        buffer: Buffer,
        storeId: string,
        fileName: string
    ): Promise<string | null> {
        if (!s3Client) {
            Logger.warn('S3 not configured, skipping file storage');
            return null;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const key = `agent-uploads/${storeId}/${timestamp}_${fileName}`;

        try {
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: 'application/xml',
                Metadata: {
                    storeId,
                    originalFileName: fileName,
                    uploadedAt: new Date().toISOString()
                }
            }));

            Logger.info(`Uploaded file to S3: ${key}`);
            return key;
        } catch (error) {
            Logger.error('Failed to upload to S3:', error);
            throw error;
        }
    }

    /**
     * Download file from S3
     */
    static async downloadFile(key: string): Promise<Buffer> {
        if (!s3Client) {
            throw new Error('S3 not configured');
        }

        try {
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key
            }));

            const stream = response.Body as NodeJS.ReadableStream;
            const chunks: Buffer[] = [];

            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }

            return Buffer.concat(chunks);
        } catch (error) {
            Logger.error(`Failed to download from S3: ${key}`, error);
            throw error;
        }
    }

    /**
     * Delete files older than retention period
     * Should be run as a cron job
     */
    static async cleanupOldFiles(): Promise<number> {
        if (!s3Client) {
            return 0;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

        let deletedCount = 0;
        let continuationToken: string | undefined;

        try {
            do {
                const listResponse = await s3Client.send(new ListObjectsV2Command({
                    Bucket: BUCKET_NAME,
                    Prefix: 'agent-uploads/',
                    ContinuationToken: continuationToken
                }));

                const oldObjects = (listResponse.Contents || [])
                    .filter((obj: any) => obj.LastModified && obj.LastModified < cutoffDate)
                    .map((obj: any) => ({ Key: obj.Key! }));

                if (oldObjects.length > 0) {
                    await s3Client.send(new DeleteObjectsCommand({
                        Bucket: BUCKET_NAME,
                        Delete: { Objects: oldObjects }
                    }));
                    deletedCount += oldObjects.length;
                }

                continuationToken = listResponse.NextContinuationToken;
            } while (continuationToken);

            Logger.info(`S3 cleanup: deleted ${deletedCount} files older than ${RETENTION_DAYS} days`);
            return deletedCount;
        } catch (error) {
            Logger.error('S3 cleanup failed:', error);
            throw error;
        }
    }
}
