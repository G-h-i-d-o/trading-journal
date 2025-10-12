import { 
    auth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    sendPasswordResetEmail
} from './firebase-config.js';

// Login functionality
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const loginText = document.getElementById('loginText');
    const loginSpinner = document.getElementById('loginSpinner');

    // Show loading state
    loginText.textContent = 'Signing in...';
    loginSpinner.classList.remove('hidden');

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Success - user will be redirected automatically via onAuthStateChanged
    } catch (error) {
        console.error('Login error:', error);
        showError(getAuthErrorMessage(error));
        
        // Reset button state
        loginText.textContent = '🚀 Sign In';
        loginSpinner.classList.add('hidden');
    }
});

// Signup functionality
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const signupText = document.getElementById('signupText');
    const signupSpinner = document.getElementById('signupSpinner');

    // Show loading state
    signupText.textContent = 'Creating account...';
    signupSpinner.classList.remove('hidden');

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        // Success - user will be redirected automatically
    } catch (error) {
        console.error('Signup error:', error);
        showError(getAuthErrorMessage(error));
        
        // Reset button state
        signupText.textContent = '🎯 Create Account';
        signupSpinner.classList.add('hidden');
    }
});

// Password Reset Functions
window.openResetModal = () => {
    document.getElementById('resetModal').classList.remove('hidden');
    const loginEmail = document.getElementById('loginEmail').value;
    if (loginEmail) {
        document.getElementById('resetEmail').value = loginEmail;
    }
    document.getElementById('resetEmail').focus();
};

window.closeResetModal = () => {
    document.getElementById('resetModal').classList.add('hidden');
    document.getElementById('resetForm').reset();
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