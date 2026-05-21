const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const platforms = config.resolver.platforms ?? [];
if (!platforms.includes('web')) {
  config.resolver.platforms = [...platforms, 'web'];
}

module.exports = config;
