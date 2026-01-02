export const colors = {
    primary: {
        50: '#E3F2FD',
        500: '#2196F3',
        900: '#0D47A1',
    },
    semantic: {
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
    },
    dark: {
        background: '#0A0A0A',
        surface: '#1A1A1A',
        card: '#242424',
        border: '#333333',
        textPrimary: '#FFFFFF',
        textSecondary: '#A0A0A0',
    },
    light: {
        background: '#F8F9FA',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        border: '#E5E7EB',
        textPrimary: '#1F2937',
        textSecondary: '#6B7280',
    }
};

export type ThemeColors = typeof colors.dark;

export const getThemeColors = (theme: 'dark' | 'light'): ThemeColors => {
    return theme === 'dark' ? colors.dark : colors.light;
};
