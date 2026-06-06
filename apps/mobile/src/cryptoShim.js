'use strict';
// Browser-compatible crypto shim for Metro web bundling.
// expo-modules-core/build/uuid/uuid.web.js does `require('crypto')` as a fallback
// when `globalThis.crypto` appears undefined during static analysis.
// At runtime in a modern browser, globalThis.crypto.randomUUID() is always available
// so this shim is never actually invoked — but Metro must be able to resolve the module.
module.exports = (typeof globalThis !== 'undefined' && globalThis.crypto) || {};
