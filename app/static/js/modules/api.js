import { getStateValue, updateState } from './state.js';

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.response = response;
        error.body = errorBody;
        throw error;
    }
    if (response.status === 204) {
        return null; // No content
    }
    return response.json();
}

export async function getStructure() {
    return fetchJSON('/api/structure');
}

export async function getPrompt(promptId) {
    const requestToken = getStateValue('latestRequestToken') + 1;
    updateState('latestRequestToken', requestToken);

    const payload = await fetchJSON(`/api/prompts/${promptId}`);

    if (getStateValue('latestRequestToken') !== requestToken) {
        return null; // A newer request has been made
    }
    return payload;
}

export async function searchPrompts(query) {
    const requestToken = getStateValue('latestSearchRequest') + 1;
    updateState('latestSearchRequest', requestToken);

    const results = await fetchJSON(`/api/search?q=${encodeURIComponent(query)}`);

    if (getStateValue('latestSearchRequest') !== requestToken) {
        return null; // A newer search has been initiated
    }
    return results;
}

export async function savePrompt(payload, editingPromptId) {
    const isEdit = typeof editingPromptId === 'number';
    const endpoint = isEdit ? `/api/prompts/${editingPromptId}` : '/api/prompts';
    const method = isEdit ? 'PUT' : 'POST';

    return fetchJSON(endpoint, {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
}

export async function deletePrompt(promptId) {
    return fetchJSON(`/api/prompts/${promptId}`, { method: 'DELETE' });
}
