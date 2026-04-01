import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

import jsdoc from 'eslint-plugin-jsdoc';


export default defineConfig([
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ["**/*.{js,mjs,cjs}"],
    // plugins: { js, jsdoc: jsdoc },
    // // extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
    rules: {
      'jsdoc/check-alignment': "warn",
      "jsdoc/valid-jsdoc": "off",
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-returns": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
      "no-unused-vars": "off",
      "jsdoc/reject-any-type": "off"
    }
  },
]);
