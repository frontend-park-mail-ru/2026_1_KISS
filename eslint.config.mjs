import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/']
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
            'no-console': 'warn',
            'no-alert': 'warn',
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
