import React, { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/init';
import { useAppStore } from './src/store';
import { lightTheme, darkTheme } from './src/theme';

export default function App() {
  const isDarkMode = useAppStore((state) => state.settings.darkMode);
  const theme = isDarkMode ? darkTheme : lightTheme;

  useEffect(() => {
    initDatabase().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
