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
    const editButton = doc.querySelector('[data-role="edit-button"]');
    const deleteButton = doc.querySelector('[data-role="delete-button"]');
    const newPromptButton = doc.querySelector('[data-role="new-prompt-button"]');
    const modal = doc.querySelector('[data-role="new-prompt-modal"]');
    const modalBackdrop = doc.querySelector('[data-role="modal-backdrop"]');
    const modalCloseButton = doc.querySelector('[data-role="modal-close-button"]');
    const modalTitle = doc.querySelector('[data-role="modal-title"]');
    const newPromptForm = doc.querySelector('[data-role="new-prompt-form"]');
    const domainInput = doc.querySelector('[data-role="domain-input"]');
    const subtopicInput = doc.querySelector('[data-role="subtopic-input"]');
    const domainDatalist = doc.querySelector('[data-role="domain-datalist"]');
    const subtopicDatalist = doc.querySelector('[data-role="subtopic-datalist"]');
    const formError = doc.querySelector('[data-role="form-error"]');
    const formCancelButton = doc.querySelector('[data-role="form-cancel-button"]');
    const formSubmitButton = doc.querySelector('[data-role="form-submit-button"]');
    const searchInput = doc.querySelector('[data-role="search-input"]');
    const hierarchyContainer = doc.querySelector('[data-role="hierarchy-container"]');
    const searchResultsContainer = doc.querySelector('[data-role="search-results"]');
    const promptTypeRadios = newPromptForm ? Array.from(newPromptForm.querySelectorAll('[data-role="prompt-type-radio"]')) : [];
    const promptTypeHint = doc.querySelector('[data-role="prompt-type-hint"]');
    const templateBuilder = doc.querySelector('[data-role="template-builder"]');
    const addCategoryButton = doc.querySelector('[data-role="add-category-button"]');
    const templateCategoryList = doc.querySelector('[data-role="template-category-list"]');
    const templateCategoryTemplate = doc.querySelector('[data-role="template-category-template"]');
    const templateOptionTemplate = doc.querySelector('[data-role="template-option-template"]');
    const templateEmptyState = templateCategoryList ? templateCategoryList.querySelector('[data-role="template-empty-state"]') : null;


    if (
        !appContainer ||
        !navPanel ||
        !breadcrumbDomain ||
        !breadcrumbSubtopic ||
        !promptTitle ||
        !promptContent ||
        !backButton ||
        !copyButton ||
        !editButton ||
        !deleteButton ||
        !newPromptButton ||
        !modal ||
        !modalBackdrop ||
        !modalCloseButton ||
        !modalTitle ||
        !newPromptForm ||
        !domainInput ||
        !subtopicInput ||
        !domainDatalist ||
        !subtopicDatalist ||
        !formError ||
        !formCancelButton ||
        !formSubmitButton ||
        !searchInput ||
        !hierarchyContainer ||
        !searchResultsContainer ||
        !promptTypeRadios.length ||
        !promptTypeHint ||
        !templateBuilder ||
        !addCategoryButton ||
        !templateCategoryList ||
        !templateCategoryTemplate ||
        !templateOptionTemplate ||
        !templateEmptyState
    ) {
        return;
    }

    const body = document.body;
    const DEFAULT_PROMPT_TITLE = 'Select a prompt to preview';
    const DEFAULT_PROMPT_MESSAGE = 'When you pick a prompt from the navigation panel it will appear here in focus mode.';
    const DEFAULT_COPY_LABEL = 'Copy to Clipboard';
    const DEFAULT_SUBMIT_LABEL = formSubmitButton.textContent.trim() || 'Save Prompt';
    const DEFAULT_MODAL_TITLE = modalTitle.textContent.trim() || 'Create New Prompt';
    const LOADING_SUBMIT_LABEL = 'Loading...';
    const SAVING_SUBMIT_LABEL = 'Saving...';
    const DEFAULT_SEARCH_MESSAGE = 'Type to search your prompts.';
    const NO_RESULTS_MESSAGE = 'No prompts match your search.';
    const SEARCH_ERROR_MESSAGE = 'Unable to search right now. Please try again.';
    const SEARCH_LOADING_MESSAGE = 'Searching...';
    const SEARCH_DEBOUNCE_MS = 300;

    const SIMPLE_PROMPT_HINT = 'Simple prompts store a single piece of content.';
    const TEMPLATE_PROMPT_HINT = 'Template prompts include configurable options that populate placeholders like {category}.';

    const TEMPLATE_PREVIEW_EMPTY_MESSAGE = 'Select options to generate the preview.';


    const MODAL_MODE = {
        CREATE: 'create',
        EDIT: 'edit',
    };

    const PROMPT_TYPE = {
        SIMPLE: 'simple',
        TEMPLATE: 'template',
    };

    let modalMode = MODAL_MODE.CREATE;
    let currentPromptType = PROMPT_TYPE.SIMPLE;
    let currentPromptId = null;
    let currentPromptNavButton = null;
    let currentPromptMeta = null;
    let currentPromptText = '';
    let templateCategoryCounter = 0;
    let activeTemplateDetail = null;
    let copyResetTimer = null;
    let latestRequestToken = 0;
    let latestDatalistRequest = 0;
    let activeModalTrigger = null;
    let isSubmittingPrompt = false;
    let editingPromptId = null;
    let searchDebounceTimer = null;
    let latestSearchRequest = 0;
    let isSearchActive = false;

    const escapeSelector = (value) => {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(value);
        }
        return String(value).replace(/[^a-zA-Z0-9_\-]/g, (match) => `\\${match}`);
    };

    const setPromptContent = (text) => {
        activeTemplateDetail = null;
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

    const disableDetailActions = () => {
        editButton.disabled = true;
        deleteButton.disabled = true;
    };

    const enableDetailActions = () => {
        editButton.disabled = false;
        deleteButton.disabled = false;
    };


    const updateTemplateEmptyState = () => {
        if (!templateEmptyState) {
            return;
        }
        const hasCategories = Boolean(templateCategoryList.querySelector('[data-role="template-category"]'));
        templateEmptyState.hidden = hasCategories;
    };

    const clearTemplateBuilder = () => {
        templateCategoryList
            .querySelectorAll('[data-role="template-category"]').forEach((category) => category.remove());
        templateCategoryCounter = 0;
        updateTemplateEmptyState();
    };

    const setPromptType = (type) => {
        const normalized = type === PROMPT_TYPE.TEMPLATE ? PROMPT_TYPE.TEMPLATE : PROMPT_TYPE.SIMPLE;
        currentPromptType = normalized;
        promptTypeRadios.forEach((radio) => {
            radio.checked = radio.value === normalized;
        });
        const isTemplate = normalized === PROMPT_TYPE.TEMPLATE;
        templateBuilder.hidden = !isTemplate;
        templateBuilder.setAttribute('aria-hidden', isTemplate ? 'false' : 'true');
        if (promptTypeHint) {
            promptTypeHint.textContent = isTemplate ? TEMPLATE_PROMPT_HINT : SIMPLE_PROMPT_HINT;
        }
    };

    const addOptionToCategory = (categoryElement, value = '') => {
        if (!categoryElement) {
            return null;
        }
        const fragment = templateOptionTemplate.content.cloneNode(true);
        const optionElement = fragment.querySelector('[data-role="template-option"]');
        const optionInput = optionElement.querySelector('[data-role="option-input"]');
        const removeButton = optionElement.querySelector('[data-role="remove-option-button"]');
        optionInput.value = value;
        removeButton.addEventListener('click', () => {
            optionElement.remove();
        });
        const optionList = categoryElement.querySelector('[data-role="template-option-list"]');
        optionList.appendChild(optionElement);
        return optionInput;
    };

    const createCategoryElement = (name = '', optionValues = []) => {
        const fragment = templateCategoryTemplate.content.cloneNode(true);
        const categoryElement = fragment.querySelector('[data-role="template-category"]');
        const nameInput = categoryElement.querySelector('[data-role="category-name-input"]');
        const removeButton = categoryElement.querySelector('[data-role="remove-category-button"]');
        const addOptionButton = categoryElement.querySelector('[data-role="add-option-button"]');

        templateCategoryCounter += 1;
        categoryElement.dataset.categoryId = `template-category-${templateCategoryCounter}`;
        nameInput.value = name;

        removeButton.addEventListener('click', () => {
            categoryElement.remove();
            updateTemplateEmptyState();
        });

        addOptionButton.addEventListener('click', () => {
            const newOptionInput = addOptionToCategory(categoryElement);
            if (newOptionInput) {
                newOptionInput.focus({ preventScroll: true });
            }
        });

        const values = Array.isArray(optionValues) && optionValues.length > 0 ? optionValues : [''];
        values.forEach((optionValue) => {
            addOptionToCategory(categoryElement, optionValue);
        });

        templateCategoryList.appendChild(categoryElement);
        updateTemplateEmptyState();
        return categoryElement;
    };

    const hydrateTemplateBuilder = (options) => {
        clearTemplateBuilder();
        if (!options || typeof options !== 'object') {
            return;
        }
        Object.entries(options).forEach(([categoryName, optionValues]) => {
            createCategoryElement(categoryName, Array.isArray(optionValues) ? optionValues : []);
        });
        updateTemplateEmptyState();
    };

    const collectTemplateConfiguration = () => {
        const categories = Array.from(templateCategoryList.querySelectorAll('[data-role="template-category"]'));
        if (categories.length === 0) {
            return { error: 'Add at least one category with options for a template prompt.' };
        }

        const result = {};
        const seenNames = new Set();

        for (const categoryElement of categories) {
            const nameInput = categoryElement.querySelector('[data-role="category-name-input"]');
            const rawName = nameInput ? nameInput.value.trim() : '';
            if (!rawName) {
                return { error: 'Each category requires a name.', focus: nameInput };
            }
            const normalizedName = rawName.toLowerCase();
            if (seenNames.has(normalizedName)) {
                return { error: 'Category names must be unique.', focus: nameInput };
            }
            seenNames.add(normalizedName);

            const optionInputs = Array.from(categoryElement.querySelectorAll('[data-role="option-input"]'));
            if (optionInputs.length === 0) {
                return { error: `Add at least one option for "${rawName}".`, focus: nameInput };
            }

            const optionValues = [];
            for (const optionInput of optionInputs) {
                const value = optionInput.value.trim();
                if (!value) {
                    return { error: 'Option values cannot be empty.', focus: optionInput };
                }
                optionValues.push(value);
            }

            result[rawName] = optionValues;
        }

        return { value: result };
    };

    const renderSimplePromptDetail = (content) => {
        activeTemplateDetail = null;
        setPromptContent(content);
        enableCopyButton(content || '');
    };

    const createTemplateDetailControl = (categoryName, optionValues, onChange) => {
        const wrapper = doc.createElement('div');
        wrapper.className = 'template-detail__category';
        const label = doc.createElement('label');
        label.className = 'template-detail__category-label';
        label.textContent = categoryName;
        const select = doc.createElement('select');
        select.className = 'template-detail__select';
        select.dataset.category = categoryName;
        const placeholderOption = doc.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = `Select ${categoryName}`;
        select.appendChild(placeholderOption);
        (Array.isArray(optionValues) ? optionValues : []).forEach((value) => {
            const optionElement = doc.createElement('option');
            optionElement.value = value;
            optionElement.textContent = value;
            select.appendChild(optionElement);
        });
        select.addEventListener('change', onChange);
        wrapper.appendChild(label);
        wrapper.appendChild(select);
        return { wrapper, select };
    };

    const updateTemplatePreview = () => {
        if (!activeTemplateDetail || !activeTemplateDetail.previewEl) {
            return;
        }
        const { content, categories, previewEl } = activeTemplateDetail;
        if (!categories.length) {
            previewEl.textContent = content || '';
            previewEl.classList.remove('is-empty');
            enableCopyButton(content || '');
            return;
        }
        const selections = {};
        let allSelected = true;
        categories.forEach((category) => {
            const value = category.selectEl.value.trim();
            if (!value) {
                allSelected = false;
            } else {
                selections[category.normalized] = value;
            }
        });
        if (!allSelected) {
            previewEl.textContent = TEMPLATE_PREVIEW_EMPTY_MESSAGE;
            previewEl.classList.add('is-empty');
            disableCopyButton();
            return;
        }
        const previewText = (content || '').replace(/\{([^{}]+)\}/g, (match, key) => {
            const normalized = key.trim().toLowerCase();
            return Object.prototype.hasOwnProperty.call(selections, normalized)
                ? selections[normalized]
                : match;
        });
        previewEl.textContent = previewText;
        previewEl.classList.remove('is-empty');
        enableCopyButton(previewText);
    };

    const renderTemplatePromptDetail = (promptMeta) => {
        const baseContent = promptMeta.content || '';
        const options =
            promptMeta.configurableOptions && typeof promptMeta.configurableOptions === 'object'
                ? promptMeta.configurableOptions
                : null;

        if (!options || Object.keys(options).length === 0) {
            renderSimplePromptDetail(baseContent);
            return;
        }

        disableCopyButton();
        activeTemplateDetail = {
            content: baseContent,
            categories: [],
            previewEl: null,
        };

        promptContent.innerHTML = '';

        const container = doc.createElement('div');
        container.className = 'template-detail';

        const description = doc.createElement('p');
        description.className = 'template-detail__hint';
        description.textContent = 'Select an option for each category to build this template.';
        container.appendChild(description);

        const templateBody = doc.createElement('pre');
        templateBody.className = 'template-detail__base';
        templateBody.textContent = baseContent;
        container.appendChild(templateBody);

        const controlsContainer = doc.createElement('div');
        controlsContainer.className = 'template-detail__controls';
        Object.entries(options).forEach(([categoryName, optionValues]) => {
            const normalized = categoryName.trim().toLowerCase();
            const { wrapper, select } = createTemplateDetailControl(categoryName, optionValues, updateTemplatePreview);
            controlsContainer.appendChild(wrapper);
            activeTemplateDetail.categories.push({
                name: categoryName,
                normalized,
                selectEl: select,
            });
        });
        container.appendChild(controlsContainer);

        const previewSection = doc.createElement('section');
        previewSection.className = 'template-detail__preview-section';

        const previewTitle = doc.createElement('h3');
        previewTitle.className = 'template-detail__preview-title';
        previewTitle.textContent = '实时预览';
        previewSection.appendChild(previewTitle);

        const previewOutput = doc.createElement('pre');
        previewOutput.className = 'template-detail__preview is-empty';
        previewOutput.textContent = TEMPLATE_PREVIEW_EMPTY_MESSAGE;
        previewOutput.setAttribute('aria-live', 'polite');
        previewSection.appendChild(previewOutput);
        container.appendChild(previewSection);

        activeTemplateDetail.previewEl = previewOutput;

        promptContent.appendChild(container);
        updateTemplatePreview();
    };


    const resetFormState = () => {
        newPromptForm.reset();
        hideFormError();
        setPromptType(PROMPT_TYPE.SIMPLE);
        clearTemplateBuilder();
        if (domainInput) {
            domainInput.disabled = false;
            domainInput.value = '';
        }
        if (subtopicInput) {
            subtopicInput.disabled = false;
            subtopicInput.value = '';
        }
        formSubmitButton.disabled = false;
        formSubmitButton.textContent = DEFAULT_SUBMIT_LABEL;
        modalTitle.textContent = DEFAULT_MODAL_TITLE;
        modalMode = MODAL_MODE.CREATE;
        editingPromptId = null;
    };

    const resetPromptDetailPanel = () => {
        currentPromptId = null;
       currentPromptNavButton = null;
       currentPromptMeta = null;
       breadcrumbDomain.textContent = 'Domain';
       breadcrumbSubtopic.textContent = 'Subtopic';
       promptTitle.textContent = DEFAULT_PROMPT_TITLE;
       setPromptContent(DEFAULT_PROMPT_MESSAGE);
       disableCopyButton();
       resetCopyButtonLabel();
       disableDetailActions();
    };

    const renderSearchMessage = (message) => {
        searchResultsContainer.innerHTML = '';
        const paragraph = doc.createElement('p');
        paragraph.className = 'empty-state';
        paragraph.textContent = message;
        searchResultsContainer.appendChild(paragraph);
    };

    const renderSearchResults = (items) => {
        if (!Array.isArray(items) || items.length === 0) {
            renderSearchMessage(NO_RESULTS_MESSAGE);
            return;
        }

        const list = doc.createElement('ul');
        list.className = 'search-results-list';

        items.forEach((promptData) => {
            if (!promptData || typeof promptData !== 'object') {
                return;
            }

            const promptId = promptData.id;
            const title = (promptData.title || '').trim();
            const domainName = (promptData.domain_name || '').trim() || 'Domain';
            const subtopicName = (promptData.subtopic_name || '').trim() || 'Subtopic';
            const domainIdRaw = promptData.domain_id;
            const subtopicIdRaw = promptData.subtopic_id;
            const domainId = typeof domainIdRaw === 'number' ? domainIdRaw : Number(domainIdRaw);
            const subtopicId = typeof subtopicIdRaw === 'number' ? subtopicIdRaw : Number(subtopicIdRaw);

            if (!promptId || !title || Number.isNaN(subtopicId)) {
                return;
            }

            const listItem = doc.createElement('li');
            listItem.className = 'prompt-list-item';

            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'prompt-button';
            button.dataset.id = String(promptId);
            button.dataset.domain = domainName;
            button.dataset.subtopic = subtopicName;
            button.dataset.subtopicId = String(subtopicId);
            if (!Number.isNaN(domainId)) {
                button.dataset.domainId = String(domainId);
            }
            button.textContent = title;

            listItem.appendChild(button);
            list.appendChild(listItem);
        });

        if (!list.children.length) {
            renderSearchMessage(NO_RESULTS_MESSAGE);
            return;
        }

        searchResultsContainer.innerHTML = '';
        searchResultsContainer.appendChild(list);
    };

    const showHierarchyView = () => {
        isSearchActive = false;
        hierarchyContainer.hidden = false;
        searchResultsContainer.hidden = true;
        renderSearchMessage(DEFAULT_SEARCH_MESSAGE);
    };

    const showSearchView = () => {
        isSearchActive = true;
        hierarchyContainer.hidden = true;
        searchResultsContainer.hidden = false;
    };

    const executeSearch = async (query) => {
        latestSearchRequest += 1;
        const requestToken = latestSearchRequest;

        showSearchView();
        renderSearchMessage(SEARCH_LOADING_MESSAGE);

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            if (requestToken !== latestSearchRequest) {
                return;
            }

            if (!response.ok) {
                throw new Error(`Failed to search prompts: ${response.status}`);
            }

            const results = await response.json();
            if (requestToken !== latestSearchRequest) {
                return;
            }

            renderSearchResults(results);
        } catch (error) {
            if (requestToken !== latestSearchRequest) {
                return;
            }

            console.error(error);
            renderSearchMessage(SEARCH_ERROR_MESSAGE);
        }
    };

    const scheduleSearch = (query, { immediate = false } = {}) => {
        const trimmed = (query || '').trim();
        window.clearTimeout(searchDebounceTimer);

        if (!trimmed) {
            latestSearchRequest += 1;
            showHierarchyView();
            return;
        }

        const runSearch = () => {
            executeSearch(trimmed);
        };

        if (immediate) {
            runSearch();
        } else {
            searchDebounceTimer = window.setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
        }
    };

    const refreshSearchResultsIfNeeded = () => {
        if (!isSearchActive) {
            return;
        }

        const query = searchInput.value.trim();
        if (!query) {
            showHierarchyView();
            return;
        }

        scheduleSearch(query, { immediate: true });
    };

    const getFirstPromptButton = () => {
        if (isSearchActive && !searchResultsContainer.hidden) {
            return searchResultsContainer.querySelector('.prompt-button');
        }
        if (hierarchyContainer && !hierarchyContainer.hidden) {
            return hierarchyContainer.querySelector('.prompt-button');
        }
        return navPanel.querySelector('.prompt-button');
    };

    const appendPromptToNav = (promptData) => {
        if (!promptData || typeof promptData !== 'object') {
            return null;
        }

        const promptId = promptData.id;
        const title = (promptData.title || '').trim();
        const domainName = (promptData.domain_name || '').trim() || 'Domain';
        const subtopicName = (promptData.subtopic_name || '').trim() || 'Subtopic';
        const domainIdRaw = promptData.domain_id;
        const subtopicIdRaw = promptData.subtopic_id;
        const domainId = typeof domainIdRaw === 'number' ? domainIdRaw : Number(domainIdRaw);
        const subtopicId = typeof subtopicIdRaw === 'number' ? subtopicIdRaw : Number(subtopicIdRaw);

        if (!promptId || !title || Number.isNaN(subtopicId)) {
            return null;
        }

        const selectorValue = escapeSelector(String(subtopicId));
        const context = hierarchyContainer || navPanel;
        const subtopicSection = context.querySelector(`.subtopic[data-subtopic-id="${selectorValue}"]`);
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
        newButton.dataset.subtopicId = String(subtopicId);
        if (!Number.isNaN(domainId)) {
            newButton.dataset.domainId = String(domainId);
        }
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

    const removePromptFromNav = (promptId) => {
        if (!promptId) {
            return { nextButton: null };
        }

        const selector = `.prompt-button[data-id="${escapeSelector(String(promptId))}"]`;
        const context = hierarchyContainer || navPanel;
        const button = context.querySelector(selector);
        if (!button) {
            return { nextButton: null };
        }

        const listItem = button.closest('li');
        const promptList = listItem ? listItem.parentElement : null;
        let nextButton = null;

        if (promptList) {
            const buttons = Array.from(promptList.querySelectorAll('.prompt-button'));
            const currentIndex = buttons.indexOf(button);

            listItem.remove();

            const remainingButtons = Array.from(promptList.querySelectorAll('.prompt-button'));
            if (remainingButtons.length > 0) {
                if (currentIndex < remainingButtons.length) {
                    nextButton = remainingButtons[currentIndex];
                } else {
                    nextButton = remainingButtons[remainingButtons.length - 1];
                }
            } else {
                const emptyState = doc.createElement('li');
                emptyState.className = 'empty-state';
                emptyState.dataset.role = 'empty-prompts';
                emptyState.textContent = 'No prompts yet.';
                promptList.appendChild(emptyState);
            }
        } else if (listItem) {
            listItem.remove();
        }

        return { nextButton };
    };

    const populateDatalists = async () => {
        latestDatalistRequest += 1;
        const requestToken = latestDatalistRequest;

        try {
            const response = await fetch('/api/structure');
            if (!response.ok) {
                throw new Error(`Failed to fetch structure: ${response.status}`);
            }

            const structure = await response.json();
            if (requestToken !== latestDatalistRequest) {
                return { aborted: true };
            }

            const domainNames = new Map();
            const subtopicNames = new Map();

            const addName = (collection, value) => {
                const trimmed = (value || '').trim();
                if (!trimmed) {
                    return;
                }
                const key = trimmed.toLowerCase();
                if (!collection.has(key)) {
                    collection.set(key, trimmed);
                }
            };

            if (Array.isArray(structure)) {
                structure.forEach((domainItem) => {
                    if (!domainItem || typeof domainItem !== 'object') {
                        return;
                    }

                    addName(domainNames, domainItem.name);

                    if (Array.isArray(domainItem.subtopics)) {
                        domainItem.subtopics.forEach((subtopicItem) => {
                            if (!subtopicItem || typeof subtopicItem !== 'object') {
                                return;
                            }
                            addName(subtopicNames, subtopicItem.name);
                        });
                    }
                });
            }

            const sortNames = (values) =>
                Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

            if (domainDatalist) {
                domainDatalist.innerHTML = '';
                sortNames(domainNames.values()).forEach((name) => {
                    const option = doc.createElement('option');
                    option.value = name;
                    domainDatalist.appendChild(option);
                });
            }

            if (subtopicDatalist) {
                subtopicDatalist.innerHTML = '';
                sortNames(subtopicNames.values()).forEach((name) => {
                    const option = doc.createElement('option');
                    option.value = name;
                    subtopicDatalist.appendChild(option);
                });
            }

            return {
                domainCount: domainNames.size,
                subtopicCount: subtopicNames.size,
            };
        } catch (error) {
            console.error(error);
            if (requestToken !== latestDatalistRequest) {
                return { aborted: true };
            }
            return { error: true };
        }
    };

    const renderHierarchy = (structure) => {
        if (!hierarchyContainer) {
            return;
        }
        hierarchyContainer.innerHTML = '';

        if (!Array.isArray(structure) || structure.length === 0) {
            const emptyState = doc.createElement('p');
            emptyState.className = 'empty-state';
            emptyState.textContent = 'Seed the database to view your prompt hierarchy.';
            hierarchyContainer.appendChild(emptyState);
            return;
        }

        structure.forEach((domain) => {
            const domainArticle = doc.createElement('article');
            domainArticle.className = 'domain';
            domainArticle.dataset.domainId = domain.id;
            domainArticle.dataset.domainName = domain.name;

            const domainH2 = doc.createElement('h2');
            domainH2.className = 'domain-name';
            domainH2.textContent = domain.name;
            domainArticle.appendChild(domainH2);

            const subtopicsDiv = doc.createElement('div');
            subtopicsDiv.className = 'subtopics';

            const sortedSubtopics =
                domain.subtopics && domain.subtopics.length > 0
                    ? [...domain.subtopics].sort((a, b) =>
                          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                      )
                    : [];

            if (sortedSubtopics.length > 0) {
                sortedSubtopics.forEach((subtopic) => {
                    const subtopicSection = doc.createElement('section');
                    subtopicSection.className = 'subtopic';
                    subtopicSection.dataset.subtopicId = subtopic.id;
                    subtopicSection.dataset.subtopicName = subtopic.name;

                    const subtopicH3 = doc.createElement('h3');
                    subtopicH3.className = 'subtopic-name';
                    subtopicH3.textContent = subtopic.name;
                    subtopicSection.appendChild(subtopicH3);

                    const promptListUl = doc.createElement('ul');
                    promptListUl.className = 'prompt-list';
                    promptListUl.setAttribute('aria-label', `Prompts for ${subtopic.name}`);

                    const sortedPrompts =
                        subtopic.prompts && subtopic.prompts.length > 0
                            ? [...subtopic.prompts].sort((a, b) =>
                                  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
                              )
                            : [];

                    if (sortedPrompts.length > 0) {
                        sortedPrompts.forEach((prompt) => {
                            const promptLi = doc.createElement('li');
                            promptLi.className = 'prompt-list-item';

                            const promptButton = doc.createElement('button');
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
                        const emptyLi = doc.createElement('li');
                        emptyLi.className = 'empty-state';
                        emptyLi.dataset.role = 'empty-prompts';
                        emptyLi.textContent = 'No prompts yet.';
                        promptListUl.appendChild(emptyLi);
                    }
                    subtopicSection.appendChild(promptListUl);
                    subtopicsDiv.appendChild(subtopicSection);
                });
            } else {
                const emptyP = doc.createElement('p');
                emptyP.className = 'empty-state';
                emptyP.textContent = 'No subtopics yet.';
                subtopicsDiv.appendChild(emptyP);
            }
            domainArticle.appendChild(subtopicsDiv);
            hierarchyContainer.appendChild(domainArticle);
        });
    };

    const refreshNavigationTree = async (focusPromptId = null) => {
        try {
            const response = await fetch('/api/structure');
            if (!response.ok) {
                throw new Error(`Failed to fetch structure: ${response.status}`);
            }
            const structure = await response.json();
            renderHierarchy(structure);

            if (focusPromptId) {
                const selector = `.prompt-button[data-id="${escapeSelector(String(focusPromptId))}"]`;
                const buttonToFocus = hierarchyContainer.querySelector(selector);
                if (buttonToFocus) {
                    return buttonToFocus;
                }
            }
            return null;
        } catch (error) {
            console.error('Failed to refresh navigation tree:', error);
            return null;
        }
    };

    const openPromptModal = async ({ mode = MODAL_MODE.CREATE, promptData = null } = {}) => {
        const isEdit = mode === MODAL_MODE.EDIT && promptData && typeof promptData.id === 'number';
        modalMode = isEdit ? MODAL_MODE.EDIT : MODAL_MODE.CREATE;
        editingPromptId = isEdit ? promptData.id : null;
        activeModalTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        hideFormError();

        newPromptForm.reset();
        clearTemplateBuilder();
        setPromptType(PROMPT_TYPE.SIMPLE);

        let initialDomain = '';
        let initialSubtopic = '';

        if (isEdit && promptData) {
            newPromptForm.title.value = promptData.title || '';
            newPromptForm.content.value = promptData.content || '';
            initialDomain = (promptData.domainName || '').trim();
            initialSubtopic = (promptData.subtopicName || '').trim();

            const isTemplatePrompt = Boolean(promptData.isTemplate);
            setPromptType(isTemplatePrompt ? PROMPT_TYPE.TEMPLATE : PROMPT_TYPE.SIMPLE);
            if (isTemplatePrompt) {
                hydrateTemplateBuilder(promptData.configurableOptions);
            }
        }

        if (domainInput) {
            domainInput.value = initialDomain;
            domainInput.disabled = true;
        }
        if (subtopicInput) {
            subtopicInput.value = initialSubtopic;
            subtopicInput.disabled = true;
        }
        formSubmitButton.disabled = true;
        formSubmitButton.textContent = LOADING_SUBMIT_LABEL;
        const submitLabel = isEdit ? 'Update Prompt' : DEFAULT_SUBMIT_LABEL;
        modalTitle.textContent = isEdit ? 'Edit Prompt' : DEFAULT_MODAL_TITLE;

        body.classList.add('modal-open');
        modalBackdrop.hidden = false;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');

        window.requestAnimationFrame(() => {
            modalBackdrop.classList.add('is-visible');
            modal.classList.add('is-visible');
        });

        const result = await populateDatalists();

        if (result && result.aborted) {
            formSubmitButton.textContent = submitLabel;
            return;
        }

        if (domainInput) {
            domainInput.disabled = false;
            domainInput.value = initialDomain;
        }
        if (subtopicInput) {
            subtopicInput.disabled = false;
            subtopicInput.value = initialSubtopic;
        }
        formSubmitButton.disabled = false;
        formSubmitButton.textContent = submitLabel;

        if (result && result.error) {
            showFormError('Autocomplete suggestions are unavailable. Enter values manually.');
        }

        window.setTimeout(() => {
            if (isEdit) {
                newPromptForm.title.focus({ preventScroll: true });
            } else if (domainInput) {
                domainInput.focus({ preventScroll: true });
            } else {
                newPromptForm.title.focus({ preventScroll: true });
            }
        }, 120);
    };

    const closePromptModal = (restoreFocus = true) => {
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

    promptTypeRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
            if (!radio.checked) {
                return;
            }
            setPromptType(radio.value);
            if (currentPromptType === PROMPT_TYPE.TEMPLATE && !templateCategoryList.querySelector('[data-role="template-category"]')) {
                createCategoryElement();
            }
        });
    });

    addCategoryButton.addEventListener('click', () => {
        const categoryElement = createCategoryElement();
        const nameInput = categoryElement.querySelector('[data-role="category-name-input"]');
        if (nameInput) {
            nameInput.focus({ preventScroll: true });
        }
    });


    searchInput.addEventListener('input', () => {
        scheduleSearch(searchInput.value);
    });

    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            scheduleSearch(searchInput.value, { immediate: true });
        }
    });

    navPanel.addEventListener('click', async (event) => {
        const trigger = event.target instanceof Element ? event.target.closest('.prompt-button') : null;
        if (!trigger) {
            return;
        }

        event.preventDefault();

        const promptIdValue = trigger.dataset.id;
        const promptId = Number(promptIdValue);
        if (!promptIdValue || Number.isNaN(promptId)) {
            return;
        }

        const domainName = trigger.dataset.domain || 'Domain';
        const subtopicName = trigger.dataset.subtopic || 'Subtopic';
        const domainId = Number(trigger.dataset.domainId);
        const subtopicId = Number(trigger.dataset.subtopicId);

        currentPromptId = promptId;
        currentPromptNavButton = trigger;
        currentPromptMeta = {
            id: promptId,
            domainId: Number.isNaN(domainId) ? null : domainId,
            domainName,
            subtopicId: Number.isNaN(subtopicId) ? null : subtopicId,
            subtopicName,
            title: '',
            content: '',
            isTemplate: false,
            configurableOptions: null,
        };

        breadcrumbDomain.textContent = domainName;
        breadcrumbSubtopic.textContent = subtopicName;
        promptTitle.textContent = 'Loading prompt...';
        setPromptContent('Fetching prompt content...');
        disableCopyButton();
        disableDetailActions();

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

            currentPromptMeta.title = payload.title || DEFAULT_PROMPT_TITLE;
            currentPromptMeta.content = payload.content || '';
            currentPromptMeta.isTemplate = Boolean(payload.is_template);
            currentPromptMeta.configurableOptions =
                payload.configurable_options && typeof payload.configurable_options === 'object'
                    ? payload.configurable_options
                    : null;

            promptTitle.textContent = currentPromptMeta.title;
            if (currentPromptMeta.isTemplate) {
                renderTemplatePromptDetail(currentPromptMeta);
            } else {
                renderSimplePromptDetail(currentPromptMeta.content || '');
            }
            enableDetailActions();

            window.scrollTo(0, 0);
        } catch (error) {
            if (requestToken !== latestRequestToken) {
                return;
            }

            console.error(error);
            promptTitle.textContent = 'Unable to load prompt';
            setPromptContent('Please try again in a moment.');
            disableCopyButton();
            disableDetailActions();
        }
    });

    backButton.addEventListener('click', () => {
        appContainer.classList.remove('detail-view-active');
        resetCopyButtonLabel();
        disableDetailActions();
        const firstPromptButton = getFirstPromptButton();
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

    editButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (!currentPromptMeta || typeof currentPromptMeta.id !== 'number') {
            return;
        }

        openPromptModal({
            mode: MODAL_MODE.EDIT,
            promptData: {
                id: currentPromptMeta.id,
                title: currentPromptMeta.title,
                content: currentPromptMeta.content,
                subtopicId: currentPromptMeta.subtopicId,
                domainId: currentPromptMeta.domainId,
                domainName: currentPromptMeta.domainName,
                subtopicName: currentPromptMeta.subtopicName,
                isTemplate: Boolean(currentPromptMeta.isTemplate),
                configurableOptions: currentPromptMeta.configurableOptions,
            },
        });
    });

    deleteButton.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!currentPromptMeta || typeof currentPromptMeta.id !== 'number') {
            return;
        }

        if (!window.confirm('Are you sure you want to delete this prompt?')) {
            return;
        }

        const promptId = currentPromptMeta.id;

        try {
            const response = await fetch(`/api/prompts/${promptId}`, {
                method: 'DELETE',
            });

            if (response.status === 204) {
                resetPromptDetailPanel();
                appContainer.classList.remove('detail-view-active');

                const buttonToFocus = (await refreshNavigationTree()) || getFirstPromptButton() || newPromptButton;
                refreshSearchResultsIfNeeded();

                window.setTimeout(() => {
                    if (buttonToFocus instanceof HTMLElement) {
                        buttonToFocus.focus({ preventScroll: true });
                    }
                }, 120);
            } else if (response.status === 404) {
                await refreshNavigationTree();
                resetPromptDetailPanel();
                refreshSearchResultsIfNeeded();
                window.alert('Prompt not found. It may have already been deleted.');
            } else {
                throw new Error(`Failed to delete prompt: ${response.status}`);
            }
        } catch (error) {
            console.error(error);
            window.alert('Unable to delete prompt. Please try again.');
        }
    });

    newPromptButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (!modal.hidden && modal.classList.contains('is-visible')) {
            return;
        }
        openPromptModal({ mode: MODAL_MODE.CREATE });
    });

    modalCloseButton.addEventListener('click', () => {
        closePromptModal();
    });

    formCancelButton.addEventListener('click', () => {
        closePromptModal();
    });

    modalBackdrop.addEventListener('click', () => {
        closePromptModal();
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.hidden && modal.classList.contains('is-visible')) {
            event.preventDefault();
            closePromptModal();
        }
    });

    newPromptForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (isSubmittingPrompt) {
            return;
        }

        const domainValue = domainInput.value.trim();
        const subtopicValue = subtopicInput.value.trim();
        const titleValue = newPromptForm.title.value.trim();
        const contentValue = newPromptForm.content.value.trim();

        hideFormError();

        if (!domainValue) {
            showFormError('Domain is required.');
            domainInput.focus({ preventScroll: true });
            return;
        }

        if (!subtopicValue) {
            showFormError('Subtopic is required.');
            subtopicInput.focus({ preventScroll: true });
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

        const payload = {
            title: titleValue,
            content: contentValue,
            domain_name: domainValue,
            subtopic_name: subtopicValue,
        };

        const isTemplateSelected = currentPromptType === PROMPT_TYPE.TEMPLATE;
        if (isTemplateSelected) {
            const configResult = collectTemplateConfiguration();
            if (configResult.error) {
                showFormError(configResult.error);
                if (configResult.focus instanceof HTMLElement) {
                    configResult.focus.focus({ preventScroll: true });
                }
                return;
            }
            payload.is_template = true;
            payload.configurable_options = configResult.value;
        } else {
            payload.is_template = false;
            payload.configurable_options = null;
        }

        const isEdit = modalMode === MODAL_MODE.EDIT && typeof editingPromptId === 'number';
        const endpoint = isEdit ? `/api/prompts/${editingPromptId}` : '/api/prompts';
        const method = isEdit ? 'PUT' : 'POST';

        isSubmittingPrompt = true;
        formSubmitButton.disabled = true;
        formSubmitButton.textContent = SAVING_SUBMIT_LABEL;

        try {
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const responseBody = await response.json().catch(() => null);

            if (!response.ok) {
                if (isEdit && response.status === 404) {
                    showFormError('Prompt not found. It may have been deleted.');
                    await refreshNavigationTree();
                    refreshSearchResultsIfNeeded();
                    return;
                }
                const errorMessage =
                    responseBody && responseBody.errors
                        ? Object.values(responseBody.errors).join(' ')
                        : 'Unable to save prompt. Please try again.';
                showFormError(errorMessage || 'Unable to save prompt. Please try again.');
                return;
            }

            closePromptModal(false);
            const buttonToFocus = await refreshNavigationTree(responseBody.id);

            if (isEdit && currentPromptId === responseBody.id) {
                currentPromptMeta = {
                    id: responseBody.id,
                    title: responseBody.title || '',
                    content: responseBody.content || '',
                    subtopicId:
                        typeof responseBody.subtopic_id === 'number'
                            ? responseBody.subtopic_id
                            : Number(responseBody.subtopic_id),
                    subtopicName: responseBody.subtopic_name || 'Subtopic',
                    domainId:
                        typeof responseBody.domain_id === 'number'
                            ? responseBody.domain_id
                            : Number(responseBody.domain_id),
                    domainName: responseBody.domain_name || 'Domain',
                    isTemplate: Boolean(responseBody.is_template),
                    configurableOptions:
                        responseBody.configurable_options && typeof responseBody.configurable_options === 'object'
                            ? responseBody.configurable_options
                            : null,
                };
                currentPromptNavButton = buttonToFocus || null;

                breadcrumbDomain.textContent = currentPromptMeta.domainName;
                breadcrumbSubtopic.textContent = currentPromptMeta.subtopicName;
                promptTitle.textContent = currentPromptMeta.title || DEFAULT_PROMPT_TITLE;
                if (currentPromptMeta.isTemplate) {
                    renderTemplatePromptDetail(currentPromptMeta);
                } else {
                    renderSimplePromptDetail(currentPromptMeta.content || '');
                }
                enableDetailActions();
            }

            refreshSearchResultsIfNeeded();

            window.setTimeout(() => {
                if (buttonToFocus instanceof HTMLElement) {
                    buttonToFocus.focus({ preventScroll: true });
                }
            }, 260);
        } catch (error) {
            console.error(error);
            showFormError('Unable to save prompt. Please try again.');
        } finally {
            isSubmittingPrompt = false;
            if (!modal.hidden) {
                formSubmitButton.disabled = false;
                formSubmitButton.textContent = modalMode === MODAL_MODE.EDIT ? 'Update Prompt' : DEFAULT_SUBMIT_LABEL;
            }
        }
    });

    setPromptType(PROMPT_TYPE.SIMPLE);
    clearTemplateBuilder();
    renderSearchMessage(DEFAULT_SEARCH_MESSAGE);

    if (!promptTitle.textContent) {
        promptTitle.textContent = DEFAULT_PROMPT_TITLE;
    }
    if (!promptContent.textContent || !promptContent.textContent.trim()) {
        setPromptContent(DEFAULT_PROMPT_MESSAGE);
    }
    disableCopyButton();
    disableDetailActions();
})();
