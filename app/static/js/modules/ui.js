import * as dom from './dom.js';
import * as api from './api.js';
import { DEFAULTS, updateState, getStateValue, escapeSelector } from './state.js';

const NAV_EXPANSION_STORAGE_KEY = 'promptManager.navExpansion';

const createEmptyExpansionState = () => ({
    domains: new Set(),
    subtopics: new Set(),
});

const loadExpansionState = () => {
    const fallback = createEmptyExpansionState();
    try {
        if (!window.localStorage) return fallback;
        const raw = window.localStorage.getItem(NAV_EXPANSION_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        const domains = new Set(Array.isArray(parsed?.domains) ? parsed.domains.map(String) : []);
        const subtopics = new Set(Array.isArray(parsed?.subtopics) ? parsed.subtopics.map(String) : []);
        return { domains, subtopics };
    } catch (error) {
        console.warn('Failed to read nav expansion state from storage:', error);
        return fallback;
    }
};

const persistExpansionState = (state) => {
    try {
        if (!window.localStorage) return;
        const payload = {
            domains: Array.from(state.domains),
            subtopics: Array.from(state.subtopics),
        };
        window.localStorage.setItem(NAV_EXPANSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Failed to persist nav expansion state:', error);
    }
};

const navExpansionState = loadExpansionState();

const applyHeaderExpansion = (headerEl, contentEl, isExpanded) => {
    if (headerEl) headerEl.classList.toggle('expanded', isExpanded);
    if (contentEl) contentEl.classList.toggle('expanded', isExpanded);
};

export const setDomainExpanded = (domainId, isExpanded) => {
    if (!domainId) return;
    const key = String(domainId);
    if (isExpanded) {
        navExpansionState.domains.add(key);
    } else {
        navExpansionState.domains.delete(key);
    }
    persistExpansionState(navExpansionState);
};

export const setSubtopicExpanded = (subtopicId, isExpanded) => {
    if (!subtopicId) return;
    const key = String(subtopicId);
    if (isExpanded) {
        navExpansionState.subtopics.add(key);
    } else {
        navExpansionState.subtopics.delete(key);
    }
    persistExpansionState(navExpansionState);
};

const applyStoredExpansions = () => {
    if (!dom.hierarchyContainer) return;

    const domainSelector = '.domain';
    dom.hierarchyContainer.querySelectorAll(domainSelector).forEach((domainEl) => {
        const domainId = domainEl.dataset.domainId ? String(domainEl.dataset.domainId) : null;
        const shouldExpand = domainId ? navExpansionState.domains.has(domainId) : false;
        const header = domainEl.querySelector('.domain-name.collapsible-header');
        const content = domainEl.querySelector('.subtopics.collapsible-content');
        applyHeaderExpansion(header, content, shouldExpand);
    });

    const subtopicSelector = '.subtopic';
    dom.hierarchyContainer.querySelectorAll(subtopicSelector).forEach((subtopicEl) => {
        const subtopicId = subtopicEl.dataset.subtopicId ? String(subtopicEl.dataset.subtopicId) : null;
        const shouldExpand = subtopicId ? navExpansionState.subtopics.has(subtopicId) : false;
        const header = subtopicEl.querySelector('.subtopic-name.collapsible-header');
        const content = subtopicEl.querySelector('.prompt-list.collapsible-content');
        applyHeaderExpansion(header, content, shouldExpand);
    });
};

const expandPromptAncestors = (promptButton) => {
    if (!promptButton || !dom.hierarchyContainer) return;

    const { domainId, subtopicId } = promptButton.dataset;

    if (domainId) {
        const domainEl = dom.hierarchyContainer.querySelector(
            `[data-domain-id="${escapeSelector(String(domainId))}"]`
        );
        if (domainEl) {
            const header = domainEl.querySelector('.domain-name.collapsible-header');
            const content = domainEl.querySelector('.subtopics.collapsible-content');
            applyHeaderExpansion(header, content, true);
            setDomainExpanded(domainId, true);
        }
    }

    if (subtopicId) {
        const subtopicEl = dom.hierarchyContainer.querySelector(
            `[data-subtopic-id="${escapeSelector(String(subtopicId))}"]`
        );
        if (subtopicEl) {
            const header = subtopicEl.querySelector('.subtopic-name.collapsible-header');
            const content = subtopicEl.querySelector('.prompt-list.collapsible-content');
            applyHeaderExpansion(header, content, true);
            setSubtopicExpanded(subtopicId, true);
        }
    }
};

export function renderPromptGallery(images = [], promptId = null) {
    if (!Array.isArray(images) || images.length === 0) return null;

    const gallery = dom.doc.createElement('div');
    gallery.className = 'prompt-images';

    images.forEach((image) => {
        if (!image || !image.url) return;
        const figure = dom.doc.createElement('figure');
        figure.className = 'prompt-images__item';

        const img = dom.doc.createElement('img');
        img.src = image.url;
        img.alt = image.filename || 'Prompt image';
        img.loading = 'lazy';

        figure.appendChild(img);

        if (promptId && image.id) {
            const removeButton = dom.doc.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'prompt-images__remove';
            removeButton.dataset.imageId = image.id;
            removeButton.dataset.promptId = promptId;
            removeButton.dataset.role = 'delete-image';
            removeButton.setAttribute('aria-label', 'Remove image');
            removeButton.textContent = '×';
            figure.appendChild(removeButton);
        }

        gallery.appendChild(figure);
    });

    return gallery.childElementCount ? gallery : null;
}

export function setPromptContent(text, images = [], promptId = null) {
    updateState('activeTemplateDetail', null);
    dom.promptContent.innerHTML = '';

    const textBlock = dom.doc.createElement('pre');
    textBlock.className = 'prompt-content__text';
    textBlock.textContent = text;
    dom.promptContent.appendChild(textBlock);

    const gallery = renderPromptGallery(images, promptId);
    if (gallery) {
        dom.promptContent.appendChild(gallery);
    }
}

function clearCopyResetTimer() {
    const timer = getStateValue('copyResetTimer');
    if (timer) {
        window.clearTimeout(timer);
        updateState('copyResetTimer', null);
    }
}

export function resetCopyButtonLabel() {
    clearCopyResetTimer();
    dom.copyButton.textContent = DEFAULTS.COPY_LABEL;
}

export function disableCopyButton() {
    clearCopyResetTimer();
    updateState('currentPromptText', '');
    dom.copyButton.disabled = true;
    dom.copyButton.textContent = DEFAULTS.COPY_LABEL;
}

export function enableCopyButton(text) {
    clearCopyResetTimer();
    updateState('currentPromptText', text ?? '');
    dom.copyButton.disabled = false;
    dom.copyButton.textContent = DEFAULTS.COPY_LABEL;
}

export function showCopyFeedback(message) {
    clearCopyResetTimer();
    dom.copyButton.textContent = message;
    const timer = window.setTimeout(() => {
        dom.copyButton.textContent = DEFAULTS.COPY_LABEL;
        updateState('copyResetTimer', null);
    }, 2000);
    updateState('copyResetTimer', timer);
}

export function disableDetailActions() {
    dom.editButton.disabled = true;
    dom.deleteButton.disabled = true;
}

export function enableDetailActions() {
    dom.editButton.disabled = false;
    dom.deleteButton.disabled = false;
}

export function resetPromptDetailPanel() {
    updateState('currentPromptId', null);
    updateState('currentPromptNavButton', null);
    updateState('currentPromptMeta', null);
    dom.breadcrumbDomain.textContent = 'Domain';
    dom.breadcrumbSubtopic.textContent = 'Subtopic';
    dom.promptTitle.textContent = DEFAULTS.PROMPT_TITLE;
    setPromptContent(DEFAULTS.PROMPT_MESSAGE);
    disableCopyButton();
    resetCopyButtonLabel();
    disableDetailActions();
}

export function renderHierarchy(structure) {
    if (!dom.hierarchyContainer) return;
    dom.hierarchyContainer.innerHTML = '';

    if (!Array.isArray(structure) || structure.length === 0) {
        const emptyState = dom.doc.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'Seed the database to view your prompt hierarchy.';
        dom.hierarchyContainer.appendChild(emptyState);
        return;
    }

    structure.forEach((domain) => {
        const domainArticle = dom.doc.createElement('article');
        domainArticle.className = 'domain';
        domainArticle.dataset.domainId = domain.id;
        domainArticle.dataset.domainName = domain.name;

        const domainH2 = dom.doc.createElement('h2');
        domainH2.className = 'domain-name collapsible-header';
        domainH2.textContent = domain.name;
        domainArticle.appendChild(domainH2);

        const subtopicsDiv = dom.doc.createElement('div');
        subtopicsDiv.className = 'subtopics collapsible-content';

        const sortedSubtopics = (domain.subtopics || []).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

        if (sortedSubtopics.length > 0) {
            sortedSubtopics.forEach((subtopic) => {
                const subtopicSection = dom.doc.createElement('section');
                subtopicSection.className = 'subtopic';
                subtopicSection.dataset.subtopicId = subtopic.id;
                subtopicSection.dataset.subtopicName = subtopic.name;

                const subtopicH3 = dom.doc.createElement('h3');
                subtopicH3.className = 'subtopic-name collapsible-header';
                subtopicH3.textContent = subtopic.name;
                subtopicSection.appendChild(subtopicH3);

                const promptListUl = dom.doc.createElement('ul');
                promptListUl.className = 'prompt-list collapsible-content';
                promptListUl.setAttribute('aria-label', `Prompts for ${subtopic.name}`);

                const sortedPrompts = (subtopic.prompts || []).slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

                if (sortedPrompts.length > 0) {
                    sortedPrompts.forEach((prompt) => {
                        const promptLi = dom.doc.createElement('li');
                        promptLi.className = 'prompt-list-item';
                        const promptButton = dom.doc.createElement('button');
                        promptButton.className = 'prompt-button';
                        promptButton.type = 'button';
                        promptButton.dataset.id = prompt.id;
                        promptButton.dataset.domain = domain.name;
                        promptButton.dataset.domainId = domain.id;
                        promptButton.dataset.subtopic = subtopic.name;
                        promptButton.dataset.subtopicId = subtopic.id;
                        promptButton.textContent = prompt.title;
                        promptLi.appendChild(promptButton);
                        promptListUl.appendChild(promptLi);
                    });
                } else {
                    const emptyLi = dom.doc.createElement('li');
                    emptyLi.className = 'empty-state';
                    emptyLi.dataset.role = 'empty-prompts';
                    emptyLi.textContent = 'No prompts yet.';
                    promptListUl.appendChild(emptyLi);
                }
                subtopicSection.appendChild(promptListUl);
                subtopicsDiv.appendChild(subtopicSection);
            });
        } else {
            const emptyP = dom.doc.createElement('p');
            emptyP.className = 'empty-state';
            emptyP.textContent = 'No subtopics yet.';
            subtopicsDiv.appendChild(emptyP);
        }
        domainArticle.appendChild(subtopicsDiv);
        dom.hierarchyContainer.appendChild(domainArticle);
    });

    applyStoredExpansions();
}

export async function refreshNavigationTree(focusPromptId = null) {
    try {
        const structure = await api.getStructure();
        renderHierarchy(structure);

        if (focusPromptId) {
            const selector = `.prompt-button[data-id="${escapeSelector(String(focusPromptId))}"]`;
            const buttonToFocus = dom.hierarchyContainer.querySelector(selector);
            if (buttonToFocus) {
                expandPromptAncestors(buttonToFocus);
                return buttonToFocus;
            }
        }
        return null;
    } catch (error) {
        console.error('Failed to refresh navigation tree:', error);
        return null;
    }
}

export function getFirstPromptButton() {
    const isSearchActive = getStateValue('isSearchActive');
    if (isSearchActive && !dom.searchResultsContainer.hidden) {
        return dom.searchResultsContainer.querySelector('.prompt-button');
    }
    if (dom.hierarchyContainer && !dom.hierarchyContainer.hidden) {
        return dom.hierarchyContainer.querySelector('.prompt-button');
    }
    return dom.navPanel.querySelector('.prompt-button');
}

export function initUI() {
    if (!dom.promptTitle.textContent) {
        dom.promptTitle.textContent = DEFAULTS.PROMPT_TITLE;
    }
    if (!dom.promptContent.textContent || !dom.promptContent.textContent.trim()) {
        setPromptContent(DEFAULTS.PROMPT_MESSAGE);
    }
    disableCopyButton();
    disableDetailActions();
}
