// vitest.config.ts aliases the real `server-only` package to this no-op.
//
// The real package's Node ("default") export condition throws unconditionally —
// it only resolves to a no-op when bundled by Next.js under the "react-server"
// export condition. Vitest runs plain Node, so every `lib/*.ts` module that
// starts with `import 'server-only'` needs this stand-in to be unit-testable.
export {}
