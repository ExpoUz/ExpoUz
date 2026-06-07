const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Fix Windows backslashes in Metro bundle URLs.
// Metro calls path.relative(projectRoot, modulePath) to build the <script src>
// URL. On Windows this returns backslash-separated strings (e.g.
// "..\\..\node_modules\expo-router\entry"), which become %5C in the URL and
// cause the browser to get a 500. Patching path.relative to always emit
// forward slashes fixes this without any other Metro configuration change.
if (process.platform === 'win32') {
  const _origRelative = path.relative;
  path.relative = function(from, to) {
    return _origRelative(from, to).replace(/\\/g, '/');
  };
}

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Only watch the shared package — NOT the entire monorepoRoot.
// Watching the full monorepo root causes Metro's file-map workers to try to
// read large binary files (e.g. @next/swc-win32-x64-msvc at 130 MB), which
// exhausts the worker heap and throws ERR_MEMORY_ALLOCATION_FAILED.
// The root node_modules is covered by nodeModulesPaths below; Metro can still
// resolve and serve files from there without it being in watchFolders.
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages/shared'),
];

// Resolve modules from both the app's and the monorepo root's node_modules
// (pnpm hoists all packages to root node_modules via node-linker=hoisted in .npmrc)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Map workspace packages to their real paths.
// pnpm links workspace packages as NTFS junctions which Metro's file-map watcher
// does not follow — so resolution of e.g. '@expouz/shared' fails even though
// the junction exists. Pointing extraNodeModules directly at the real directory
// bypasses the junction lookup entirely.
config.resolver.extraNodeModules = {
  '@expouz/shared': path.resolve(monorepoRoot, 'packages/shared'),
};

// Intercept Node.js built-in module requests that cannot be bundled for web.
// expo-modules-core/build/uuid/uuid.web.js contains `require('crypto')` as a
// dead-code fallback; Metro still tries to resolve it statically.  We redirect
// it to a tiny browser shim so the bundle compiles without errors.
const _origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'crypto') {
    return {
      filePath: path.resolve(projectRoot, 'src/cryptoShim.js'),
      type: 'sourceFile',
    };
  }
  if (_origResolveRequest) {
    return _origResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Set the server root to the monorepo root so Metro resolves bundle URLs
// (e.g. /node_modules/expo-router/entry.bundle) relative to the workspace root.
// Used together with EXPO_USE_METRO_WORKSPACE_ROOT=true in .env.
config.server = {
  ...config.server,
  unstable_serverRoot: monorepoRoot,
};

module.exports = config;
