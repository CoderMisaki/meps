import { MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';

// Monochrome colors
const colors = {
  black: '#000000',
  white: '#FFFFFF',
  gray100: '#F5F5F5',
  gray200: '#E5E5E5',
  gray300: '#D4D4D4',
  gray400: '#A3A3A3',
  gray500: '#737373',
  gray600: '#525252',
  gray700: '#404040',
  gray800: '#262626',
  gray900: '#171717',
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.black,
    onPrimary: colors.white,
    primaryContainer: colors.gray200,
    onPrimaryContainer: colors.black,
    secondary: colors.gray600,
    onSecondary: colors.white,
    secondaryContainer: colors.gray200,
    onSecondaryContainer: colors.black,
    background: colors.white,
    onBackground: colors.black,
    surface: colors.white,
    onSurface: colors.black,
    surfaceVariant: colors.gray100,
    onSurfaceVariant: colors.gray700,
    outline: colors.gray300,
    error: colors.black,
    onError: colors.white,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.white,
    onPrimary: colors.black,
    primaryContainer: colors.gray800,
    onPrimaryContainer: colors.white,
    secondary: colors.gray400,
    onSecondary: colors.black,
    secondaryContainer: colors.gray800,
    onSecondaryContainer: colors.white,
    background: colors.black,
    onBackground: colors.white,
    surface: colors.black,
    onSurface: colors.white,
    surfaceVariant: colors.gray900,
    onSurfaceVariant: colors.gray300,
    outline: colors.gray700,
    error: colors.white,
    onError: colors.black,
  },
};
