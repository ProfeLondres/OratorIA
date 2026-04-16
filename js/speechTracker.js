/**
 * speechTracker.js
 * Objeto que acumula y expone las estadísticas de voz y muletillas.
 * Usa callbacks para notificar actualizaciones al módulo principal.
 */

import { FILLER_WORDS } from './config.js';
import { formatTime }   from './utils.js';

export const speechTracker = {
    startTime: null,
    totalTime: 0,
    totalWords: 0,
    fillerWords: 0,
    fillerWordsMap: {},
    transcript: [],

    /**
     * Callback para actualizar la gráfica de muletillas.
     * @type {Function|null}
     */
    onFillerChartUpdate: null,

    /**
     * Callback para sincronizar el panel combinado.
     * @type {Function|null}
     */
    onCombinedUpdate: null,

    /** Reinicia todas las estadísticas. */
    reset() {
        this.startTime     = null;
        this.totalTime     = 0;
        this.totalWords    = 0;
        this.fillerWords   = 0;
        this.fillerWordsMap = {};
        this.transcript    = [];
        this.updateUI();
        document.getElementById('transcript-container').innerHTML =
            '<p>La transcripción aparecerá aquí cuando comience a hablar...</p>';
        document.getElementById('combined-transcript').innerHTML =
            '<p>La transcripción aparecerá aquí cuando comience a hablar...</p>';
        if (this.onFillerChartUpdate) this.onFillerChartUpdate();
    },

    /** Marca el inicio de la grabación. */
    start() {
        this.startTime = Date.now();
        this.updateUI();
    },

    /** Finaliza la grabación y congela el tiempo total. */
    stop() {
        if (this.startTime) {
            this.totalTime = (Date.now() - this.startTime) / 1000;
            this.startTime = null;
        }
        this.updateUI();
    },

    /** Actualiza el tiempo transcurrido (llamar desde un setInterval). */
    updateTime() {
        if (this.startTime) {
            this.totalTime = (Date.now() - this.startTime) / 1000;
            this.updateUI();
        }
    },

    /**
     * Procesa un fragmento de transcripción: cuenta palabras,
     * detecta muletillas y las resalta en HTML.
     * @param {string} text
     */
    processText(text) {
        if (!text) return;

        const lowerText = text.toLowerCase();
        const words = lowerText.split(/\s+/).filter(w => w.length > 0);
        this.totalWords += words.length;

        for (const filler of FILLER_WORDS) {
            const regex   = new RegExp(`\\b${filler}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) {
                this.fillerWords += matches.length;
                this.fillerWordsMap[filler] = (this.fillerWordsMap[filler] || 0) + matches.length;
            }
        }

        // Resaltar muletillas en el texto
        let highlighted = text;
        for (const filler of FILLER_WORDS) {
            const regex = new RegExp(`\\b${filler}\\b`, 'gi');
            highlighted = highlighted.replace(regex, `<span class="filler-word">$&</span>`);
        }

        this.transcript.push(highlighted);
        this.updateTranscript();
        this.updateUI();
        if (this.onFillerChartUpdate) this.onFillerChartUpdate();
    },

    /** Renderiza las últimas 10 líneas de la transcripción en ambos paneles. */
    updateTranscript() {
        const html = this.transcript
            .slice(-10)
            .map(line => `<div class="transcript-line">${line}</div>`)
            .join('');

        const fallback = '<p>La transcripción aparecerá aquí cuando comience a hablar...</p>';

        const main     = document.getElementById('transcript-container');
        const combined = document.getElementById('combined-transcript');
        main.innerHTML     = html || fallback;
        combined.innerHTML = html || fallback;

        main.scrollTop     = main.scrollHeight;
        combined.scrollTop = combined.scrollHeight;
    },

    /** @returns {number} Muletillas por minuto */
    getFillerRate() {
        const minutes = this.totalTime / 60;
        return minutes > 0 ? this.fillerWords / minutes : 0;
    },

    /** @returns {number} Palabras por minuto */
    getWordsPerMinute() {
        const minutes = this.totalTime / 60;
        return minutes > 0 ? Math.round(this.totalWords / minutes) : 0;
    },

    /**
     * @returns {{ category: string, text: string, class: string }}
     */
    getFillerCategory() {
        const rate = this.getFillerRate();
        if (rate < 1)  return { category: 'insuficiente', text: 'Datos insuficientes',       class: '' };
        if (rate <= 3) return { category: 'bajo',         text: 'Bajo uso de muletillas',    class: 'low-filler' };
        if (rate <= 8) return { category: 'moderado',     text: 'Uso moderado de muletillas',class: 'moderate-filler' };
        if (rate <= 15)return { category: 'alto',         text: 'Alto uso de muletillas',    class: 'high-filler' };
        return              { category: 'extremo',        text: 'Extremo uso de muletillas', class: 'extreme-filler' };
    },

    /** Actualiza los elementos del DOM del panel de voz. */
    updateUI() {
        document.getElementById('recording-time').textContent   = formatTime(this.totalTime);
        document.getElementById('total-words').textContent      = this.totalWords;
        document.getElementById('filler-count').textContent     = this.fillerWords;
        document.getElementById('filler-rate').textContent      = this.getFillerRate().toFixed(1);
        document.getElementById('words-per-minute').textContent = this.getWordsPerMinute();

        const cat = this.getFillerCategory();
        const el  = document.getElementById('filler-category');
        el.textContent = `Categoría: ${cat.text}`;
        el.className   = `status center ${cat.class}`;

        if (this.onCombinedUpdate) this.onCombinedUpdate();
    }
};
