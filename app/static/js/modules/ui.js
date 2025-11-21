import * as dom from './dom.js';
import * as api from './api.js';
import { DEFAULTS, updateState, getStateValue, escapeSelector } from './state.js';

export function setPromptContent(text) {
    updateState('activeTemplateDetail', null);
    dom.promptContent.textContent = text;
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
}

export async function refreshNavigationTree(focusPromptId = null) {
    try {
        const structure = await api.getStructure();
        renderHierarchy(structure);

        if (focusPromptId) {
            const selector = `.prompt-button[data-id="${escapeSelector(String(focusPromptId))}"]`;
            const buttonToFocus = dom.hierarchyContainer.querySelector(selector);
            if (buttonToFocus) {
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
