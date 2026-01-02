import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class CryptoUtils {
    static async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }

    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    static generateDeviceKey(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}
