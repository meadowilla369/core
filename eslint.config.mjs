import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "out/**",
      "lib/**",
      "cache/**"
    ]
  }
];
