/**
 * gazeTracker.js
 * Objeto que acumula y expone las estadísticas de contacto visual.
 * Se comunica con el resto de módulos mediante callbacks opcionales
 * en lugar de importarlos directamente, evitando dependencias circulares.
 */

import { formatTime } from './utils.js';

export const gazeTracker = {
    totalTime: 0,
    lookingTime: 0,
    avoidingTime: 0,
    isLooking: false,
    lastUpdateTime: null,
    historyData: {
        timestamps: [],
        lookingPercentages: []
    },

    /**
     * Callback que app.js asigna para actualizar la gráfica de mirada
     * cada vez que el historial cambia.
     * @type {Function|null}
     */
    onHistoryUpdate: null,

    /**
     * Callback que app.js asigna para sincronizar el panel combinado.
     * @type {Function|null}
     */
    onCombinedUpdate: null,

    /** Reinicia todas las estadísticas y actualiza la interfaz. */
    reset() {
        this.totalTime = 0;
        this.lookingTime = 0;
        this.avoidingTime = 0;
        this.isLooking = false;
        this.lastUpdateTime = null;
        this.historyData = { timestamps: [], lookingPercentages: [] };
        this.updateUI();
        if (this.onHistoryUpdate) this.onHistoryUpdate();
    },

    /**
     * Registra el estado actual de mirada y acumula el tiempo transcurrido
     * desde la última llamada.
     * @param {boolean} isLooking
     * @param {number} [timestamp]
     */
    update(isLooking, timestamp) {
        const currentTime = timestamp || Date.now();

        if (this.lastUpdateTime === null) {
            this.lastUpdateTime = currentTime;
            this.isLooking = isLooking;
            return;
        }

        const elapsed = (currentTime - this.lastUpdateTime) / 1000;
        this.totalTime += elapsed;

        if (this.isLooking) {
            this.lookingTime += elapsed;
        } else {
            this.avoidingTime += elapsed;
        }

        this.isLooking = isLooking;
        this.lastUpdateTime = currentTime;

        // Guardar en historial cada 5 segundos (máximo 20 puntos)
        const lastTs = this.historyData.timestamps;
        if (
            this.totalTime > 0 &&
            (lastTs.length === 0 || currentTime - lastTs[lastTs.length - 1] >= 5000)
        ) {
            this.historyData.timestamps.push(currentTime);
            this.historyData.lookingPercentages.push(this.getLookingPercentage());

            if (this.historyData.timestamps.length > 20) {
                this.historyData.timestamps.shift();
                this.historyData.lookingPercentages.shift();
            }

            if (this.onHistoryUpdate) this.onHistoryUpdate();
        }

        this.updateUI();
    },

    /** @returns {number} Porcentaje de tiempo mirando a cámara (0-100) */
    getLookingPercentage() {
        return this.totalTime > 0 ? (this.lookingTime / this.totalTime) * 100 : 0;
    },

    /** @returns {number} Porcentaje de tiempo evitando la mirada (0-100) */
    getAvoidingPercentage() {
        return this.totalTime > 0 ? (this.avoidingTime / this.totalTime) * 100 : 0;
    },

    /** Actualiza los elementos del DOM del panel de mirada. */
    updateUI() {
        document.getElementById('total-time').textContent       = formatTime(this.totalTime);
        document.getElementById('looking-time').textContent     = formatTime(this.lookingTime);
        document.getElementById('avoiding-time').textContent    = formatTime(this.avoidingTime);

        const lookingPct  = this.getLookingPercentage();
        const avoidingPct = this.getAvoidingPercentage();

        document.getElementById('looking-percentage').textContent  = `${Math.round(lookingPct)}%`;
        document.getElementById('avoiding-percentage').textContent = `${Math.round(avoidingPct)}%`;
        document.getElementById('looking-progress').style.width    = `${lookingPct}%`;
        document.getElementById('avoiding-progress').style.width   = `${avoidingPct}%`;

        const currentState = document.getElementById('current-state');
        if (this.isLooking) {
            currentState.textContent = 'Estado: Mirando a la cámara';
            currentState.className   = 'status success center';
        } else {
            currentState.textContent = 'Estado: Evitando la mirada';
            currentState.className   = 'status warning center';
        }

        if (this.onCombinedUpdate) this.onCombinedUpdate();
    }
};
