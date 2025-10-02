import * as dom from './dom.js';
import * as api from './api.js';
import { MODAL_MODE, PROMPT_TYPE, DEFAULTS, getStateValue, updateState, setState } from './state.js';
import { setPromptType, clearTemplateBuilder, hydrateTemplateBuilder, collectTemplateConfiguration } from './template.js';
import { refreshNavigationTree } from './ui.js';
import { refreshSearchResultsIfNeeded } from './search.js';

function hideFormError() {
    dom.formError.hidden = true;
    dom.formError.textContent = '';
}

function showFormError(message) {
    dom.formError.textContent = message;
    dom.formError.hidden = false;
}

export function resetFormState() {
    dom.newPromptForm.reset();
    hideFormError();
    setPromptType(PROMPT_TYPE.SIMPLE);
    clearTemplateBuilder();
    if (dom.domainInput) {
        dom.domainInput.disabled = false;
        dom.domainInput.value = '';
    }
    if (dom.subtopicInput) {
        dom.subtopicInput.disabled = false;
        dom.subtopicInput.value = '';
    }
    dom.formSubmitButton.disabled = false;
    dom.formSubmitButton.textContent = DEFAULTS.SUBMIT_LABEL;
    dom.modalTitle.textContent = DEFAULTS.MODAL_TITLE;
    updateState('modalMode', MODAL_MODE.CREATE);
    updateState('editingPromptId', null);
}

