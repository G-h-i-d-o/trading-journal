export function validateAffirmationInput({ text, category }) {
  const trimmedText = String(text || '').trim();

  if (!trimmedText) {
    return { valid: false, message: 'Please enter an affirmation text.' };
  }

  if (trimmedText.length > 200) {
    return { valid: false, message: 'Affirmation text must be 200 characters or less.' };
  }

  if (!category) {
    return { valid: false, message: 'Please select a category.' };
  }

  return { valid: true, message: '' };
}
