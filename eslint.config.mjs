import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Keep ESLint out of the way of Prettier for purely stylistic rules.
  ...compat.extends("prettier"),
  {
    rules: {
      // The whole point of the strict type layer — never silence the compiler.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
