(() => {
    const appContainer = document.getElementById('app-container');
    const navPanel = document.getElementById('nav-panel');
    const breadcrumbDomain = document.querySelector('[data-role="breadcrumb-domain"]');
    const breadcrumbSubtopic = document.querySelector('[data-role="breadcrumb-subtopic"]');
    const promptTitle = document.querySelector('[data-role="prompt-title"]');
    const promptContent = document.querySelector('[data-role="prompt-content"]');
    const backButton = document.querySelector('[data-role="back-button"]');
    const copyButton = document.querySelector('[data-role="copy-button"]');

    if (
        !appContainer ||
        !navPanel ||
        !breadcrumbDomain ||
        !breadcrumbSubtopic ||
        !promptTitle ||
        !promptContent ||
        !backButton ||
        !copyButton
    ) {
        return;
    }

    const DEFAULT_PROMPT_TITLE = 'Select a prompt to preview';
    const DEFAULT_PROMPT_MESSAGE = 'When you pick a prompt from the navigation panel it will appear here in focus mode.';
    const DEFAULT_COPY_LABEL = 'Copy to Clipboard';

    let currentPromptText = '';
    let copyResetTimer = null;
    let latestRequestToken = 0;

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
        promptTitle.textContent = 'Loading prompt…';
        setPromptContent('Fetching prompt content…');
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

    // Ensure default state is reflected when script loads.
    if (!promptTitle.textContent) {
        promptTitle.textContent = DEFAULT_PROMPT_TITLE;
    }
    if (!promptContent.textContent || !promptContent.textContent.trim()) {
        setPromptContent(DEFAULT_PROMPT_MESSAGE);
    }
    disableCopyButton();
})();
