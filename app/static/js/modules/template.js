import * as dom from './dom.js';
import { DEFAULTS, PROMPT_TYPE, updateState, getStateValue } from './state.js';
import { enableCopyButton, disableCopyButton, setPromptContent, renderPromptGallery } from './ui.js';

function addOptionToCategory(categoryElement, value = '') {
    if (!categoryElement) return null;

    const fragment = dom.templateOptionTemplate.content.cloneNode(true);
    const optionElement = fragment.querySelector('[data-role="template-option"]');
    const optionInput = optionElement.querySelector('[data-role="option-input"]');
    const removeButton = optionElement.querySelector('[data-role="remove-option-button"]');

    optionInput.value = value;
    removeButton.addEventListener('click', () => optionElement.remove());

    const optionList = categoryElement.querySelector('[data-role="template-option-list"]');
    optionList.appendChild(optionElement);
    return optionInput;
}

function updateTemplateEmptyState() {
    if (!dom.templateEmptyState) return;
    const hasCategories = Boolean(dom.templateCategoryList.querySelector('[data-role="template-category"]'));
    dom.templateEmptyState.hidden = hasCategories;
}

export function createCategoryElement(name = '', optionValues = []) {
    const fragment = dom.templateCategoryTemplate.content.cloneNode(true);
    const categoryElement = fragment.querySelector('[data-role="template-category"]');
    const nameInput = categoryElement.querySelector('[data-role="category-name-input"]');
    const removeButton = categoryElement.querySelector('[data-role="remove-category-button"]');
    const addOptionButton = categoryElement.querySelector('[data-role="add-option-button"]');

    let counter = getStateValue('templateCategoryCounter') + 1;
    updateState('templateCategoryCounter', counter);
    categoryElement.dataset.categoryId = `template-category-${counter}`;
    nameInput.value = name;

    removeButton.addEventListener('click', () => {
        categoryElement.remove();
        updateTemplateEmptyState();
    });

    addOptionButton.addEventListener('click', () => {
        const newOptionInput = addOptionToCategory(categoryElement);
        if (newOptionInput) newOptionInput.focus({ preventScroll: true });
    });

    const values = Array.isArray(optionValues) && optionValues.length > 0 ? optionValues : [''];
    values.forEach((optionValue) => addOptionToCategory(categoryElement, optionValue));

    dom.templateCategoryList.appendChild(categoryElement);
    updateTemplateEmptyState();
    return categoryElement;
}

export function clearTemplateBuilder() {
    dom.templateCategoryList.querySelectorAll('[data-role="template-category"]').forEach((c) => c.remove());
    updateState('templateCategoryCounter', 0);
    updateTemplateEmptyState();
}

export function hydrateTemplateBuilder(options) {
    clearTemplateBuilder();
    if (!options || typeof options !== 'object') return;
    Object.entries(options).forEach(([categoryName, optionValues]) => {
        createCategoryElement(categoryName, Array.isArray(optionValues) ? optionValues : []);
    });
    updateTemplateEmptyState();
}

export function collectTemplateConfiguration() {
    const categories = Array.from(dom.templateCategoryList.querySelectorAll('[data-role="template-category"]'));
    if (categories.length === 0) {
        return { error: 'Add at least one category with options for a template prompt.' };
    }

    const result = {};
    const seenNames = new Set();

    for (const categoryElement of categories) {
        const nameInput = categoryElement.querySelector('[data-role="category-name-input"]');
        const rawName = nameInput ? nameInput.value.trim() : '';
        if (!rawName) return { error: 'Each category requires a name.', focus: nameInput };

        const normalizedName = rawName.toLowerCase();
        if (seenNames.has(normalizedName)) return { error: 'Category names must be unique.', focus: nameInput };
        seenNames.add(normalizedName);

        const optionInputs = Array.from(categoryElement.querySelectorAll('[data-role="option-input"]'));
        if (optionInputs.length === 0) return { error: `Add at least one option for "${rawName}".`, focus: nameInput };

        const optionValues = [];
        for (const optionInput of optionInputs) {
            const value = optionInput.value.trim();
            if (!value) return { error: 'Option values cannot be empty.', focus: optionInput };
            optionValues.push(value);
        }
        result[rawName] = optionValues;
    }
    return { value: result };
}

