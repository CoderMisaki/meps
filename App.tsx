import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { initDatabase } from './src/database/init';
import { useAppStore } from './src/store';
import { lightTheme, darkTheme } from './src/theme';

// --- Error Logger Overlay Component ---
interface ErrorBoundaryState {
  hasError: boolean;
  errors: string[];
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errors: [] };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorMsg = `[React Render Error]: ${error.toString()}\n${errorInfo.componentStack}`;
    console.error(errorMsg);
    this.addLog(errorMsg);
  }

  addLog = (msg: string) => {
    this.setState((prev) => ({
      hasError: true,
      errors: [...prev.errors, msg],
    }));
  };

  clearLogs = () => {
    this.setState({ hasError: false, errors: [] });
  };

  render() {
    return (
      <View style={styles.rootContainer}>
        {this.props.children}
        {this.state.hasError && (
          <View style={styles.errorOverlay}>
            <View style={styles.errorHeader}>
              <Text style={styles.errorTitle}>⚠️ Log Error Sistem ({this.state.errors.length})</Text>
              <TouchableOpacity onPress={this.clearLogs} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>Tutup / Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.errorScrollView}>
              {this.state.errors.map((err, index) => (
                <Text key={index} style={styles.errorText}>
                  {index + 1}. {err}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }
}

export default function App() {
  const isDarkMode = useAppStore((state) => state.settings?.darkMode ?? false);
  const theme = isDarkMode ? darkTheme : lightTheme;
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);

  useEffect(() => {
    // Tangkap unhandled errors pada browser Web
    if (typeof window !== 'undefined') {
      const handleWindowError = (event: ErrorEvent) => {
        const msg = `[Window Error]: ${event.message} at ${event.filename}:${event.lineno}`;
        setGlobalErrors((prev) => [...prev, msg]);
      };

      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        const msg = `[Async Rejection]: ${event.reason?.message || event.reason || 'Unhandled Rejection'}`;
        setGlobalErrors((prev) => [...prev, msg]);
      };

      window.addEventListener('error', handleWindowError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleWindowError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, []);

  useEffect(() => {
    initDatabase().catch((err) => {
      console.error('Init DB Error:', err);
      setGlobalErrors((prev) => [...prev, `[Database Init Error]: ${err.message || err}`]);
    });
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider style={styles.safeArea}>
        <PaperProvider theme={theme}>
          <AppNavigator />
        </PaperProvider>
      </SafeAreaProvider>

      {/* Global Error Banner jika ada error diluar render tree */}
      {globalErrors.length > 0 && (
        <View style={styles.globalErrorBanner}>
          <View style={styles.errorHeader}>
            <Text style={styles.errorTitle}>🚨 Log Error Global ({globalErrors.length})</Text>
            <TouchableOpacity onPress={() => setGlobalErrors([])} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Hapus</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.errorScrollView}>
            {globalErrors.map((err, i) => (
              <Text key={i} style={styles.errorText}>
                {i + 1}. {err}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  errorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 250,
    backgroundColor: '#1E1E1E',
    borderTopWidth: 3,
    borderTopColor: '#FF4D4D',
    padding: 12,
    zIndex: 99999,
  },
  globalErrorBanner: {
    position: 'absolute',
    top: 40,
    left: 10,
    right: 10,
    maxHeight: 200,
    backgroundColor: '#2A0000',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF3333',
    padding: 10,
    zIndex: 99999,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 13,
  },
  clearButton: {
    backgroundColor: '#FF3333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  errorScrollView: {
    maxHeight: 180,
  },
  errorText: {
    color: '#FFD1D1',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 4,
  },
});
