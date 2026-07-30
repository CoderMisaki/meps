import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Switch, List, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../store';

const SettingsScreen = () => {
  const theme = useTheme();
  const { settings, setSettings } = useAppStore();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={[styles.header, { color: theme.colors.onBackground }]}>
        Settings
      </Text>

      <ScrollView>
        <List.Section>
          <List.Subheader style={{ color: theme.colors.primary }}>Appearance</List.Subheader>
          <List.Item
            title="Dark Mode"
            titleStyle={{ color: theme.colors.onBackground }}
            right={() => (
              <Switch
                value={settings.darkMode}
                onValueChange={(val) => setSettings({ darkMode: val })}
                color={theme.colors.primary}
              />
            )}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader style={{ color: theme.colors.primary }}>Map Preferences</List.Subheader>
          <List.Item
            title="Map Type"
            description={settings.mapType.charAt(0).toUpperCase() + settings.mapType.slice(1)}
            titleStyle={{ color: theme.colors.onBackground }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            onPress={() => {
              const types = ['normal', 'satellite', 'terrain', 'hybrid'] as const;
              const currentIndex = types.indexOf(settings.mapType);
              const nextType = types[(currentIndex + 1) % types.length];
              setSettings({ mapType: nextType });
            }}
          />
          <List.Item
            title="Units"
            description={settings.unit.toUpperCase()}
            titleStyle={{ color: theme.colors.onBackground }}
            descriptionStyle={{ color: theme.colors.onSurfaceVariant }}
            onPress={() => {
              setSettings({ unit: settings.unit === 'km' ? 'miles' : 'km' });
            }}
          />
        </List.Section>

        <Divider />

        <List.Section>
          <List.Subheader style={{ color: theme.colors.primary }}>Backup</List.Subheader>
          <List.Item
            title="Export Data"
            titleStyle={{ color: theme.colors.onBackground }}
            left={(props) => <List.Icon {...props} icon="export" color={theme.colors.onBackground} />}
            onPress={() => console.log('Exporting data...')}
          />
          <List.Item
            title="Import Data"
            titleStyle={{ color: theme.colors.onBackground }}
            left={(props) => <List.Icon {...props} icon="import" color={theme.colors.onBackground} />}
            onPress={() => console.log('Importing data...')}
          />
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    fontWeight: 'bold',
  },
});

export default SettingsScreen;
