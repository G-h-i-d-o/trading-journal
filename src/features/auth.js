import { 
    auth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from './firebase-config.js';

function initializeLegacyAuthFormHandlers() {
    if (window.__tradewizerAuthInitialized) return;
    window.__tradewizerAuthInitialized = true;

    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail')?.value || '';
            const password = document.getElementById('loginPassword')?.value || '';
            const loginText = document.getElementById('loginText');
            const loginSpinner = document.getElementById('loginSpinner');

            if (loginText) loginText.textContent = 'Signing in...';
            if (loginSpinner) loginSpinner.classList.remove('hidden');

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error('Login error:', error);
                if (typeof showError === 'function') {
                    showError(getAuthErrorMessage(error));
                }
                if (loginText) loginText.textContent = 'Sign In';
                if (loginSpinner) loginSpinner.classList.add('hidden');
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('signupEmail')?.value || '';
            const password = document.getElementById('signupPassword')?.value || '';
            const signupText = document.getElementById('signupText');
            const signupSpinner = document.getElementById('signupSpinner');

            if (signupText) signupText.textContent = 'Creating account...';
            if (signupSpinner) signupSpinner.classList.remove('hidden');

            try {
                await createUserWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error('Signup error:', error);
                if (typeof showError === 'function') {
                    showError(getAuthErrorMessage(error));
                }
                if (signupText) signupText.textContent = 'Create Account';
                if (signupSpinner) signupSpinner.classList.add('hidden');
            }
        });
    }
}

initializeLegacyAuthFormHandlers();

// Password Reset Functions
window.openResetModal = () => {
    const resetModal = document.getElementById('resetModal');
    const resetEmail = document.getElementById('resetEmail');
    const loginEmailInput = document.getElementById('loginEmail');

    if (resetModal) resetModal.classList.remove('hidden');
    if (resetEmail && loginEmailInput && loginEmailInput.value) {
        resetEmail.value = loginEmailInput.value;
    }
    if (resetEmail) resetEmail.focus();
};

window.closeResetModal = () => {
    const resetModal = document.getElementById('resetModal');
    const resetForm = document.getElementById('resetForm');
    if (resetModal) resetModal.classList.add('hidden');
    if (resetForm) resetForm.reset();
};

// Handle password reset
document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const resetButton = document.getElementById('resetText');
    const resetSpinner = document.getElementById('resetSpinner');
    const email = document.getElementById('resetEmail').value;

    // Validate email
    if (!isValidEmail(email)) {
        showError('Please enter a valid email address.');
        return;
    }

    // Show loading state
    resetButton.textContent = 'Sending...';
    resetSpinner.classList.remove('hidden');

    try {
        await sendPasswordResetEmail(auth, email);
        showSuccess('Password reset email sent! Check your inbox and spam folder.');
        closeResetModal();
    } catch (error) {
        console.error('Password reset error:', error);
        showError(getAuthErrorMessage(error));
    } finally {
        resetButton.textContent = 'Send Link';
        resetSpinner.classList.add('hidden');
    }
});

// Utility functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    successText.textContent = message;
    successEl.classList.remove('hidden');
    setTimeout(() => successEl.classList.add('hidden'), 5000);
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    errorText.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
}

function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        default:
            return 'An error occurred. Please try again.';
    }
}

// UI switching
window.switchToSignup = () => {
    document.getElementById('loginForm').closest('.card-glass').classList.add('hidden');
    document.getElementById('signupCard').classList.remove('hidden');
    document.getElementById('signupEmail').focus();
};

window.switchToLogin = () => {
    document.getElementById('signupCard').classList.add('hidden');
    document.getElementById('loginForm').closest('.card-glass').classList.remove('hidden');
    document.getElementById('loginEmail').focus();
};

// Modal handlers
document.getElementById('resetModal').addEventListener('click', (e) => {
    if (e.target.id === 'resetModal') {
        closeResetModal();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('resetModal').classList.contains('hidden')) {
        closeResetModal();
    }
});

console.log('Auth system loaded successfully!');