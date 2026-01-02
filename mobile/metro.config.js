const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep your existing web support
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

// ✅ Force Metro to prefer CJS/react-native exports (avoids import.meta ESM builds)
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native', 'default'];

module.exports = config;
