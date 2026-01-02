import jwt from 'jsonwebtoken';

export class TokenService {
    private static readonly SECRET = process.env.JWT_SECRET || 'secret';
    private static readonly EXPIRES_IN = '7d';

    static generateToken(payload: object): string {
        return jwt.sign(payload, this.SECRET, { expiresIn: this.EXPIRES_IN });
    }

    static verifyToken(token: string): any {
        return jwt.verify(token, this.SECRET);
    }
}
