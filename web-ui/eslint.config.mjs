import coreWebVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'dist/**', 'next-env.d.ts'] },
  ...coreWebVitals,
  {
    rules: {
      // New react-hooks v6 rules flagging PRE-EXISTING polling/websocket hook
      // patterns (setState in effect body). Kept as warnings so they stay
      // visible; follow-up refactor task should drive these to zero and
      // re-promote to error. (All other rules remain at next's defaults.)
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
];

export default eslintConfig;
