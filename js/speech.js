/**
 * speech.js
 * Controla el ciclo de vida del reconocimiento de voz:
 * inicializar → iniciar → detener → reiniciar estadísticas.
 */

import { speechTracker }   from './speechTracker.js';
import { saveSession }     from './sessionStore.js';
import { getCurrentProfile } from './studentProfile.js';

let recognition        = null;
let isSpeechRunning    = false;
let speechUpdateInterval = null;

/** @returns {SpeechRecognition|null} Instancia actual del reconocimiento. */
export function getRecognition() {
    return recognition;
}

/** @returns {boolean} Indica si el reconocimiento de voz está activo. */
export function getSpeechRunning() {
    return isSpeechRunning;
}

/**
 * Crea y configura la instancia de SpeechRecognition.
 * Se reinicia automáticamente si se interrumpe mientras está activo.
 */
export function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    recognition.lang            = 'es-ES';
    recognition.continuous      = true;
    recognition.interimResults  = true;

    recognition.onresult = (event) => {
        const last       = event.results.length - 1;
        const transcript = event.results[last][0].transcript;
        if (event.results[last].isFinal || event.results[last][0].confidence > 0.7) {
            speechTracker.processText(transcript);
        }
    };

    recognition.onerror = (event) => {
        const el = document.getElementById('speech-status');
        el.textContent = `Error en reconocimiento de voz: ${event.error}`;
        el.className   = 'status error';
    };

    // Reinicio automático mientras el análisis siga activo
    recognition.onend = () => {
        if (isSpeechRunning) recognition.start();
    };
}

/**
 * Inicia el reconocimiento de voz.
 * @param {boolean} speechRecognitionSupported
 */
export async function startSpeechRecognition(speechRecognitionSupported) {
    const speechStatus = document.getElementById('speech-status');

    if (!speechRecognitionSupported) {
        speechStatus.textContent = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome.';
        speechStatus.className   = 'status error';
        return;
    }

    try {
        if (!recognition) initSpeechRecognition();

        recognition.start();
        isSpeechRunning = true;
        speechTracker.start();

        speechUpdateInterval = setInterval(() => speechTracker.updateTime(), 1000);

        document.getElementById('start-speech').disabled = true;
        document.getElementById('stop-speech').disabled  = false;
        speechStatus.textContent = 'Análisis de voz iniciado. Comience a hablar...';
        speechStatus.className   = 'status success';
    } catch (err) {
        speechStatus.textContent = `Error al iniciar reconocimiento de voz: ${err.message}`;
        speechStatus.className   = 'status error';
    }
}

/** Detiene el reconocimiento de voz y congela las estadísticas. */
export function stopSpeechRecognition() {
    if (!recognition) return;

    recognition.stop();
    isSpeechRunning = false;
    clearInterval(speechUpdateInterval);
    speechTracker.stop();

    document.getElementById('start-speech').disabled = false;
    document.getElementById('stop-speech').disabled  = true;

    const speechStatus = document.getElementById('speech-status');
    speechStatus.textContent = 'Análisis de voz detenido.';
    speechStatus.className   = 'status';

    // Guardar sesión si hubo datos suficientes
    const profile = getCurrentProfile();
    if (profile && speechTracker.totalTime >= 5) {
        const cat = speechTracker.getFillerCategory();
        saveSession({
            studentName:    profile.name,
            grade:          profile.grade,
            topic:          profile.topic,
            type:           'speech',
            duration:       speechTracker.totalTime,
            gazePercentage: null,
            fillerRate:     speechTracker.getFillerRate(),
            fillerCount:    speechTracker.fillerWords,
            totalWords:     speechTracker.totalWords,
            evaluation:     cat.text,
        });
    }
}

/** Reinicia las estadísticas de voz. */
export function resetSpeechStats() {
    speechTracker.reset();

    const speechStatus = document.getElementById('speech-status');
    speechStatus.textContent = 'Estadísticas reiniciadas.';
    speechStatus.className   = 'status';
}
