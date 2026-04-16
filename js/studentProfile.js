/**
 * studentProfile.js
 * Gestiona el perfil del estudiante activo y el modal de inicio de sesión.
 */

/** @type {{ name: string, grade: string, topic: string } | null} */
let _currentProfile = null;

/**
 * Retorna el perfil del estudiante actualmente activo.
 * @returns {{ name: string, grade: string, topic: string } | null}
 */
export function getCurrentProfile() {
    return _currentProfile;
}

/**
 * Limpia el perfil activo (útil al resetear).
 */
export function clearProfile() {
    _currentProfile = null;
}

/**
 * Muestra el modal de perfil del estudiante.
 * Al confirmar, guarda el perfil y llama a onConfirm.
 * @param {function} onConfirm - Callback ejecutado con el perfil confirmado
 */
export function showProfileModal(onConfirm) {
    // Eliminar modal previo si existe
    const existing = document.getElementById('profile-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id        = 'profile-modal';
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'modal-title');

    // Pre-fill with last used profile if available
    const lastName  = _currentProfile?.name  || '';
    const lastGrade = _currentProfile?.grade || '';

    modal.innerHTML = `
        <div class="modal-box">
            <div class="modal-header">
                <h2 id="modal-title">Datos del Estudiante</h2>
                <button class="modal-close" aria-label="Cerrar">&times;</button>
            </div>
            <p class="modal-subtitle">Completa la información antes de iniciar el análisis.</p>

            <div class="form-group">
                <label for="profile-name">Nombre completo <span class="required">*</span></label>
                <input type="text" id="profile-name" placeholder="Ej: Juan Pérez"
                       autocomplete="off" value="${lastName}" maxlength="80">
                <span class="field-error" id="name-error"></span>
            </div>

            <div class="form-group">
                <label for="profile-grade">Grado</label>
                <input type="text" id="profile-grade" placeholder="Ej: 10°A"
                       value="${lastGrade}" maxlength="20">
            </div>

            <div class="form-group">
                <label for="profile-topic">Tema de la presentación</label>
                <input type="text" id="profile-topic" placeholder="Ej: El calentamiento global"
                       maxlength="120">
            </div>

            <div class="modal-actions">
                <button id="profile-cancel"  class="btn-secondary">Cancelar</button>
                <button id="profile-confirm" class="btn-primary">Iniciar análisis →</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus al primer campo
    requestAnimationFrame(() => {
        const nameInput = document.getElementById('profile-name');
        nameInput.focus();
        nameInput.select();
    });

    // ---- Handlers --------------------------------------------------------

    const confirm = () => {
        const nameInput = document.getElementById('profile-name');
        const name      = nameInput.value.trim();
        const grade     = document.getElementById('profile-grade').value.trim();
        const topic     = document.getElementById('profile-topic').value.trim();

        const errorEl = document.getElementById('name-error');

        if (!name) {
            nameInput.classList.add('input-error');
            errorEl.textContent = 'El nombre del estudiante es obligatorio.';
            nameInput.focus();
            return;
        }

        _currentProfile = { name, grade, topic };
        modal.remove();
        onConfirm(_currentProfile);
    };

    const close = () => modal.remove();

    document.getElementById('profile-confirm').addEventListener('click', confirm);
    document.getElementById('profile-cancel').addEventListener('click', close);
    modal.querySelector('.modal-close').addEventListener('click', close);

    // Cerrar al hacer clic en el fondo
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    // Enter confirma, Escape cierra
    modal.addEventListener('keydown', e => {
        if (e.key === 'Enter')  confirm();
        if (e.key === 'Escape') close();
    });

    // Limpiar error al escribir
    document.getElementById('profile-name').addEventListener('input', () => {
        document.getElementById('profile-name').classList.remove('input-error');
        document.getElementById('name-error').textContent = '';
    });
}

/**
 * Actualiza la barra de perfil visible durante el análisis.
 * @param {{ name: string, grade: string, topic: string } | null} profile
 */
export function updateStudentBar(profile) {
    const bar = document.getElementById('student-bar');
    if (!bar) return;

    if (!profile) {
        bar.style.display = 'none';
        return;
    }

    bar.querySelector('#bar-name').textContent  = profile.name;
    bar.querySelector('#bar-grade').textContent = profile.grade  ? `· ${profile.grade}` : '';
    bar.querySelector('#bar-topic').textContent = profile.topic  ? `· ${profile.topic}` : '';
    bar.style.display = 'flex';
}
