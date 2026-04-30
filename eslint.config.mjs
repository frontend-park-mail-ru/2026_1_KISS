import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
    {
        ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/', '.ts-out/']
    },

    ...tseslint.configs.recommended,

    {
        files: ['src/**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser
            }
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            'no-undef': 'off',
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: 'error',
            curly: ['error', 'multi-line'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-alert': 'off',
            'no-duplicate-imports': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'error',
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': ['error', { classes: false }]
        }
    },

    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            'no-undef': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: 'error',
            curly: ['error', 'multi-line'],
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-alert': 'off',
            'no-duplicate-imports': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'error',
            'no-use-before-define': ['error', { classes: false }]
        }
    },

    {
        files: ['build/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            'no-undef': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: 'error',
            'no-console': 'off',
            'no-duplicate-imports': 'error'
        }
    },

    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            'no-undef': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: 'error',
            curly: ['error', 'multi-line'],
            'no-console': 'off',
            'no-duplicate-imports': 'error',
            'no-self-compare': 'error',
            'no-template-curly-in-string': 'error',
            'no-use-before-define': ['error', { classes: false }]
        }
    },

    eslintConfigPrettier
];
