const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const config = getDefaultConfig(__dirname);
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  /[/\\]apps[/\\]mobile[/\\]dist(?:-native)?[/\\].*/,
];
module.exports = withNativeWind(config, { input: './global.css' });
