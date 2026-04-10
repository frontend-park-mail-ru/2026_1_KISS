/**
 * @typedef {Object} ApiEnvelope
 * @property {*} data
 * @property {string} [error]
 */

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} email
 * @property {string} avatar_url
 * @property {string} status
 * @property {string} description
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Notebook
 * @property {number} id
 * @property {number} owner_id
 * @property {string} title
 * @property {boolean} [is_public]
 * @property {string} created_at
 * @property {string} updated_at
 * @property {Block[]} [blocks]
 */

/**
 * @typedef {'code'|'text'} BlockType
 */

/**
 * @typedef {'python'|'r'|'markdown'|''} BlockLanguage
 */

/**
 * @typedef {Object} Block
 * @property {number} id
 * @property {number} notebook_id
 * @property {BlockType} type
 * @property {BlockLanguage} language
 * @property {string} content
 * @property {number} position
 * @property {number|null} [execution_count]
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} NotebookListResponse
 * @property {Notebook[]} notebooks
 * @property {number} total
 * @property {number} limit
 * @property {number} offset
 */

/**
 * @typedef {Object} BlockExecutionResult
 * @property {number} block_id
 * @property {number} position
 * @property {string[]} [stdout]
 * @property {string[]} [stderr]
 * @property {string} [result]
 * @property {string} executed_at
 * @property {number} duration
 */

export {};
