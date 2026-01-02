import apiClient from './client';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    storeName: string;
}

export interface AuthResponse {
    token: string;
    user: {
        id: string;
        email: string;
    };
}

export const authApi = {
    async login(data: LoginRequest): Promise<AuthResponse> {
        const response = await apiClient.post('/auth/login', data);
        return response.data;
    },

    async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },

    async verify(): Promise<{ user: { id: string; email: string } }> {
        const response = await apiClient.get('/auth/verify');
        return response.data;
    },
};

export default authApi;
