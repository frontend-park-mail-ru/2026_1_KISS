/**
 * @template T
 * @param {Response} response
 * @returns {Promise<T>}
 */
export async function parseApiResponse(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body?.error ?? `HTTP ${response.status}`);
    }
    if (body.data === undefined) {
        throw new Error('Response body missing "data" field');
    }
    return body.data;
}
