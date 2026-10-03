import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  // eslint-config-next 16 ships native flat configs — do NOT wrap them in
  // FlatCompat, which throws "Converting circular structure to JSON".
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // This rule fires on any effect that ends up calling setState — including
      // the standard `useEffect(() => { void load() }, [])` data-fetch pattern
      // and the "reset state when the route changes" pattern used by the nav
      // components. Both are intentional here, so keep it advisory.
      'react-hooks/set-state-in-effect': 'warn',
      // Supabase row types are hand-maintained; an explicit `any` is sometimes
      // the honest escape hatch at that boundary.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

export default eslintConfig;
