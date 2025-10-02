import * as dom from './dom.js';
import * as api from './api.js';
import { DEFAULTS, CONFIG, updateState, getStateValue } from './state.js';

function renderSearchMessage(message) {
    dom.searchResultsContainer.innerHTML = '';
    const paragraph = dom.doc.createElement('p');
    paragraph.className = 'empty-state';
    paragraph.textContent = message;
    dom.searchResultsContainer.appendChild(paragraph);
}

function renderSearchResults(items) {
    if (!Array.isArray(items) || items.length === 0) {
        renderSearchMessage(DEFAULTS.NO_RESULTS_MESSAGE);
        return;
    }

    const list = dom.doc.createElement('ul');
    list.className = 'search-results-list';

    items.forEach((promptData) => {
        if (!promptData || typeof promptData !== 'object') return;

        const { id, title, domain_name, subtopic_name, domain_id, subtopic_id } = promptData;
        if (!id || !title || !subtopic_id) return;

        const listItem = dom.doc.createElement('li');
        listItem.className = 'prompt-list-item';

        const button = dom.doc.createElement('button');
        button.type = 'button';
        button.className = 'prompt-button';
        button.dataset.id = String(id);
        button.dataset.domain = domain_name || 'Domain';
        button.dataset.subtopic = subtopic_name || 'Subtopic';
        button.dataset.subtopicId = String(subtopic_id);
        if (domain_id) button.dataset.domainId = String(domain_id);
        button.textContent = title;

        listItem.appendChild(button);
        list.appendChild(listItem);
    });

    if (!list.children.length) {
        renderSearchMessage(DEFAULTS.NO_RESULTS_MESSAGE);
        return;
    }

    dom.searchResultsContainer.innerHTML = '';
    dom.searchResultsContainer.appendChild(list);
}

export function showHierarchyView() {
    updateState('isSearchActive', false);
    dom.hierarchyContainer.hidden = false;
    dom.searchResultsContainer.hidden = true;
    renderSearchMessage(DEFAULTS.SEARCH_MESSAGE);
}

export function showSearchView() {
    updateState('isSearchActive', true);
    dom.hierarchyContainer.hidden = true;
    dom.searchResultsContainer.hidden = false;
}

async function executeSearch(query) {
    showSearchView();
    renderSearchMessage(DEFAULTS.SEARCH_LOADING_MESSAGE);

    try {
        const results = await api.searchPrompts(query);
        if (results) { // API function returns null if request is stale
            renderSearchResults(results);
        }
    } catch (error) {
        console.error(error);
        if (getStateValue('latestSearchRequest') === error.requestToken) { // Only show error for the latest request
            renderSearchMessage(DEFAULTS.SEARCH_ERROR_MESSAGE);
        }
    }
}

export function scheduleSearch(query, { immediate = false } = {}) {
    const trimmed = (query || '').trim();
    window.clearTimeout(getStateValue('searchDebounceTimer'));

    if (!trimmed) {
        updateState('latestSearchRequest', getStateValue('latestSearchRequest') + 1);
        showHierarchyView();
        return;
    }

    const runSearch = () => executeSearch(trimmed);

    if (immediate) {
        runSearch();
    } else {
        const timer = window.setTimeout(runSearch, CONFIG.SEARCH_DEBOUNCE_MS);
        updateState('searchDebounceTimer', timer);
    }
}

export function refreshSearchResultsIfNeeded() {
    if (!getStateValue('isSearchActive')) return;

    const query = dom.searchInput.value.trim();
    if (!query) {
        showHierarchyView();
        return;
    }
    scheduleSearch(query, { immediate: true });
}

export function initSearch() {
    renderSearchMessage(DEFAULTS.SEARCH_MESSAGE);
}
