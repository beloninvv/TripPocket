// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-gifted-charts статически требует 'react-native-linear-gradient'
// (нативный модуль, ломает Expo Go). Перенаправляем на expo-linear-gradient,
// который экспортирует совместимый LinearGradient и работает в Expo Go.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-linear-gradient': path.resolve(
    __dirname,
    'node_modules/expo-linear-gradient'
  ),
};

module.exports = config;