async function populateDatalists() {
    const requestToken = getStateValue('latestDatalistRequest') + 1;
    updateState('latestDatalistRequest', requestToken);

    try {
        const structure = await api.getStructure();
        if (getStateValue('latestDatalistRequest') !== requestToken) return { aborted: true };

        updateState('promptHierarchy', structure || []);

        const domainNames = new Map();
        if (Array.isArray(structure)) {
            structure.forEach((domainItem) => {
                if (!domainItem || typeof domainItem !== 'object') return;
                const domainName = (domainItem.name || '').trim();
                if (domainName) domainNames.set(domainName.toLowerCase(), domainName);
            });
        }

        if (dom.domainDatalist) {
            dom.domainDatalist.innerHTML = '';
            const sorted = Array.from(domainNames.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            sorted.forEach((name) => {
                const option = dom.doc.createElement('option');
                option.value = name;
                dom.domainDatalist.appendChild(option);
            });
        }

        return { domainCount: domainNames.size };
    } catch (error) {
        console.error(error);
        if (getStateValue('latestDatalistRequest') !== requestToken) return { aborted: true };
        return { error: true };
    }
}

export function updateSubtopicDatalist(domainName) {
    const hierarchy = getStateValue('promptHierarchy');
    const subtopicDatalist = dom.subtopicDatalist;
    if (!subtopicDatalist) return;

    subtopicDatalist.innerHTML = '';
    const normalizedDomain = (domainName || '').trim().toLowerCase();
    if (!normalizedDomain) return;

    const domain = hierarchy.find(d => d.name.toLowerCase() === normalizedDomain);
    if (!domain || !Array.isArray(domain.subtopics)) return;

    const subtopicNames = domain.subtopics.map(s => s.name.trim()).filter(Boolean);
    const sorted = subtopicNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    sorted.forEach(name => {
        const option = dom.doc.createElement('option');
        option.value = name;
        subtopicDatalist.appendChild(option);
    });
}

export async function openPromptModal({ mode = MODAL_MODE.CREATE, promptData = null } = {}) {
    const isEdit = mode === MODAL_MODE.EDIT && promptData && typeof promptData.id === 'number';
    setState({
        modalMode: isEdit ? MODAL_MODE.EDIT : MODAL_MODE.CREATE,
        editingPromptId: isEdit ? promptData.id : null,
        activeModalTrigger: dom.doc.activeElement instanceof HTMLElement ? dom.doc.activeElement : null,
    });

    hideFormError();
    dom.newPromptForm.reset();
    clearTemplateBuilder();
    setPromptType(PROMPT_TYPE.SIMPLE);

    let initialDomain = '';
    let initialSubtopic = '';

    if (isEdit && promptData) {
        dom.newPromptForm.title.value = promptData.title || '';
        dom.newPromptForm.content.value = promptData.content || '';
        initialDomain = (promptData.domainName || '').trim();
        initialSubtopic = (promptData.subtopicName || '').trim();
        const isTemplatePrompt = Boolean(promptData.isTemplate);
        setPromptType(isTemplatePrompt ? PROMPT_TYPE.TEMPLATE : PROMPT_TYPE.SIMPLE);
        if (isTemplatePrompt) {
            hydrateTemplateBuilder(promptData.configurableOptions);
        }
    }

    if (dom.domainInput) {
        dom.domainInput.value = initialDomain;
        dom.domainInput.disabled = true;
    }
    if (dom.subtopicInput) {
        dom.subtopicInput.value = initialSubtopic;
        dom.subtopicInput.disabled = true;
    }
    dom.formSubmitButton.disabled = true;
    dom.formSubmitButton.textContent = DEFAULTS.LOADING_LABEL;
    const submitLabel = isEdit ? 'Update Prompt' : DEFAULTS.SUBMIT_LABEL;
    dom.modalTitle.textContent = isEdit ? 'Edit Prompt' : DEFAULTS.MODAL_TITLE;

    dom.body.classList.add('modal-open');
    dom.modalBackdrop.hidden = false;
    dom.modal.hidden = false;
    dom.modal.setAttribute('aria-hidden', 'false');

    window.requestAnimationFrame(() => {
        dom.modalBackdrop.classList.add('is-visible');
        dom.modal.classList.add('is-visible');
    });

    const result = await populateDatalists();
    if (result && result.aborted) {
        dom.formSubmitButton.textContent = submitLabel;
        return;
    }

    // Update subtopic datalist for existing domain in edit mode
    if (isEdit && initialDomain) {
        updateSubtopicDatalist(initialDomain);
    }

    if (dom.domainInput) dom.domainInput.disabled = false;
    if (dom.subtopicInput) dom.subtopicInput.disabled = false;
    dom.formSubmitButton.disabled = false;
    dom.formSubmitButton.textContent = submitLabel;

    if (result && result.error) {
        showFormError('Autocomplete suggestions are unavailable. Enter values manually.');
    }

    window.setTimeout(() => {
        const focusEl = isEdit ? dom.newPromptForm.title : dom.domainInput || dom.newPromptForm.title;
        focusEl.focus({ preventScroll: true });
    }, 120);
}

export function closePromptModal(restoreFocus = true) {
    if (dom.modal.hidden) {
        resetFormState();
        return;
    }

    dom.modal.classList.remove('is-visible');
    dom.modalBackdrop.classList.remove('is-visible');
    dom.modal.setAttribute('aria-hidden', 'true');
    dom.body.classList.remove('modal-open');

    window.setTimeout(() => {
        dom.modal.hidden = true;
        dom.modalBackdrop.hidden = true;
        resetFormState();
        const trigger = getStateValue('activeModalTrigger');
        if (restoreFocus && trigger instanceof HTMLElement) {
            trigger.focus({ preventScroll: true });
        }
        updateState('activeModalTrigger', null);
    }, 220);
}

export async function handleFormSubmit(event, onUpdate) {
    event.preventDefault();
    if (getStateValue('isSubmittingPrompt')) return;

    const { title, content } = dom.newPromptForm;
    const domainValue = dom.domainInput.value.trim();
    const subtopicValue = dom.subtopicInput.value.trim();
    const titleValue = title.value.trim();
    const contentValue = content.value.trim();

    hideFormError();

    const requiredFields = {
        Domain: { value: domainValue, focus: dom.domainInput },
        Subtopic: { value: subtopicValue, focus: dom.subtopicInput },
        Title: { value: titleValue, focus: title },
        Content: { value: contentValue, focus: content },
    };

    for (const [name, field] of Object.entries(requiredFields)) {
        if (!field.value) {
            showFormError(`${name} is required.`);
            field.focus.focus({ preventScroll: true });
            return;
        }
    }

    const payload = { title: titleValue, content: contentValue, domain_name: domainValue, subtopic_name: subtopicValue };

    if (getStateValue('currentPromptType') === PROMPT_TYPE.TEMPLATE) {
        const configResult = collectTemplateConfiguration();
        if (configResult.error) {
            showFormError(configResult.error);
            if (configResult.focus instanceof HTMLElement) configResult.focus.focus({ preventScroll: true });
            return;
        }
        payload.is_template = true;
        payload.configurable_options = configResult.value;
    } else {
        payload.is_template = false;
        payload.configurable_options = null;
    }

    updateState('isSubmittingPrompt', true);
    dom.formSubmitButton.disabled = true;
    dom.formSubmitButton.textContent = DEFAULTS.SAVING_LABEL;

    try {
        const editingId = getStateValue('editingPromptId');
        const responseBody = await api.savePrompt(payload, editingId);

        closePromptModal(false);
        const buttonToFocus = await refreshNavigationTree(responseBody.id);

        if (typeof onUpdate === 'function') {
            onUpdate(responseBody, buttonToFocus);
        }

        refreshSearchResultsIfNeeded();

        window.setTimeout(() => {
            if (buttonToFocus instanceof HTMLElement) buttonToFocus.focus({ preventScroll: true });
        }, 260);
    } catch (error) {
        console.error(error);
        if (error.response && error.response.status === 404) {
            showFormError('Prompt not found. It may have been deleted.');
            await refreshNavigationTree();
            refreshSearchResultsIfNeeded();
        } else {
            const errorMessage = error.body && error.body.errors ? Object.values(error.body.errors).join(' ') : 'Unable to save prompt.';
            showFormError(errorMessage);
        }
    } finally {
        updateState('isSubmittingPrompt', false);
        if (!dom.modal.hidden) {
            dom.formSubmitButton.disabled = false;
            dom.formSubmitButton.textContent = getStateValue('modalMode') === MODAL_MODE.EDIT ? 'Update Prompt' : DEFAULTS.SUBMIT_LABEL;
        }
    }
}
