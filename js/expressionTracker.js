/**
 * expressionTracker.js
 * Acumula y expone estadísticas de expresiones faciales detectadas
 * por face-api.js durante el análisis.
 *
 * Expresiones soportadas por face-api.js:
 *   neutral, happy, sad, angry, fearful, disgusted, surprised
 *
 * Para oratoria las interpretamos como:
 *   happy     → Seguro / Positivo     (favorable)
 *   neutral   → Concentrado / Tranquilo (favorable)
 *   fearful   → Nervioso / Inseguro   (desfavorable)
 *   surprised → Incertidumbre         (desfavorable)
 *   sad       → Poco entusiasmo       (desfavorable)
 *   angry     → Tenso / Frustrado     (desfavorable)
 *   disgusted → Incomodidad           (desfavorable)
 */

// ---- Mapa de expresiones -----------------------------------------------

export const EMOTIONS = {
    happy:     { label: 'Seguro / Positivo',    emoji: '😊', color: '#27ae60', positive: true  },
    neutral:   { label: 'Concentrado',          emoji: '😐', color: '#3498db', positive: true  },
    fearful:   { label: 'Nervioso / Inseguro',  emoji: '😰', color: '#e74c3c', positive: false },
    surprised: { label: 'Incertidumbre',        emoji: '😲', color: '#f39c12', positive: false },
    sad:       { label: 'Poco entusiasmo',      emoji: '😔', color: '#9b59b6', positive: false },
    angry:     { label: 'Tenso',                emoji: '😤', color: '#e67e22', positive: false },
    disgusted: { label: 'Incomodidad',          emoji: '😒', color: '#95a5a6', positive: false },
};

// ---- Tracker -----------------------------------------------------------

export const expressionTracker = {

    /** Cantidad de frames acumulados por expresión dominante */
    counts: { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 },

    /** Total de frames procesados */
    totalFrames: 0,

    /**
     * Callback para sincronizar el panel combinado.
     * app.js lo asigna.
     * @type {Function|null}
     */
    onCombinedUpdate: null,

    // ---- Ciclo de vida -------------------------------------------------

    /** Reinicia todas las estadísticas. */
    reset() {
        for (const key of Object.keys(this.counts)) this.counts[key] = 0;
        this.totalFrames = 0;
        this.updateUI(null);
    },

    /**
     * Procesa el objeto de expresiones de un frame.
     * @param {Object} expressions  face-api.js FaceExpressions
     */
    update(expressions) {
        if (!expressions) return;

        // Encontrar la expresión dominante en este frame
        let dominant = 'neutral';
        let maxVal   = 0;
        for (const [key, val] of Object.entries(expressions)) {
            if (val > maxVal) { maxVal = val; dominant = key; }
        }

        this.counts[dominant] = (this.counts[dominant] || 0) + 1;
        this.totalFrames++;

        this.updateUI(dominant);
        if (this.onCombinedUpdate) this.onCombinedUpdate(dominant);
    },

    // ---- Getters -------------------------------------------------------

    /**
     * Retorna la expresión dominante de toda la sesión.
     * @returns {string|null}
     */
    getDominantExpression() {
        if (this.totalFrames === 0) return null;
        return Object.entries(this.counts)
            .sort((a, b) => b[1] - a[1])[0][0];
    },

    /**
     * Retorna el perfil de expresiones como porcentajes.
     * Solo incluye expresiones con > 0 frames.
     * @returns {Object.<string, number>}
     */
    getProfile() {
        if (this.totalFrames === 0) return {};
        const profile = {};
        for (const [expr, count] of Object.entries(this.counts)) {
            if (count > 0) {
                profile[expr] = Math.round((count / this.totalFrames) * 100);
            }
        }
        return profile;
    },

    /**
     * Índice de confianza: % del tiempo en estados positivos (happy + neutral).
     * @returns {number} 0-100
     */
    getConfidenceScore() {
        if (this.totalFrames === 0) return 0;
        const positive = (this.counts.happy || 0) + (this.counts.neutral || 0);
        return Math.round((positive / this.totalFrames) * 100);
    },

    // ---- UI ------------------------------------------------------------

    /**
     * Actualiza el badge en vivo y las barras de perfil en el panel de mirada.
     * @param {string|null} currentExpression  Expresión del frame actual (null = no detectado)
     */
    updateUI(currentExpression) {
        this._updatePanel('gaze', currentExpression);
    },

    /**
     * Actualiza un panel específico (gaze o combined).
     * @param {string}      prefix             'gaze' | 'combined'
     * @param {string|null} currentExpression
     */
    _updatePanel(prefix, currentExpression) {
        // Badge en vivo
        const badge = document.getElementById(`${prefix}-emotion-live`);
        if (badge) {
            if (!currentExpression) {
                badge.textContent  = 'Sin detección';
                badge.className    = 'emotion-live-badge';
            } else {
                const meta         = EMOTIONS[currentExpression] || EMOTIONS.neutral;
                badge.textContent  = `${meta.emoji}  ${meta.label}`;
                badge.className    = `emotion-live-badge ${meta.positive ? 'emotion-positive' : 'emotion-negative'}`;
            }
        }

        // Índice de confianza
        const confEl = document.getElementById(`${prefix}-confidence`);
        if (confEl) {
            const score = this.getConfidenceScore();
            confEl.textContent = this.totalFrames > 0 ? `${score}%` : '—';
        }

        // Barras de perfil (solo actualizar cada ~10 frames para evitar thrashing del DOM)
        if (this.totalFrames % 10 === 0) {
            this._renderProfileBars(prefix);
        }
    },

    /**
     * Renderiza las mini-barras de distribución de expresiones.
     * @param {string} prefix 'gaze' | 'combined'
     */
    _renderProfileBars(prefix) {
        const container = document.getElementById(`${prefix}-emotion-profile`);
        if (!container || this.totalFrames === 0) return;

        const profile = this.getProfile();
        const sorted  = Object.entries(profile).sort((a, b) => b[1] - a[1]);

        container.innerHTML = sorted.map(([expr, pct]) => {
            const meta = EMOTIONS[expr] || { emoji: '❓', label: expr, color: '#aaa' };
            return `
                <div class="emotion-bar-row">
                    <span class="emotion-bar-label">${meta.emoji} ${meta.label}</span>
                    <div class="emotion-bar-track">
                        <div class="emotion-bar-fill" style="width:${pct}%;background:${meta.color}"></div>
                    </div>
                    <span class="emotion-bar-pct">${pct}%</span>
                </div>
            `;
        }).join('');
    }
};
