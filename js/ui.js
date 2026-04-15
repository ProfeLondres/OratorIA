/**
 * ui.js
 * Funciones de interfaz genéricas: navegación por pestañas,
 * notificaciones temporales y barra de progreso de carga.
 */

/**
 * Muestra la pestaña indicada y oculta el resto.
 * Actualiza también la clase "active" en los botones de navegación.
 * @param {string} tabId  ID del contenido de pestaña a mostrar ('gaze', 'speech', 'combined')
 */
export function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(panel => {
        panel.style.display = 'none';
    });

    document.getElementById(tabId).style.display = 'block';

    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
}

/**
 * Muestra una notificación flotante en la esquina inferior derecha
 * que desaparece tras 3 segundos.
 * @param {string} message  Texto a mostrar
 * @param {string} [type]   Clase CSS adicional: 'success' | 'error' | 'warning'
 */
export function showNotification(message, type = '') {
    const el = document.createElement('div');
    el.className   = `status ${type}`;
    el.textContent = message;
    Object.assign(el.style, {
        position:  'fixed',
        bottom:    '20px',
        right:     '20px',
        zIndex:    '9999',
        minWidth:  '250px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    });

    document.body.appendChild(el);

    setTimeout(() => {
        el.style.transition = 'opacity 0.5s';
        el.style.opacity    = '0';
        setTimeout(() => document.body.removeChild(el), 500);
    }, 3000);
}

/**
 * Actualiza el texto de la barra de carga de modelos.
 * @param {number} progress  Modelos cargados hasta ahora
 * @param {number} total     Total de modelos a cargar
 */
export function updateLoadingProgress(progress, total) {
    const percentage  = Math.round((progress / total) * 100);
    const loadingEl   = document.getElementById('loading-models');
    if (loadingEl) {
        loadingEl.querySelector('span').textContent =
            `Cargando modelos de reconocimiento facial... (${percentage}%)`;
    }
}
