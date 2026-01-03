import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ShiftsNavigator from './ShiftsNavigator';
import AlertsListScreen from '../screens/alerts/AlertsListScreen';
import InsightsScreen from '../screens/insights/InsightsScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ManageStoresScreen from '../screens/stores/ManageStoresScreen';
import UploadShiftReportScreen from '../screens/upload/UploadShiftReportScreen';
import ShiftInsightsScreen from '../screens/upload/ShiftInsightsScreen';
import ReportsListScreen from '../screens/reports/ReportsListScreen';
import DrawerContent from '../components/DrawerContent';
import { colors } from '../theme/colors';
import { useThemeStore } from '../store/themeStore';
import { getThemeColors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

type IconName = 'home' | 'home-outline' | 'chatbubbles' | 'chatbubbles-outline';

const getTabIcon = (routeName: string, focused: boolean): IconName => {
    switch (routeName) {
        case 'Dashboard':
            return focused ? 'home' : 'home-outline';
        case 'Chat':
            return focused ? 'chatbubbles' : 'chatbubbles-outline';
        default:
            return 'home-outline';
    }
};

function TabNavigator() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: themeColors.surface,
                    borderTopColor: themeColors.border,
                    paddingBottom: 8,
                    paddingTop: 8,
                    height: 70,
                },
                tabBarActiveTintColor: colors.primary[500],
                tabBarInactiveTintColor: themeColors.textSecondary,
                tabBarIcon: ({ focused, color }) => {
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
            <Tab.Screen name="Chat" component={ChatScreen} />
        </Tab.Navigator>
    );
}

export default function MainNavigator() {
    const { theme } = useThemeStore();
    const themeColors = getThemeColors(theme);

    return (
        <Drawer.Navigator
            drawerContent={DrawerContent}
            screenOptions={{
                headerShown: false,
                drawerPosition: 'right',
                drawerType: 'front',
                drawerStyle: {
                    backgroundColor: themeColors.surface,
                    width: 280,
                },
                swipeEnabled: true,
                swipeEdgeWidth: 50,
            }}
        >
            <Drawer.Screen name="Tabs" component={TabNavigator} />
            <Drawer.Screen name="Shifts" component={ShiftsNavigator} />
            <Drawer.Screen name="Alerts" component={AlertsListScreen} />
            <Drawer.Screen name="Insights" component={InsightsScreen} />
            <Drawer.Screen name="Reports" component={ReportsListScreen} />
            <Drawer.Screen name="Settings" component={SettingsScreen} />
            <Drawer.Screen name="ManageStores" component={ManageStoresScreen} />
            <Drawer.Screen name="UploadShiftReport" component={UploadShiftReportScreen} />
            <Drawer.Screen name="ShiftInsights" component={ShiftInsightsScreen} />
        </Drawer.Navigator>
    );
}

