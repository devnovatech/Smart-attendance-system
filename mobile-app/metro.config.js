const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @firebase/auth's RN bundle (CJS) does require('@firebase/app') which resolves
// to dist/index.cjs.js via the "require" exports condition, while ESM imports
// resolve to dist/esm/index.esm2017.js via "default". This creates two separate
// module instances, breaking Firebase's component registration.
// Force all resolutions of @firebase/app to use the same CJS bundle.
const firebaseAppMain = path.resolve(
  __dirname,
  'node_modules/@firebase/app/dist/index.cjs.js'
);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@firebase/app') {
    return { type: 'sourceFile', filePath: firebaseAppMain };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
