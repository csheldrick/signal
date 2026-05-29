// Compatibility stub for tooling that expects a .js module at runtime when
// TypeScript sources are referenced with a .js extension. This file provides
// a minimal CommonJS export surface so dynamic requires/imports of
// './event-types.js' do not fail in environments that consume the raw source
// tree. All real type information lives in app/src/storage/event-types.ts and
// is handled by the TypeScript compiler; this stub is intentionally minimal
// and side-effect free.

module.exports = {};
