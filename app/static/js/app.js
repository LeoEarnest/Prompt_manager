(() => {
    const doc = document;

    const appContainer = doc.getElementById('app-container');
    const navPanel = doc.getElementById('nav-panel');
    const breadcrumbDomain = doc.querySelector('[data-role="breadcrumb-domain"]');
    const breadcrumbSubtopic = doc.querySelector('[data-role="breadcrumb-subtopic"]');
    const promptTitle = doc.querySelector('[data-role="prompt-title"]');
    const promptContent = doc.querySelector('[data-role="prompt-content"]');
    const backButton = doc.querySelector('[data-role="back-button"]');
    const copyButton = doc.querySelector('[data-role="copy-button"]');
    const newPromptButton = doc.querySelector('[data-role="new-prompt-button"]');
    const modal = doc.querySelector('[data-role="new-prompt-modal"]');
    const modalBackdrop = doc.querySelector('[data-role="modal-backdrop"]');
    const modalCloseButton = doc.querySelector('[data-role="modal-close-button"]');
    const newPromptForm = doc.querySelector('[data-role="new-prompt-form"]');
    const subtopicSelect = doc.querySelector('[data-role="subtopic-select"]');
    const formError = doc.querySelector('[data-role="form-error"]');
    const formCancelButton = doc.querySelector('[data-role="form-cancel-button"]');
    const formSubmitButton = doc.querySelector('[data-role="form-submit-button"]');

    if (
        !appContainer ||
        !navPanel ||
        !breadcrumbDomain ||
        !breadcrumbSubtopic ||
        !promptTitle ||
        !promptContent ||
        !backButton ||
        !copyButton ||
        !newPromptButton ||
        !modal ||
        !modalBackdrop ||
        !modalCloseButton ||
        !newPromptForm ||
        !subtopicSelect ||
        !formError ||
        !formCancelButton ||
        !formSubmitButton
    ) {
        return;
    }

    const body = document.body;
    const DEFAULT_PROMPT_TITLE = 'Select a prompt to preview';
    const DEFAULT_PROMPT_MESSAGE = 'When you pick a prompt from the navigation panel it will appear here in focus mode.';
    const DEFAULT_COPY_LABEL = 'Copy to Clipboard';
    const DEFAULT_SUBMIT_LABEL = formSubmitButton.textContent.trim() || 'Save Prompt';
    const LOADING_SUBMIT_LABEL = 'Loading...';
    const SAVING_SUBMIT_LABEL = 'Saving...';

    let currentPromptText = '';
    let copyResetTimer = null;
    let latestRequestToken = 0;
    let latestSubtopicRequest = 0;
    let activeModalTrigger = null;
    let isSubmittingPrompt = false;

    const escapeSelector = (value) => {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return String(value).replace(/[^a-zA-Z0-9_\-]/g, (match) => `\\${match}`);
    };

    const setPromptContent = (text) => {
        promptContent.textContent = text;
    };

    const clearCopyResetTimer = () => {
        if (copyResetTimer) {
            window.clearTimeout(copyResetTimer);
            copyResetTimer = null;
        }
    };

    const resetCopyButtonLabel = () => {
        clearCopyResetTimer();
        copyButton.textContent = DEFAULT_COPY_LABEL;
    };

    const disableCopyButton = () => {
        clearCopyResetTimer();
        currentPromptText = '';
        copyButton.disabled = true;
        copyButton.textContent = DEFAULT_COPY_LABEL;
    };

    const enableCopyButton = (text) => {
        clearCopyResetTimer();
        currentPromptText = text ?? '';
        copyButton.disabled = false;
        copyButton.textContent = DEFAULT_COPY_LABEL;
    };

    const showCopyFeedback = (message) => {
        clearCopyResetTimer();
        copyButton.textContent = message;
        copyResetTimer = window.setTimeout(() => {
            copyButton.textContent = DEFAULT_COPY_LABEL;
            copyResetTimer = null;
        }, 2000);
    };

    const hideFormError = () => {
        formError.hidden = true;
        formError.textContent = '';
    };

    const showFormError = (message) => {
        formError.textContent = message;
        formError.hidden = false;
    };

    const resetFormState = () => {
        newPromptForm.reset();
        hideFormError();
        subtopicSelect.disabled = false;
        formSubmitButton.disabled = false;
        formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
    };

    const appendPromptToNav = (promptData) => {
        if (!promptData || typeof promptData !== 'object') {
            return null;
        }

        const promptId = promptData.id;
        const title = (promptData.title || '').trim();
        const domainName = (promptData.domain_name || '').trim() || 'Domain';
        const subtopicName = (promptData.subtopic_name || '').trim() || 'Subtopic';
        const subtopicId = typeof promptData.subtopic_id === 'number' ? promptData.subtopic_id : Number(promptData.subtopic_id);

        if (!promptId || !title || Number.isNaN(subtopicId)) {
            return null;
        }

        const selectorValue = escapeSelector(String(subtopicId));
        const subtopicSection = navPanel.querySelector(`.subtopic[data-subtopic-id="${selectorValue}"]`);
        if (!subtopicSection) {
            return null;
        }

        const promptList = subtopicSection.querySelector('.prompt-list');
        if (!promptList) {
            return null;
        }

        const emptyState = promptList.querySelector('[data-role="empty-prompts"]');
        if (emptyState) {
            emptyState.remove();
        }

        const newButton = doc.createElement('button');
        newButton.type = 'button';
        newButton.className = 'prompt-button';
        newButton.dataset.id = String(promptId);
        newButton.dataset.domain = domainName;
        newButton.dataset.subtopic = subtopicName;
        newButton.textContent = title;

        const listItem = doc.createElement('li');
        listItem.className = 'prompt-list-item';
        listItem.appendChild(newButton);

        const existingButtons = Array.from(promptList.querySelectorAll('.prompt-button'));
        const insertIndex = existingButtons.findIndex((button) => {
            const text = button.textContent ? button.textContent.trim().toLowerCase() : '';
            return text > title.toLowerCase();
        });

        if (insertIndex === -1) {
            promptList.appendChild(listItem);
        } else {
            const referenceItem = existingButtons[insertIndex].closest('li');
            if (referenceItem) {
                promptList.insertBefore(listItem, referenceItem);
            } else {
                promptList.appendChild(listItem);
            }
        }

        return newButton;
    };

    const populateSubtopics = async () => {
        latestSubtopicRequest += 1;
        const requestToken = latestSubtopicRequest;

        subtopicSelect.innerHTML = '<option value="">Select a subtopic</option>';

        try {
            const response = await fetch('/api/subtopics');
            if (!response.ok) {
                throw new Error(`Failed to fetch subtopics: ${response.status}`);
            }

            const items = await response.json();
            if (requestToken !== latestSubtopicRequest) {
                return { aborted: true };
            }

            if (!Array.isArray(items) || items.length === 0) {
                return { count: 0 };
            }

            items.forEach((subtopic) => {
                if (!subtopic || typeof subtopic !== 'object') {
                    return;
                }
                const option = doc.createElement('option');
                option.value = String(subtopic.id);
                const domainName = subtopic.domain && subtopic.domain.name ? subtopic.domain.name : 'Domain';
                const name = subtopic.name || 'Subtopic';
                option.textContent = `${domainName} - ${name}`;
                option.dataset.domainId = subtopic.domain && subtopic.domain.id ? String(subtopic.domain.id) : '';
                option.dataset.domainName = domainName;
                option.dataset.subtopicName = name;
                subtopicSelect.appendChild(option);
            });

            return { count: items.length };
        } catch (error) {
            console.error(error);
            if (requestToken !== latestSubtopicRequest) {
                return { aborted: true };
            }
            return { error: true };
        }
    };

    const openCreatePromptModal = async () => {
        activeModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        newPromptForm.reset();
        hideFormError();
        subtopicSelect.disabled = true;
        formSubmitButton.disabled = true;
        formSubmitButton.textContent = LOADING_SUBMIT_LABEL;

        body.classList.add('modal-open');
        modalBackdrop.hidden = false;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');

        window.requestAnimationFrame(() => {
            modalBackdrop.classList.add('is-visible');
            modal.classList.add('is-visible');
        });

        const result = await populateSubtopics();
        if (result && result.aborted) {
            formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
            return;
        }

        if (result && result.error) {
            showFormError('Unable to load subtopics. Please try again.');
            subtopicSelect.disabled = true;
            formSubmitButton.disabled = true;
            formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
            return;
        }

        if (!result || result.count === 0) {
            showFormError('Add a subtopic before creating prompts.');
            subtopicSelect.disabled = true;
            formSubmitButton.disabled = true;
            formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
            return;
        }

        subtopicSelect.disabled = false;
        formSubmitButton.disabled = false;
        formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
        window.setTimeout(() => {
            subtopicSelect.focus({ preventScroll: true });
        }, 120);
    };

    const closeCreatePromptModal = (restoreFocus = true) => {
        if (modal.hidden) {
            resetFormState();
            return;
        }

        modal.classList.remove('is-visible');
        modalBackdrop.classList.remove('is-visible');
        modal.setAttribute('aria-hidden', 'true');
        body.classList.remove('modal-open');

        window.setTimeout(() => {
            modal.hidden = true;
            modalBackdrop.hidden = true;
            resetFormState();
            if (restoreFocus && activeModalTrigger instanceof HTMLElement) {
                activeModalTrigger.focus({ preventScroll: true });
            }
            activeModalTrigger = null;
        }, 220);
    };

    navPanel.addEventListener('click', async (event) => {
        const trigger = event.target instanceof Element ? event.target.closest('.prompt-button') : null;
        if (!trigger) {
            return;
        }

        event.preventDefault();

        const promptId = trigger.dataset.id;
        if (!promptId) {
            return;
        }

        const domainName = trigger.dataset.domain || 'Domain';
        const subtopicName = trigger.dataset.subtopic || 'Subtopic';

        breadcrumbDomain.textContent = domainName;
        breadcrumbSubtopic.textContent = subtopicName;
        promptTitle.textContent = 'Loading prompt...';
        setPromptContent('Fetching prompt content...');
        disableCopyButton();

        const requestToken = ++latestRequestToken;

        appContainer.classList.add('detail-view-active');
        backButton.focus({ preventScroll: true });

        try {
            const response = await fetch(`/api/prompts/${promptId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch prompt: ${response.status}`);
            }

            const payload = await response.json();

            if (requestToken !== latestRequestToken) {
                return;
            }

            promptTitle.textContent = payload.title || DEFAULT_PROMPT_TITLE;
            setPromptContent(payload.content || '');
            enableCopyButton(payload.content || '');
        } catch (error) {
            if (requestToken !== latestRequestToken) {
                return;
            }

            console.error(error);
            promptTitle.textContent = 'Unable to load prompt';
            setPromptContent('Please try again in a moment.');
            disableCopyButton();
        }
    });

    backButton.addEventListener('click', () => {
        appContainer.classList.remove('detail-view-active');
        resetCopyButtonLabel();
        const firstPromptButton = navPanel.querySelector('.prompt-button');
        if (firstPromptButton) {
            firstPromptButton.focus({ preventScroll: true });
        }
    });

    copyButton.addEventListener('click', async () => {
        if (!currentPromptText || copyButton.disabled) {
            return;
        }

        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
            showCopyFeedback('Clipboard unavailable');
            return;
        }

        try {
            await navigator.clipboard.writeText(currentPromptText);
            showCopyFeedback('Copied!');
        } catch (error) {
            console.error(error);
            showCopyFeedback('Copy failed');
        }
    });

    newPromptButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (!modal.hidden && modal.classList.contains('is-visible')) {
            return;
        }
        openCreatePromptModal();
    });

    modalCloseButton.addEventListener('click', () => {
        closeCreatePromptModal();
    });

    formCancelButton.addEventListener('click', () => {
        closeCreatePromptModal();
    });

    modalBackdrop.addEventListener('click', () => {
        closeCreatePromptModal();
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden && modal.classList.contains('is-visible')) {
            event.preventDefault();
            closeCreatePromptModal();
        }
    });

    newPromptForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isSubmittingPrompt) {
            return;
        }

        const subtopicIdValue = subtopicSelect.value.trim();
        const titleValue = newPromptForm.title.value.trim();
        const contentValue = newPromptForm.content.value.trim();

        hideFormError();

        if (!subtopicIdValue) {
            showFormError('Please choose a subtopic.');
            subtopicSelect.focus({ preventScroll: true });
            return;
        }

        if (!titleValue) {
            showFormError('Title is required.');
            newPromptForm.title.focus({ preventScroll: true });
            return;
        }

        if (!contentValue) {
            showFormError('Content is required.');
            newPromptForm.content.focus({ preventScroll: true });
            return;
        }

        const subtopicId = Number(subtopicIdValue);
        if (Number.isNaN(subtopicId)) {
            showFormError('Select a valid subtopic.');
            return;
        }

        isSubmittingPrompt = true;
        formSubmitButton.disabled = true;
        formSubmitButton.textContent = SAVING_SUBMIT_LABEL;

        const payload = {
            title: titleValue,
            content: contentValue,
            subtopic_id: subtopicId,
        };

        try {
            const response = await fetch('/api/prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseBody = await response.json().catch(() => null);

            if (!response.ok) {
                const errorMessage = responseBody && responseBody.errors
                    ? Object.values(responseBody.errors).join(' ')
                    : 'Unable to save prompt. Please try again.';
                showFormError(errorMessage || 'Unable to save prompt. Please try again.');
                return;
            }

            const newButtonRef = appendPromptToNav(responseBody);
            closeCreatePromptModal(false);
            window.setTimeout(() => {
                if (newButtonRef instanceof HTMLElement) {
                    newButtonRef.focus({ preventScroll: true });
                }
            }, 260);
        } catch (error) {
            console.error(error);
            showFormError('Unable to save prompt. Please try again.');
        } finally {
            isSubmittingPrompt = false;
            formSubmitButton.disabled = false;
            formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
        }
    });

    if (!promptTitle.textContent) {
        promptTitle.textContent = DEFAULT_PROMPT_TITLE;
    }
    if (!promptContent.textContent || !promptContent.textContent.trim()) {
        setPromptContent(DEFAULT_PROMPT_MESSAGE);
    }
    disableCopyButton();
})();
