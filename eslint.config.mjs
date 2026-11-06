import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * eslint-config-next ships real flat configs, so they are imported directly.
 * Going through FlatCompat instead crashes ESLint 9.39 with a circular-JSON
 * error while it tries to format the eslintrc schema.
 */
const eslintConfig = [
  {
    ignores: [
      '.next/**',
      'out/**',
      'node_modules/**',
      'public/data/**',
      'reference/**',
      'Study Pack - Math/**',
      'Study Pack - Physics/**',
      'next-env.d.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Content scripts are Node CLIs, not app code: they are meant to print and
    // to exit non-zero, and they import with explicit .ts extensions so Node's
    // strip-only TypeScript mode can resolve them.
    files: ['scripts/**/*.ts', 'tests/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
