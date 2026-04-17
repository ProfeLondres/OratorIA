/**
 * themeToggle.js
 * Gestiona el modo claro / oscuro. Guarda la preferencia en localStorage.
 */

const STORAGE_KEY = 'oratoria_theme';

export function initThemeToggle() {
    const btn  = document.getElementById('theme-toggle');
    if (!btn) return;

    // Aplicar tema guardado (o preferencia del sistema)
    const saved = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;

    _applyTheme(isDark);

    btn.addEventListener('click', () => {
        const currentlyDark = document.body.getAttribute('data-theme') === 'dark';
        _applyTheme(!currentlyDark);
        localStorage.setItem(STORAGE_KEY, !currentlyDark ? 'dark' : 'light');
    });
}

function _applyTheme(dark) {
    document.body.setAttribute('data-theme', dark ? 'dark' : 'light');
}