function createTemplateDetailControl(categoryName, optionValues, onChange) {
    const wrapper = dom.doc.createElement('div');
    wrapper.className = 'template-detail__category';
    const label = dom.doc.createElement('label');
    label.className = 'template-detail__category-label';
    label.textContent = categoryName;
    const select = dom.doc.createElement('select');
    select.className = 'template-detail__select';
    select.dataset.category = categoryName;
    const placeholderOption = dom.doc.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = `Select ${categoryName}`;
    select.appendChild(placeholderOption);
    (Array.isArray(optionValues) ? optionValues : []).forEach((value) => {
        const optionElement = dom.doc.createElement('option');
        optionElement.value = value;
        optionElement.textContent = value;
        select.appendChild(optionElement);
    });
    select.addEventListener('change', onChange);
    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return { wrapper, select };
}

function updateTemplatePreview() {
    const activeDetail = getStateValue('activeTemplateDetail');
    if (!activeDetail || !activeDetail.previewEl) return;

    const { content, categories, previewEl } = activeDetail;
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
        previewEl.textContent = DEFAULTS.TEMPLATE_PREVIEW_EMPTY_MESSAGE;
        previewEl.classList.add('is-empty');
        disableCopyButton();
        return;
    }

    const previewText = (content || '').replace(/\{([^{}]+)\}/g, (match, key) => {
        const normalized = key.trim().toLowerCase();
        return Object.prototype.hasOwnProperty.call(selections, normalized) ? selections[normalized] : match;
    });

    previewEl.textContent = previewText;
    previewEl.classList.remove('is-empty');
    enableCopyButton(previewText);
}

export function renderTemplatePromptDetail(promptMeta) {
    const baseContent = promptMeta.content || '';
    const options = promptMeta.configurableOptions && typeof promptMeta.configurableOptions === 'object' ? promptMeta.configurableOptions : null;
    const images = Array.isArray(promptMeta.images) ? promptMeta.images : [];

    if (!options || Object.keys(options).length === 0) {
        setPromptContent(baseContent, images);
        enableCopyButton(baseContent || '');
        return;
    }

    disableCopyButton();
    const activeTemplateDetail = {
        content: baseContent,
        categories: [],
        previewEl: null,
    };
    updateState('activeTemplateDetail', activeTemplateDetail);

    dom.promptContent.innerHTML = '';
    const container = dom.doc.createElement('div');
    container.className = 'template-detail';

    const description = dom.doc.createElement('p');
    description.className = 'template-detail__hint';
    description.textContent = 'Select an option for each category to build this template.';
    container.appendChild(description);

    const templateBody = dom.doc.createElement('pre');
    templateBody.className = 'template-detail__base';
    templateBody.textContent = baseContent;
    container.appendChild(templateBody);

    const controlsContainer = dom.doc.createElement('div');
    controlsContainer.className = 'template-detail__controls';
    Object.entries(options).forEach(([categoryName, optionValues]) => {
        const normalized = categoryName.trim().toLowerCase();
        const { wrapper, select } = createTemplateDetailControl(categoryName, optionValues, updateTemplatePreview);
        controlsContainer.appendChild(wrapper);
        activeTemplateDetail.categories.push({ name: categoryName, normalized, selectEl: select });
    });
    container.appendChild(controlsContainer);

    const previewSection = dom.doc.createElement('section');
    previewSection.className = 'template-detail__preview-section';
    const previewTitle = dom.doc.createElement('h3');
    previewTitle.className = 'template-detail__preview-title';
    previewTitle.textContent = '实时预览';
    previewSection.appendChild(previewTitle);
    const previewOutput = dom.doc.createElement('pre');
    previewOutput.className = 'template-detail__preview is-empty';
    previewOutput.textContent = DEFAULTS.TEMPLATE_PREVIEW_EMPTY_MESSAGE;
    previewOutput.setAttribute('aria-live', 'polite');
    previewSection.appendChild(previewOutput);
    container.appendChild(previewSection);

    activeTemplateDetail.previewEl = previewOutput;
    dom.promptContent.appendChild(container);
    updateTemplatePreview();

    const gallery = renderPromptGallery(images);
    if (gallery) {
        dom.promptContent.appendChild(gallery);
    }
}

export function setPromptType(type) {
    const normalized = type === PROMPT_TYPE.TEMPLATE ? PROMPT_TYPE.TEMPLATE : PROMPT_TYPE.SIMPLE;
    updateState('currentPromptType', normalized);
    dom.promptTypeRadios.forEach((radio) => {
        radio.checked = radio.value === normalized;
    });
    const isTemplate = normalized === PROMPT_TYPE.TEMPLATE;
    dom.templateBuilder.hidden = !isTemplate;
    dom.templateBuilder.setAttribute('aria-hidden', isTemplate ? 'false' : 'true');
    if (dom.promptTypeHint) {
        dom.promptTypeHint.textContent = isTemplate ? DEFAULTS.TEMPLATE_PROMPT_HINT : DEFAULTS.SIMPLE_PROMPT_HINT;
    }
}
