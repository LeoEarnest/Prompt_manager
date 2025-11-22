import * as dom from './modules/dom.js';
import * as api from './modules/api.js';
import { MODAL_MODE, PROMPT_TYPE, DEFAULTS, setState, getStateValue } from './modules/state.js';
import { openPromptModal, closePromptModal, handleFormSubmit, updateSubtopicDatalist, bindImageInputHandlers } from './modules/modal.js';
import { scheduleSearch, refreshSearchResultsIfNeeded, initSearch } from './modules/search.js';
import { setPromptType, createCategoryElement, renderTemplatePromptDetail } from './modules/template.js';
import {
    setPromptContent,
    resetPromptDetailPanel,
    enableDetailActions,
    disableDetailActions,
    showCopyFeedback,
    enableCopyButton,
    refreshNavigationTree,
    getFirstPromptButton,
    initUI,
    setDomainExpanded,
    setSubtopicExpanded,
} from './modules/ui.js';

function handleSuccessfulUpdate(responseBody, buttonToFocus) {
    const currentPromptId = getStateValue('currentPromptId');
    if (getStateValue('modalMode') === MODAL_MODE.EDIT && currentPromptId === responseBody.id) {
        const newMeta = {
            id: responseBody.id,
            title: responseBody.title || '',
            content: responseBody.content || '',
            subtopicId: responseBody.subtopic_id,
            subtopicName: responseBody.subtopic_name || 'Subtopic',
            domainId: responseBody.domain_id,
            domainName: responseBody.domain_name || 'Domain',
            isTemplate: Boolean(responseBody.is_template),
            configurableOptions: responseBody.configurable_options || null,
            images: Array.isArray(responseBody.images) ? responseBody.images : [],
        };
        setState({ currentPromptMeta: newMeta, currentPromptNavButton: buttonToFocus || null });

        dom.breadcrumbDomain.textContent = newMeta.domainName;
        dom.breadcrumbSubtopic.textContent = newMeta.subtopicName;
        dom.promptTitle.textContent = newMeta.title || DEFAULTS.PROMPT_TITLE;

        if (newMeta.isTemplate) {
            renderTemplatePromptDetail(newMeta);
        } else {
            setPromptContent(newMeta.content || '', newMeta.images, newMeta.id);
            enableCopyButton(newMeta.content || '');
        }
        enableDetailActions();
    }
}

async function handleNavPanelClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    // Case 1: Click on a collapsible header (Domain or Subtopic)
    const header = target.closest('.collapsible-header');
    if (header) {
        event.preventDefault();
        const content = header.nextElementSibling;
        let isExpanded = false;
        if (content && content.classList.contains('collapsible-content')) {
            header.classList.toggle('expanded');
            content.classList.toggle('expanded');
            isExpanded = header.classList.contains('expanded');
        }

        const subtopicEl = header.closest('.subtopic');
        const domainEl = header.closest('.domain');
        if (subtopicEl && subtopicEl.dataset.subtopicId) {
            setSubtopicExpanded(subtopicEl.dataset.subtopicId, isExpanded);
        } else if (domainEl && domainEl.dataset.domainId) {
            setDomainExpanded(domainEl.dataset.domainId, isExpanded);
        }
        return;
    }

    // Case 2: Click on a prompt button
    const trigger = target.closest('.prompt-button');
    if (trigger) {
        event.preventDefault();

        const promptId = Number(trigger.dataset.id);
        if (!promptId) return;

        const domainName = trigger.dataset.domain || 'Domain';
        const subtopicName = trigger.dataset.subtopic || 'Subtopic';
        if (trigger.dataset.domainId) {
            setDomainExpanded(trigger.dataset.domainId, true);
        }
        if (trigger.dataset.subtopicId) {
            setSubtopicExpanded(trigger.dataset.subtopicId, true);
        }

        setState({
            currentPromptId: promptId,
            currentPromptNavButton: trigger,
            currentPromptMeta: { id: promptId, domainName, subtopicName },
        });

        dom.breadcrumbDomain.textContent = domainName;
        dom.breadcrumbSubtopic.textContent = subtopicName;
        dom.promptTitle.textContent = 'Loading prompt...';
        setPromptContent('Fetching prompt content...');
        disableDetailActions();

        dom.appContainer.classList.add('detail-view-active');
        dom.backButton.focus({ preventScroll: true });

        try {
            const payload = await api.getPrompt(promptId);
            if (!payload) return; // Stale request

            const newMeta = {
                ...getStateValue('currentPromptMeta'),
                title: payload.title || DEFAULTS.PROMPT_TITLE,
                content: payload.content || '',
                isTemplate: Boolean(payload.is_template),
                configurableOptions: payload.configurable_options || null,
                images: Array.isArray(payload.images) ? payload.images : [],
            };
            setState({ currentPromptMeta: newMeta });

            dom.promptTitle.textContent = newMeta.title;
            if (newMeta.isTemplate) {
                renderTemplatePromptDetail(newMeta);
            } else {
                setPromptContent(newMeta.content || '', newMeta.images, newMeta.id);
                enableCopyButton(newMeta.content || '');
            }
            enableDetailActions();
            window.scrollTo(0, 0);
        } catch (error) {
            console.error(error);
            dom.promptTitle.textContent = 'Unable to load prompt';
            setPromptContent('Please try again in a moment.');
            disableDetailActions();
        }
    }
}

