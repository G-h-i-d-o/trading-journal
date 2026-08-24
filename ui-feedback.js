export function ensureToastContainer() {
    let container = document.getElementById('global-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'global-toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

export function showToast({ message, type = 'info', duration = 3200 }) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    const typeStyles = {
        success: 'bg-green-500 text-white border-green-400',
        error: 'bg-red-500 text-white border-red-400',
        warning: 'bg-yellow-500 text-black border-yellow-400',
        info: 'bg-slate-800 text-white border-slate-600'
    };

    toast.className = `pointer-events-auto min-w-[220px] max-w-[320px] rounded-lg border px-4 py-3 shadow-lg text-sm font-medium ${typeStyles[type] || typeStyles.info}`;
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-4');
        window.setTimeout(() => toast.remove(), 250);
    }, duration);

    return toast;
}
