import { showToast } from './ui-feedback.js';

export function showSuccessMessage(message) {
    showToast({ message, type: 'success' });
}

export function showErrorMessage(message) {
    showToast({ message, type: 'error' });
}
