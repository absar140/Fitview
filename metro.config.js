const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const defaultConfig = getDefaultConfig(__dirname);
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blockList: [
      /.*[/\\]android[/\\]app[/\\]\.cxx[/\\].*/,
      /.*[/\\]android[/\\]app[/\\]build[/\\].*/,
      /.*[/\\]android[/\\]build[/\\].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
defaultConfig.resolver.assetExts.push('glb', 'gltf', 'filamat');