import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

const jsdocRequiredFiles = [
    'src/sw.ts',
    'src/shared/**/*.ts',
    'src/app/**/*.ts',
    'src/widgets/**/*.template.ts',
    'src/widgets/subscription-section/**/*.ts',
    'src/widgets/editor-settings/**/*.ts',
    'src/widgets/container-stats/**/*.ts',
    'src/widgets/feedback-modal/**/*.ts',
    'src/widgets/resource-banner/**/*.ts',
    'src/widgets/green-header/**/*.ts'
];

const jsdocRules = {
    'jsdoc/require-jsdoc': [
        'error',
        {
            require: {
                FunctionDeclaration: true,
                MethodDefinition: true,
                ClassDeclaration: true,
                ArrowFunctionExpression: false,
                FunctionExpression: false
            },
            checkConstructors: true,
            checkGetters: true,
            checkSetters: true,
            contexts: [
                'TSMethodSignature',
                'PropertyDefinition > ArrowFunctionExpression.value',
                'TSInterfaceDeclaration',
                'TSTypeAliasDeclaration'
            ]
        }
    ],
    'jsdoc/require-description': 'error',
    'jsdoc/require-param': ['error', { checkDestructured: false }],
    'jsdoc/require-param-description': 'error',
    'jsdoc/require-param-name': 'error',
    'jsdoc/check-param-names': ['error', { checkDestructured: false }],
    'jsdoc/require-returns': ['error', { forceRequireReturn: false }],
    'jsdoc/require-returns-description': 'error',
    'jsdoc/no-types': 'error',
    'jsdoc/check-tag-names': 'error',
    'jsdoc/check-alignment': 'error',
    'jsdoc/no-undefined-types': 'off'
};

const pragmaticDisables = {
    'sort-keys': 'off',
    'sort-vars': 'off',
    'sort-imports': 'off',
    'id-length': 'off',
    'id-denylist': 'off',
    'id-match': 'off',
    'capitalized-comments': 'off',
    'multiline-comment-style': 'off',
    'line-comment-position': 'off',
    'no-inline-comments': 'off',
    'func-style': 'off',
    'func-names': 'off',
    'no-ternary': 'off',
    'no-magic-numbers': 'off',
    'no-undefined': 'off',
    'init-declarations': 'off',
    'one-var': 'off',
    'no-plusplus': 'off',
    'no-continue': 'off',
    'no-bitwise': 'off',
    'no-warning-comments': 'off',
    'max-lines': 'off',
    'max-lines-per-function': 'off',
    'max-statements': 'off',
    'max-statements-per-line': 'off',
    'max-params': 'off',
    'max-depth': 'off',
    'max-nested-callbacks': 'off',
    'max-classes-per-file': 'off',
    complexity: 'off',
    'no-underscore-dangle': 'off',
    'prefer-named-capture-group': 'off',
    'require-unicode-regexp': 'off',
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'no-restricted-globals': 'off',
    'no-restricted-imports': 'off',
    'no-restricted-properties': 'off',
    'no-restricted-exports': 'off',
    camelcase: 'off',
    'consistent-this': 'off',
    'new-cap': 'off',
    'no-empty-function': 'off',
    'no-void': 'off',
    'no-negated-condition': 'off',
    'class-methods-use-this': 'off',
    'no-param-reassign': 'off',
    'prefer-destructuring': 'off',
    'no-use-before-define': 'off'
};

const strictOverrides = {
    'no-console': 'error',
    'no-alert': 'error',
    eqeqeq: 'error',
    curly: ['error', 'all'],
    'no-var': 'error',
    'prefer-const': 'error',
    'no-duplicate-imports': 'error',
    'no-self-compare': 'error',
    'no-template-curly-in-string': 'error'
};

export default [
    {
        ignores: ['node_modules/', 'dist/', '.ts-out/', 'src/all-templates.precompiled.js']
    },

    ...tseslint.configs.strictTypeChecked.map((config) => ({
        ...config,
        files: ['src/**/*.ts']
    })),
    ...tseslint.configs.stylisticTypeChecked.map((config) => ({
        ...config,
        files: ['src/**/*.ts']
    })),

    {
        files: ['src/**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            },
            globals: {
                ...globals.browser
            }
        },
        rules: {
            ...js.configs.all.rules,
            ...pragmaticDisables,
            ...strictOverrides,
            'no-unused-vars': 'off',
            'no-undef': 'off',
            'no-use-before-define': 'off',
            'no-shadow': 'off',
            'no-redeclare': 'off',
            'no-dupe-class-members': 'off',
            'no-loss-of-precision': 'off',
            'no-implied-eval': 'off',
            'no-throw-literal': 'off',
            'no-loop-func': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            '@typescript-eslint/no-use-before-define': ['error', { classes: false }],
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/explicit-function-return-type': 'error',
            '@typescript-eslint/explicit-member-accessibility': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/strict-boolean-expressions': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error'
        }
    },

    {
        files: jsdocRequiredFiles,
        plugins: { jsdoc },
        rules: jsdocRules
    },

    {
        files: ['build/**/*.js', '*.mjs', '*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node
            }
        },
        rules: {
            ...js.configs.all.rules,
            ...pragmaticDisables,
            ...strictOverrides,
            'no-console': 'off',
            'no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
            ],
            'no-use-before-define': ['error', { classes: false }]
        }
    },

    eslintConfigPrettier
];
