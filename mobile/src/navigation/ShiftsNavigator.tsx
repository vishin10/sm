import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ShiftsListScreen from '../screens/shifts/ShiftsListScreen';
import ShiftDetailScreen from '../screens/shifts/ShiftDetailScreen';
import { colors } from '../theme/colors';

const Stack = createStackNavigator();

export default function ShiftsNavigator() {
    return (
        <Stack.Navigator screenOptions={{
            headerStyle: { backgroundColor: colors.dark.surface },
            headerTintColor: colors.dark.textPrimary,
            headerTitleStyle: { fontWeight: 'bold' },
            cardStyle: { backgroundColor: colors.dark.background }
        }}>
            <Stack.Screen name="ShiftsList" component={ShiftsListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ShiftDetail" component={ShiftDetailScreen} options={{ title: 'Details' }} />
        </Stack.Navigator>
    );
}
