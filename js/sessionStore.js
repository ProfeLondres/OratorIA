/**
 * sessionStore.js
 * Gestiona el historial de sesiones en localStorage.
 * Cada sesión representa un análisis completado por un estudiante.
 */

const STORAGE_KEY = 'oratoria_sessions';
const MAX_SESSIONS = 200;

/**
 * Guarda una sesión al inicio de la lista (más reciente primero).
 * @param {Object} session
 * @returns {Object} La sesión con su id asignado
 */
export function saveSession(session) {
    const sessions = getSessions();
    const newSession = { ...session, id: Date.now() };
    sessions.unshift(newSession);
    if (sessions.length > MAX_SESSIONS) sessions.splice(MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return newSession;
}

/**
 * Retorna todas las sesiones guardadas (más reciente primero).
 * @returns {Object[]}
 */
export function getSessions() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

/**
 * Elimina una sesión por su id.
 * @param {number} id
 */
export function deleteSession(id) {
    const updated = getSessions().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Elimina todas las sesiones guardadas.
 */
export function clearAllSessions() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Retorna sesiones que coincidan con un nombre (búsqueda parcial, sin mayúsculas).
 * @param {string} name
 * @returns {Object[]}
 */
export function getSessionsByStudent(name) {
    const query = name.toLowerCase().trim();
    return getSessions().filter(s =>
        (s.studentName || '').toLowerCase().includes(query)
    );
}

/**
 * Retorna estadísticas agregadas de un estudiante.
 * @param {string} name  Nombre exacto del estudiante
 * @returns {{ avgGaze: number, avgFillerRate: number, totalSessions: number }}
 */
export function getStudentStats(name) {
    const sessions = getSessionsByStudent(name).filter(s => s.type === 'combined');
    if (sessions.length === 0) return null;

    const avgGaze      = sessions.reduce((a, s) => a + (s.gazePercentage || 0), 0) / sessions.length;
    const avgFillerRate = sessions.reduce((a, s) => a + (s.fillerRate || 0), 0) / sessions.length;

    return { avgGaze, avgFillerRate, totalSessions: sessions.length };
}
