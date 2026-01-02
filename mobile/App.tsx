import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';
import { useThemeStore } from './src/store/themeStore';

export default function App() {
    const { theme, loadTheme } = useThemeStore();

    useEffect(() => {
        loadTheme();
    }, []);

    return (
        <>
            <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
            <AppNavigator />
        </>
    );
}
