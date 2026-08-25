export let userDisplayName = 'Guest';

export function updateWelcomeGreeting(currentUser, profile) {
    let name = 'Guest';
    if (profile) {
        name = profile.displayName || profile.fullName || currentUser?.email?.split('@')[0] || 'Guest';
    } else if (currentUser) {
        name = currentUser.email?.split('@')[0] || 'Guest';
    }

    userDisplayName = name;

    const displayNameEl = document.getElementById('userDisplayName');
    const avatarEl = document.getElementById('avatarLetter');
    const greetingEl = document.getElementById('welcomeGreeting');

    if (displayNameEl) displayNameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
    if (greetingEl) greetingEl.innerHTML = `Welcome back, <span class="text-white font-semibold">${name}</span>!`;

    return name;
}
