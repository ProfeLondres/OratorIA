/**
 * history.js
 * Renderiza y gestiona la pestaña de historial de sesiones.
 */

import { getSessions, deleteSession, clearAllSessions, getSessionsByStudent } from './sessionStore.js';
import { formatTime }     from './utils.js';
import { generateReport } from './report.js';

// ---- API pública -------------------------------------------------------

/**
 * Inicializa los event listeners del panel de historial.
 * Llamar una sola vez desde app.js.
 */
export function initHistory() {
    document.getElementById('history-filter')
        .addEventListener('input', e => renderHistory(e.target.value));

    document.getElementById('history-clear')
        .addEventListener('click', () => {
            if (confirm('¿Eliminar TODAS las sesiones guardadas? Esta acción no se puede deshacer.')) {
                clearAllSessions();
                renderHistory();
            }
        });
}

/**
 * Renderiza el listado de sesiones en el panel #history-list.
 * @param {string} [filterName='']  Filtrar por nombre de estudiante
 */
export function renderHistory(filterName = '') {
    const sessions = filterName.trim()
        ? getSessionsByStudent(filterName)
        : getSessions();

    const container = document.getElementById('history-list');
    if (!container) return;

    _updateSummary(sessions);

    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-history">
                <div class="empty-icon">📋</div>
                <p>${filterName ? 'No se encontraron sesiones para ese nombre.' : 'No hay sesiones registradas aún.'}</p>
                <p class="empty-hint">Realiza un análisis para ver el historial aquí.</p>
            </div>
        `;
        return;
    }

    const rows = sessions.map(s => _buildRow(s, filterName)).join('');

    container.innerHTML = `
        <div class="table-wrapper">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Estudiante</th>
                        <th>Grado</th>
                        <th>Tema</th>
                        <th>Modo</th>
                        <th>Duración</th>
                        <th>Visual %</th>
                        <th>Muletillas/min</th>
                        <th>Evaluación</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    // Botones de reporte
    container.querySelectorAll('.btn-report-session').forEach(btn => {
        btn.addEventListener('click', () => {
            const sessions = getSessions();
            const session  = sessions.find(s => s.id === Number(btn.dataset.id));
            if (session) generateReport(session);
        });
    });

    // Botones de eliminar
    container.querySelectorAll('.btn-delete-session').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteSession(Number(btn.dataset.id));
            renderHistory(filterName);
        });
    });
}

// ---- Helpers privados --------------------------------------------------

function _buildRow(s, filterName) {
    const date = new Date(s.id).toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const duration  = formatTime(s.duration || 0);
    const gaze      = s.gazePercentage != null ? `${Math.round(s.gazePercentage)}%`   : '—';
    const filler    = s.fillerRate     != null ? s.fillerRate.toFixed(1)               : '—';
    const evalBadge = _evalBadge(s.evaluation);
    const modeIcon  = _modeIcon(s.type);
    const topic     = s.topic ? `<span title="${_esc(s.topic)}">${_truncate(s.topic, 28)}</span>` : '—';

    return `
        <tr>
            <td class="col-date">${date}</td>
            <td class="col-name"><strong>${_esc(s.studentName || '—')}</strong></td>
            <td class="col-grade">${_esc(s.grade || '—')}</td>
            <td class="col-topic">${topic}</td>
            <td class="col-mode">${modeIcon}</td>
            <td class="col-duration">${duration}</td>
            <td class="col-gaze">${gaze}</td>
            <td class="col-filler">${filler}</td>
            <td class="col-eval">${evalBadge}</td>
            <td class="col-actions">
                <button class="btn-report-session" data-id="${s.id}" title="Generar reporte PDF">📄</button>
                <button class="btn-delete-session"  data-id="${s.id}" title="Eliminar sesión">✕</button>
            </td>
        </tr>
    `;
}

function _updateSummary(sessions) {
    const el = document.getElementById('history-summary');
    if (!el) return;

    if (sessions.length === 0) {
        el.textContent = '';
        return;
    }

    const combined = sessions.filter(s => s.type === 'combined' && s.gazePercentage != null);
    if (combined.length === 0) {
        el.textContent = `${sessions.length} sesión(es) encontrada(s).`;
        return;
    }

    const avgGaze   = combined.reduce((a, s) => a + s.gazePercentage, 0) / combined.length;
    const avgFiller = combined.reduce((a, s) => a + (s.fillerRate || 0), 0) / combined.length;

    el.innerHTML = `
        <span>${sessions.length} sesión(es)</span>
        <span>· Visual promedio: <strong>${Math.round(avgGaze)}%</strong></span>
        <span>· Muletillas/min promedio: <strong>${avgFiller.toFixed(1)}</strong></span>
    `;
}

function _evalBadge(evaluation) {
    if (!evaluation) return '<span class="eval-badge">—</span>';
    const cssClass = _evalClass(evaluation);
    return `<span class="eval-badge ${cssClass}">${_esc(evaluation)}</span>`;
}

function _evalClass(evaluation) {
    const e = (evaluation || '').toLowerCase();
    if (e.includes('excelente'))  return 'eval-excellent';
    if (e.includes('buen'))       return 'eval-good';
    if (e.includes('aceptable'))  return 'eval-average';
    if (e.includes('mejorar') || e.includes('insuficiente') || e.includes('excesivo')) return 'eval-poor';
    return '';
}

function _modeIcon(type) {
    if (type === 'gaze')     return '<span class="mode-badge mode-gaze">👁 Mirada</span>';
    if (type === 'speech')   return '<span class="mode-badge mode-speech">🎙 Voz</span>';
    if (type === 'combined') return '<span class="mode-badge mode-combined">⚡ Combinado</span>';
    return '—';
}

function _truncate(str, max) {
    return str.length > max ? str.slice(0, max) + '…' : str;
}

function _esc(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