async function handleDeleteClick(event) {
    event.preventDefault();
    const meta = getStateValue('currentPromptMeta');
    if (!meta || typeof meta.id !== 'number') return;

    if (!window.confirm('Are you sure you want to delete this prompt?')) return;

    try {
        await api.deletePrompt(meta.id);
        resetPromptDetailPanel();
        dom.appContainer.classList.remove('detail-view-active');

        const buttonToFocus = (await refreshNavigationTree()) || getFirstPromptButton() || dom.newPromptButton;
        refreshSearchResultsIfNeeded();

        window.setTimeout(() => {
            if (buttonToFocus instanceof HTMLElement) buttonToFocus.focus({ preventScroll: true });
        }, 120);
    } catch (error) {
        console.error(error);
        if (error.response && error.response.status === 404) {
            await refreshNavigationTree();
            resetPromptDetailPanel();
            refreshSearchResultsIfNeeded();
            window.alert('Prompt not found. It may have already been deleted.');
        } else {
            window.alert('Unable to delete prompt. Please try again.');
        }
    }
}

async function handlePromptImageDelete(event) {
    const button = event.target.closest('[data-role="delete-image"]');
    if (!button) return;
    event.preventDefault();

    const promptId = Number(button.dataset.promptId);
    const imageId = Number(button.dataset.imageId);
    if (!promptId || !imageId) return;

    if (!window.confirm('删除这张图片？')) return;

    try {
        await api.deletePromptImage(promptId, imageId);
        const payload = await api.getPrompt(promptId);
        if (!payload) return;

        const meta = {
            ...(getStateValue('currentPromptMeta') || {}),
            id: promptId,
            title: payload.title || DEFAULTS.PROMPT_TITLE,
            content: payload.content || '',
            isTemplate: Boolean(payload.is_template),
            configurableOptions: payload.configurable_options || null,
            images: Array.isArray(payload.images) ? payload.images : [],
        };
        setState({ currentPromptMeta: meta, currentPromptId: promptId });

        if (meta.isTemplate) {
            renderTemplatePromptDetail(meta);
        } else {
            setPromptContent(meta.content || '', meta.images, meta.id);
            enableCopyButton(meta.content || '');
        }
        enableDetailActions();
    } catch (error) {
        console.error(error);
        window.alert('删除图片失败，请稍后重试。');
    }
}

function initialize() {
    if (!dom.validateDomElements()) {
        console.error('Missing critical DOM elements. Aborting initialization.');
        return;
    }

    // Initial Render
    refreshNavigationTree();
    initUI();
    initSearch();
    setPromptType(PROMPT_TYPE.SIMPLE);
    bindImageInputHandlers();

    // Event Listeners
    dom.navPanel.addEventListener('click', handleNavPanelClick);
    dom.searchInput.addEventListener('input', () => scheduleSearch(dom.searchInput.value));
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            scheduleSearch(dom.searchInput.value, { immediate: true });
        }
    });

    dom.backButton.addEventListener('click', () => {
        dom.appContainer.classList.remove('detail-view-active');
        const firstButton = getFirstPromptButton();
        if (firstButton) firstButton.focus({ preventScroll: true });
    });

    dom.copyButton.addEventListener('click', async () => {
        const text = getStateValue('currentPromptText');
        if (!text || dom.copyButton.disabled) return;
        try {
            await navigator.clipboard.writeText(text);
            showCopyFeedback('Copied!');
        } catch (error) {
            console.error(error);
            showCopyFeedback('Copy failed');
        }
    });

    dom.editButton.addEventListener('click', (e) => {
        e.preventDefault();
        const meta = getStateValue('currentPromptMeta');
        if (!meta || typeof meta.id !== 'number') return;
        openPromptModal({ mode: MODAL_MODE.EDIT, promptData: meta });
    });

    dom.deleteButton.addEventListener('click', handleDeleteClick);

    dom.newPromptButton.addEventListener('click', (e) => {
        e.preventDefault();
        if (!dom.modal.hidden) return;
        openPromptModal({ mode: MODAL_MODE.CREATE });
    });

    dom.modalCloseButton.addEventListener('click', () => closePromptModal());
    dom.formCancelButton.addEventListener('click', () => closePromptModal());
    dom.modalBackdrop.addEventListener('click', () => closePromptModal());
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !dom.modal.hidden) {
            e.preventDefault();
            closePromptModal();
        }
    });

    dom.promptTypeRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            setPromptType(radio.value);
            if (getStateValue('currentPromptType') === PROMPT_TYPE.TEMPLATE && !dom.templateCategoryList.querySelector('[data-role="template-category"]')) {
                createCategoryElement();
            }
        });
    });

    dom.addCategoryButton.addEventListener('click', () => {
        const categoryElement = createCategoryElement();
        const nameInput = categoryElement.querySelector('[data-role="category-name-input"]');
        if (nameInput) nameInput.focus({ preventScroll: true });
    });

    dom.newPromptForm.addEventListener('submit', (e) => handleFormSubmit(e, handleSuccessfulUpdate));

    const setupInputClearButton = (input, button) => {
        const toggleButton = () => {
            const hasValue = input.value.trim() !== '';
            button.classList.toggle('is-visible', hasValue);
        };

        button.addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
        });

        input.addEventListener('input', toggleButton);
        toggleButton(); // Initial check
    };

    setupInputClearButton(dom.domainInput, dom.clearDomainButton);
    setupInputClearButton(dom.subtopicInput, dom.clearSubtopicButton);

    dom.domainInput.addEventListener('input', () => {
        dom.subtopicInput.value = '';
        updateSubtopicDatalist(dom.domainInput.value);
        // Manually trigger the visibility check for the subtopic clear button
        dom.clearSubtopicButton.classList.remove('is-visible');
    });

    dom.promptContent.addEventListener('click', handlePromptImageDelete);
}

document.addEventListener('DOMContentLoaded', initialize);
