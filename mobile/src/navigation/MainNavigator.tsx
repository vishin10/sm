import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ShiftsNavigator from './ShiftsNavigator';
import AlertsListScreen from '../screens/alerts/AlertsListScreen';
import InsightsScreen from '../screens/insights/InsightsScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

type IconName = 'home' | 'home-outline' | 'receipt' | 'receipt-outline' |
    'chatbubbles' | 'chatbubbles-outline' | 'notifications' | 'notifications-outline' |
    'bar-chart' | 'bar-chart-outline' | 'settings' | 'settings-outline';

const getTabIcon = (routeName: string, focused: boolean): IconName => {
    switch (routeName) {
        case 'Dashboard':
            return focused ? 'home' : 'home-outline';
        case 'Shifts':
            return focused ? 'receipt' : 'receipt-outline';
        case 'Chat':
            return focused ? 'chatbubbles' : 'chatbubbles-outline';
        case 'Alerts':
            return focused ? 'notifications' : 'notifications-outline';
        case 'Insights':
            return focused ? 'bar-chart' : 'bar-chart-outline';
        case 'Settings':
            return focused ? 'settings' : 'settings-outline';
        default:
            return 'home-outline';
    }
};

export default function MainNavigator() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.dark.surface,
                    borderTopColor: colors.dark.border,
                    paddingBottom: 8,
                    paddingTop: 8,
                    height: 70,
                },
                tabBarActiveTintColor: colors.primary[500],
                tabBarInactiveTintColor: colors.dark.textSecondary,
                tabBarIcon: ({ focused, color, size }) => {
                    const iconName = getTabIcon(route.name, focused);
                    return <Ionicons name={iconName} size={24} color={color} />;
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
            })}
        >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Shifts" component={ShiftsNavigator} />
            <Tab.Screen name="Chat" component={ChatScreen} />
            <Tab.Screen name="Alerts" component={AlertsListScreen} />
            <Tab.Screen name="Insights" component={InsightsScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
}
