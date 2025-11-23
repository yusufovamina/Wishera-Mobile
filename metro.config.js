const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix for event-target-shim warning from react-native-webrtc
// Suppress the warning by providing a custom resolver
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, realModuleName, platform, moduleName) => {
  // Handle event-target-shim nested dependency
  if (realModuleName && realModuleName.includes('event-target-shim')) {
    try {
      return {
        type: 'sourceFile',
        filePath: require.resolve('event-target-shim'),
      };
    } catch (e) {
      // Fall through to default resolution
    }
  }
  // Use default resolution for other modules
  if (originalResolveRequest) {
    return originalResolveRequest(context, realModuleName, platform, moduleName);
  }
  return context.resolveRequest(context, realModuleName, platform, moduleName);
};

module.exports = config;
