export const doc = document;
export const body = document.body;

export const appContainer = doc.getElementById('app-container');
export const navPanel = doc.getElementById('nav-panel');
export const breadcrumbDomain = doc.querySelector('[data-role="breadcrumb-domain"]');
export const breadcrumbSubtopic = doc.querySelector('[data-role="breadcrumb-subtopic"]');
export const promptTitle = doc.querySelector('[data-role="prompt-title"]');
export const promptContent = doc.querySelector('[data-role="prompt-content"]');
export const backButton = doc.querySelector('[data-role="back-button"]');
export const copyButton = doc.querySelector('[data-role="copy-button"]');
export const editButton = doc.querySelector('[data-role="edit-button"]');
export const deleteButton = doc.querySelector('[data-role="delete-button"]');
export const newPromptButton = doc.querySelector('[data-role="new-prompt-button"]');
export const modal = doc.querySelector('[data-role="new-prompt-modal"]');
export const modalBackdrop = doc.querySelector('[data-role="modal-backdrop"]');
export const modalCloseButton = doc.querySelector('[data-role="modal-close-button"]');
export const modalTitle = doc.querySelector('[data-role="modal-title"]');
export const newPromptForm = doc.querySelector('[data-role="new-prompt-form"]');
export const domainInput = doc.querySelector('[data-role="domain-input"]');
export const subtopicInput = doc.querySelector('[data-role="subtopic-input"]');
export const domainDatalist = doc.querySelector('[data-role="domain-datalist"]');
export const subtopicDatalist = doc.querySelector('[data-role="subtopic-datalist"]');
export const formError = doc.querySelector('[data-role="form-error"]');
export const formCancelButton = doc.querySelector('[data-role="form-cancel-button"]');
export const formSubmitButton = doc.querySelector('[data-role="form-submit-button"]');
export const searchInput = doc.querySelector('[data-role="search-input"]');
export const hierarchyContainer = doc.querySelector('[data-role="hierarchy-container"]');
export const searchResultsContainer = doc.querySelector('[data-role="search-results"]');
export const promptTypeRadios = newPromptForm ? Array.from(newPromptForm.querySelectorAll('[data-role="prompt-type-radio"]')) : [];
export const promptTypeHint = doc.querySelector('[data-role="prompt-type-hint"]');
export const templateBuilder = doc.querySelector('[data-role="template-builder"]');
export const addCategoryButton = doc.querySelector('[data-role="add-category-button"]');
export const templateCategoryList = doc.querySelector('[data-role="template-category-list"]');
export const templateCategoryTemplate = doc.querySelector('[data-role="template-category-template"]');
export const templateOptionTemplate = doc.querySelector('[data-role="template-option-template"]');
export const templateEmptyState = templateCategoryList ? templateCategoryList.querySelector('[data-role="template-empty-state"]') : null;

export const clearDomainButton = doc.querySelector('[data-role="clear-domain-button"]');
export const clearSubtopicButton = doc.querySelector('[data-role="clear-subtopic-button"]');

/**
 * Checks if all essential DOM elements are present on the page.
 * @returns {boolean} True if all elements exist, false otherwise.
 */
export function validateDomElements() {
    return (
        appContainer &&
        navPanel &&
        breadcrumbDomain &&
        breadcrumbSubtopic &&
        promptTitle &&
        promptContent &&
        backButton &&
        copyButton &&
        editButton &&
        deleteButton &&
        newPromptButton &&
        modal &&
        modalBackdrop &&
        modalCloseButton &&
        modalTitle &&
        newPromptForm &&
        domainInput &&
        subtopicInput &&
        domainDatalist &&
        subtopicDatalist &&
        formError &&
        formCancelButton &&
        formSubmitButton &&
        searchInput &&
        hierarchyContainer &&
        searchResultsContainer &&
        promptTypeRadios.length &&
        promptTypeHint &&
        templateBuilder &&
        addCategoryButton &&
        templateCategoryList &&
        templateCategoryTemplate &&
        templateOptionTemplate &&
        templateEmptyState
    );
}
