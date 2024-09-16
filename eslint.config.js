import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsEslintParser from "@typescript-eslint/parser";
import globals from "globals";

export default [
	{
		files: ["src/**/*.ts"],

		languageOptions: {
			ecmaVersion: "latest",

			globals: {
				...globals.browser,
				...globals.node
			},

			parser: tsEslintParser,
			parserOptions: {
				ecmaVersion: "latest",
				project: "tsconfig.json"
			}
		},

		linterOptions: {
			// noInlineConfig: true,
			reportUnusedDisableDirectives: true
		},

		plugins: {
			"@stylistic": stylistic,
			"@typescript-eslint": tsEslintPlugin,
		},

		rules: {
			// ESLint

			...eslint.configs.recommended.rules,

			// Possible Problems

			"no-constructor-return": ["error"],
			"no-dupe-class-members": ["off"],
			"no-duplicate-imports": ["error"],
			"no-new-native-nonconstructor": ["error"],
			"no-promise-executor-return": ["error"],
			"no-self-compare": ["error"],
			"no-template-curly-in-string": ["error"],
			"no-unmodified-loop-condition": ["error"],
			"no-unused-private-class-members": ["error"],
			"require-atomic-updates": ["error"],

			// Suggestions

			"arrow-body-style": ["error", "as-needed", {
				"requireReturnForObjectLiteral": true
			}],
			"eqeqeq": ["error", "always"],
			"func-style": ["error", "declaration", {
				"allowArrowFunctions": true
			}],
			"no-eval": ["error", { "allowIndirect": false }],
			"no-implied-eval": ["error"],
			"no-multi-str": ["error"],
			"no-octal-escape": ["error"],
			"no-param-reassign": ["error"],
			"no-var": ["error"],
			"operator-assignment": ["error", "always"],
			"prefer-arrow-callback": ["error", {
				"allowNamedFunctions": false,
				"allowUnboundThis": true
			}],
			"prefer-const": ["error", {
				"destructuring": "any",
				"ignoreReadBeforeAssign": false
			}],
			"prefer-exponentiation-operator": ["error"],
			"prefer-named-capture-group": ["error"],
			"prefer-numeric-literals": ["error"],
			"prefer-regex-literals": ["error", {
				"disallowRedundantWrapping": true
			}],
			"prefer-rest-params": ["error"],
			"prefer-spread": ["error"],
			"prefer-template": ["error"],
			"radix": ["error", "always"],

			// @typescript-eslint/eslint-plugin

			...tsEslintPlugin.configs["recommended"].rules,
			...tsEslintPlugin.configs["recommended-type-checked"].rules,
			...tsEslintPlugin.configs["eslint-recommended"].rules,

			"@typescript-eslint/ban-ts-comment": ["error", {
				"ts-check": true,
				"ts-expect-error": false,
				"ts-ignore": true,
				"ts-nocheck": true
			}],
			"@typescript-eslint/explicit-member-accessibility": ["error", {
				"accessibility": "explicit"
			}],
			"@typescript-eslint/no-explicit-any": ["off"],
			"@typescript-eslint/no-inferrable-types": ["off"],
			"@typescript-eslint/no-misused-promises": ["error", {
				"checksVoidReturn": false
			}],
			"@typescript-eslint/no-require-imports": ["error"],
			"@typescript-eslint/no-unsafe-declaration-merging": ["error"],
			"@typescript-eslint/no-unsafe-enum-comparison": ["error"],
			"@typescript-eslint/no-unused-vars": ["warn"],
			"@typescript-eslint/parameter-properties": ["error", {
				"prefer": "class-property"
			}],
			"@typescript-eslint/prefer-literal-enum-member": ["error"],
			"@typescript-eslint/prefer-optional-chain": ["error"],
			"@typescript-eslint/prefer-string-starts-ends-with": ["error"],
			"@typescript-eslint/require-array-sort-compare": ["error", {
				"ignoreStringArrays": true
			}],

			// @stylistic/eslint-plugin

			...stylistic.configs["recommended-flat"].rules,

			"@stylistic/arrow-parens": ["error", "always"],
			"@stylistic/arrow-spacing": ["error"],
			"@stylistic/brace-style": ["error", "1tbs", {
				"allowSingleLine": true
			}],
			"@stylistic/comma-dangle": ["error", "never"],
			"@stylistic/computed-property-spacing": ["error"],
			"@stylistic/dot-location": ["error", "property"],
			"@stylistic/eol-last": ["error"],
			"@stylistic/indent": ["error", "tab"],
			"@stylistic/keyword-spacing": ["error"],
			"@stylistic/linebreak-style": ["error", "unix"],
			"@stylistic/max-len": ["error", {
				"code": 125,
				"tabWidth": 4
			}],
			"@stylistic/max-statements-per-line": ["warn", {
				"max": 1
			}],
			"@stylistic/member-delimiter-style": ["error", {
				"multiline": {
					"delimiter": "semi",
					"requireLast": true
				},
				"singleline": {
					"delimiter": "semi",
					"requireLast": true
				}
			}],
			"@stylistic/no-floating-decimal": ["error"],
			"@stylistic/no-mixed-spaces-and-tabs": ["error"],
			"@stylistic/no-multi-spaces": ["error"],
			"@stylistic/no-multiple-empty-lines": ["error", {
				"max": 1,
				"maxEOF": 1,
				"maxBOF": 0
			}],
			"@stylistic/no-tabs": ["off"],
			"@stylistic/no-trailing-spaces": ["error"],
			"@stylistic/no-whitespace-before-property": ["error"],
			"@stylistic/nonblock-statement-body-position": ["error"],
			"@stylistic/padded-blocks": ["error", "never"],
			"@stylistic/quote-props": ["error", "as-needed", {
				"keywords": false,
				"unnecessary": true,
				"numbers": true
			}],
			"@stylistic/quotes": ["error", "double", {
				"allowTemplateLiterals": true
			}],
			"@stylistic/rest-spread-spacing": ["error", "never"],
			"@stylistic/semi": ["error", "always"],
			"@stylistic/semi-spacing": ["error"],
			"@stylistic/semi-style": ["error"],
			"@stylistic/space-before-blocks": ["error", "always"],
			"@stylistic/space-before-function-paren": ["error", {
				"anonymous": "never",
				"named": "never",
				"asyncArrow": "always"
			}],
			"@stylistic/space-in-parens": ["error", "never"],
			"@stylistic/space-infix-ops": ["error"],
			"@stylistic/space-unary-ops": ["error"],
			"@stylistic/spaced-comment": ["error", "always"],
			"@stylistic/switch-colon-spacing": ["error"],
			"@stylistic/template-curly-spacing": ["error", "never"],
			"@stylistic/template-tag-spacing": ["error", "never"],
			"@stylistic/type-annotation-spacing": ["error"],
			"@stylistic/type-generic-spacing": ["error"],
			"@stylistic/type-named-tuple-spacing": ["error"],
			"@stylistic/wrap-iife": ["error", "inside"]
		}
	}
];
