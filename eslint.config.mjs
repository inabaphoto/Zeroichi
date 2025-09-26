import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends(
    "next/core-web-vitals",
    "next/typescript",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    settings: { next: { rootDir: ["apps/frontend"] } },
    rules: {
      "next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["next-env.d.ts", "apps/**/next-env.d.ts"],
    rules: { "@typescript-eslint/triple-slash-reference": "off" },
  },
  {
    files: ["**/*.{test,spec}.ts", "**/*.{test,spec}.tsx"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];

export default config;
