export const MODAL_MODE = {
    CREATE: 'create',
    EDIT: 'edit',
};

export const PROMPT_TYPE = {
    SIMPLE: 'simple',
    TEMPLATE: 'template',
};

export const DEFAULTS = {
    PROMPT_TITLE: 'Select a prompt to preview',
    PROMPT_MESSAGE: 'When you pick a prompt from the navigation panel it will appear here in focus mode.',
    COPY_LABEL: 'Copy to Clipboard',
    SUBMIT_LABEL: 'Save Prompt',
    MODAL_TITLE: 'Create New Prompt',
    LOADING_LABEL: 'Loading...',
    SAVING_LABEL: 'Saving...',
    SEARCH_MESSAGE: 'Type to search your prompts.',
    NO_RESULTS_MESSAGE: 'No prompts match your search.',
    SEARCH_ERROR_MESSAGE: 'Unable to search right now. Please try again.',
    SEARCH_LOADING_MESSAGE: 'Searching...',
    TEMPLATE_PREVIEW_EMPTY_MESSAGE: 'Select options to generate the preview.',
    SIMPLE_PROMPT_HINT: 'Simple prompts store a single piece of content.',
    TEMPLATE_PROMPT_HINT: 'Template prompts include configurable options that populate placeholders like {category}.',
};

export const CONFIG = {
    SEARCH_DEBOUNCE_MS: 300,
};

let state = {
    modalMode: MODAL_MODE.CREATE,
    currentPromptType: PROMPT_TYPE.SIMPLE,
    currentPromptId: null,
    currentPromptNavButton: null,
    currentPromptMeta: null,
    currentPromptText: '',
    templateCategoryCounter: 0,
    activeTemplateDetail: null,
    copyResetTimer: null,
    latestRequestToken: 0,
    latestDatalistRequest: 0,
    activeModalTrigger: null,
    isSubmittingPrompt: false,
    editingPromptId: null,
    searchDebounceTimer: null,
    latestSearchRequest: 0,
    isSearchActive: false,
    promptHierarchy: [],
};

export function getState() {
    return { ...state };
}

export function setState(newState) {
    state = { ...state, ...newState };
}

export function updateState(key, value) {
    state[key] = value;
}

export function getStateValue(key) {
    return state[key];
}

/**
 * Escapes a string for use in a CSS selector.
 * @param {string} value The string to escape.
 * @returns {string} The escaped string.
 */
export const escapeSelector = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(value);
    }
    // Basic fallback for older browsers.
    return String(value).replace(/[^a-zA-Z0-9_\-]/g, (match) => `\\${match}`);
};
