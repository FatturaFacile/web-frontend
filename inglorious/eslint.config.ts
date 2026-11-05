import browserConfig from "@inglorious/eslint-config/browser"
import nodeConfig from "@inglorious/eslint-config/node"
import typescriptConfig from "@inglorious/eslint-config/typescript"
import { defineConfig } from "eslint/config"

export default defineConfig([
  ...browserConfig,
  ...typescriptConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // The benchmark scripts run in Node and report on the console.
  ...nodeConfig.map((config) => ({
    ...config,
    files: ["benchmarks/**/*.mjs"],
  })),
  {
    files: ["benchmarks/**/*.mjs"],
    rules: { "no-console": "off" },
  },
])
