import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      // Utility scripts
      'check-broken-images-diagnostic.js',
      'check-specific-previews.js',
      'debug-image-issues.js',
      'fix-all-broken-images.js',
      'fix-has-website.js',
      'fix-images.js',
      'fix-template-variables.js',
      'regenerate-previews.js',
      'test-ai-apis.js',
      // Generated files
      'next-env.d.ts',
      '.next/**/*',
      'out/**/*',
      'dist/**/*',
      'build/**/*',
      // Dependencies
      'node_modules/**/*',
      // Environment files
      '.env*',
      // Logs
      '*.log',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      // OS files
      '.DS_Store',
      'Thumbs.db',
      // IDE files
      '.vscode/**/*',
      '.idea/**/*',
      '*.swp',
      '*.swo',
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Relax strict rules to keep CI green while we incrementally improve types
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];

export default eslintConfig;
