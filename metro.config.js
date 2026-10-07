const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push('glb', 'gltf', 'filamat');

const config = {
  resolver: {
    blockList: [
      /.*[/\\]android[/\\]app[/\\]\.cxx[/\\].*/,
      /.*[/\\]android[/\\]app[/\\]build[/\\].*/,
      /.*[/\\]android[/\\]build[/\\].*/,
    ],
  },
};
module.exports = mergeConfig(defaultConfig, config);