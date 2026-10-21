// session-timeout.js - Inactivity-based auto-logout for TradeWizer Journal
// Self-contained: creates its own modal, tracks activity, handles cross-tab.

const DEFAULT_TIMEOUT_MINUTES = 30;
const DEFAULT_WARNING_SECONDS = 60;
const ACTIVITY_EVENTS = [
    'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart',
    'input', 'click', 'focus', 'wheel', 'touchmove'
];
const STORAGE_KEY_MINUTES = 'sessionTimeoutMinutes';

export function getStoredTimeoutMinutes() {
    const stored = localStorage.getItem(STORAGE_KEY_MINUTES);
    if (stored === 'disabled') return 0;
    const parsed = parseInt(stored, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return DEFAULT_TIMEOUT_MINUTES;
}

export function setStoredTimeoutMinutes(minutes) {
    if (minutes === 0 || minutes === 'disabled' || minutes === '0') {
        localStorage.setItem(STORAGE_KEY_MINUTES, 'disabled');
    } else {
        localStorage.setItem(STORAGE_KEY_MINUTES, String(minutes));
    }
}

export class SessionTimeoutManager {
    constructor(options = {}) {
        this.timeoutMinutes = options.timeoutMinutes ?? getStoredTimeoutMinutes();
        this.warningSeconds = options.warningSeconds ?? DEFAULT_WARNING_SECONDS;
        this.onTimeout = options.onTimeout || (() => {});

        this.enabled = this.timeoutMinutes > 0;
        this.timeoutMs = this.timeoutMinutes * 60 * 1000;
        this.warningMs = this.warningSeconds * 1000;

        this.lastActivity = Date.now();
        this.warningVisible = false;
        this.timerInterval = null;
        this.modal = null;
        this.countdownEl = null;

        this._activityHandler = this.handleActivity.bind(this);
        this._visibilityHandler = this.handleVisibilityChange.bind(this);
    }

    start() {
        if (!this.enabled) {
            console.log('[SESSION TIMEOUT] Disabled — timer not started.');
            return;
        }
        this.stop();
        this.lastActivity = Date.now();
        this.warningVisible = false;
        this.createModal();
        this.addListeners();
        this.startTimer();
        console.log(
            `[SESSION TIMEOUT] Started — warning after ${this.timeoutMinutes} min - ${this.warningSeconds}s, logout at ${this.timeoutMinutes} min of inactivity.`
        );
    }

    stop() {
        this.clearTimers();
        this.removeListeners();
        this.hideWarning();
        this.removeModal();
    }

    updateTimeout(minutes) {
        this.timeoutMinutes = Number(minutes) || 0;
        this.enabled = this.timeoutMinutes > 0;
        this.timeoutMs = this.timeoutMinutes * 60 * 1000;
        setStoredTimeoutMinutes(this.timeoutMinutes);
        if (this.enabled) {
            this.start();
        } else {
            this.stop();
            console.log('[SESSION TIMEOUT] Disabled by user.');
        }
    }

    // ---- core timer ----
    startTimer() {
        this.clearTimers();
        this.timerInterval = setInterval(() => this.tick(), 1000);
    }

    clearTimers() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    tick() {
        if (!this.enabled) return;
        const elapsed = Date.now() - this.lastActivity;
        const remainingMs = this.timeoutMs - elapsed;

        if (remainingMs <= 0) {
            this.handleTimeout();
            return;
        }

        if (remainingMs <= this.warningMs && !this.warningVisible) {
            this.showWarning();
        }

        if (this.warningVisible) {
            const countdownSec = Math.max(0, Math.ceil(remainingMs / 1000));
            this.updateCountdown(countdownSec);
        }
    }

    // ---- activity tracking ----
    handleActivity() {
        if (!this.enabled || this.warningVisible) return;
        const now = Date.now();
        if (now - this.lastActivity < 1000) return; // throttle
        this.lastActivity = now;
    }

    handleVisibilityChange() {
        if (!this.enabled) return;
        if (document.visibilityState === 'visible') {
            // Force an immediate check in case the tab was hidden past the timeout
            this.tick();
        }
    }

    addListeners() {
        ACTIVITY_EVENTS.forEach((ev) =>
            document.addEventListener(ev, this._activityHandler, { passive: true, capture: true })
        );
        document.addEventListener('visibilitychange', this._visibilityHandler);
    }

    removeListeners() {
        ACTIVITY_EVENTS.forEach((ev) =>
            document.removeEventListener(ev, this._activityHandler, { capture: true })
        );
        document.removeEventListener('visibilitychange', this._visibilityHandler);
    }

    // ---- warning UI ----
    showWarning() {
        if (this.warningVisible) return;
        this.warningVisible = true;
        this.showModal();
        const elapsed = Date.now() - this.lastActivity;
        const remainingSec = Math.max(0, Math.ceil((this.timeoutMs - elapsed) / 1000));
        this.updateCountdown(remainingSec);
        console.log('[SESSION TIMEOUT] Warning shown — counting down from', remainingSec);
    }

    hideWarning() {
        this.warningVisible = false;
        this.hideModal();
    }

    reset() {
        this.lastActivity = Date.now();
        this.hideWarning();
    }

    // ---- timeout ----
    handleTimeout() {
        this.clearTimers();
        this.hideWarning();
        console.log('[SESSION TIMEOUT] Timeout reached — logging out.');
        try {
            this.onTimeout();
        } catch (err) {
            console.error('[SESSION TIMEOUT] onTimeout callback failed:', err);
        }
    }

    // ---- modal ----
    createModal() {
        if (this.modal) return;
        const modal = document.createElement('div');
        modal.id = 'sessionTimeoutModal';
        modal.className =
            'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999] hidden backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-[#0a0a0a] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-[rgba(201,168,76,0.3)]">
                <div class="p-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-12 h-12 rounded-full bg-[rgba(201,168,76,0.15)] flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-clock text-[#C9A84C] text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-100">Session Expiring Soon</h3>
                            <p class="text-sm text-gray-400">You've been inactive for a while</p>
                        </div>
                    </div>
                    <p class="text-gray-300 mb-2">For your security, you'll be logged out in:</p>
                    <div class="text-center my-5">
                        <div class="inline-flex items-baseline gap-1">
                            <span id="sessionTimeoutCountdown" class="text-5xl font-bold text-[#C9A84C]">60</span>
                            <span class="text-gray-400 text-lg">seconds</span>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-2">
                        <button type="button" id="sessionTimeoutLogoutBtn"
                                class="px-5 py-2.5 text-gray-400 hover:text-gray-200 font-semibold transition-colors rounded-lg hover:bg-gray-800">
                            Log out now
                        </button>
                        <button type="button" id="sessionTimeoutStayBtn"
                                class="px-6 py-2.5 bg-[#C9A84C] hover:bg-[#d4b85a] text-[#0a0a0a] rounded-lg font-semibold transition-all duration-200">
                            Stay logged in
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modal = modal;
        this.countdownEl = modal.querySelector('#sessionTimeoutCountdown');

        modal.querySelector('#sessionTimeoutStayBtn').addEventListener('click', () => {
            this.reset();
        });
        modal.querySelector('#sessionTimeoutLogoutBtn').addEventListener('click', () => {
            this.handleTimeout();
        });
    }

    showModal() {
        if (this.modal) this.modal.classList.remove('hidden');
    }

    hideModal() {
        if (this.modal) this.modal.classList.add('hidden');
    }

    removeModal() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        this.modal = null;
        this.countdownEl = null;
    }

    updateCountdown(seconds) {
        if (this.countdownEl) this.countdownEl.textContent = String(seconds);
    }
}