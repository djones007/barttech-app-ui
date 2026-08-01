// app-ui is a source-only React component library — deliberately NOT eslint-config-next.
// It is not a Next app: it has no `app/` or `pages/` directory, no next.config, and no
// build, so the Next plugin's rules (no-html-link-for-pages, no-img-element, the
// route-file conventions) have nothing to check here. Pulling it in would only import
// that stack's version constraints — the exact coupling web-core avoids for the same
// reason.
//
// eslint-plugin-react-hooks IS included, and is the one plugin that earns its place:
// this repo exists to ship hook-using client components into every app in the estate,
// and rules-of-hooks catches a conditional/early-returned hook call — a runtime crash
// in every consumer at once, which `tsc` does not see. exhaustive-deps catches the
// stale-closure class of bug that the group-open state in LeftNav is directly exposed
// to. eslint-plugin-react itself is NOT included: its value is mostly prop-types and
// JSX correctness that TypeScript already covers.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["*.ts", "*.tsx"],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // These components are consumed by every app with an admin shell; an implicit
      // `any` here silently becomes an untyped value in every one of them.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
