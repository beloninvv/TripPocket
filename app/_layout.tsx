import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import '../src/i18n';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <DatabaseProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="trip/new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="trip/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="expense/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
          </Stack>
        </DatabaseProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
