/**
 * speech.js
 * Controla el ciclo de vida del reconocimiento de voz:
 * inicializar → iniciar → detener → reiniciar estadísticas.
 */

import { speechTracker }                             from './speechTracker.js';
import { saveSession }                               from './sessionStore.js';
import { getCurrentProfile }                         from './studentProfile.js';
import { startAudioAnalysis, stopAudioAnalysis,
         getAudioStats, resetAudioStats }            from './audioAnalyzer.js';

let recognition          = null;
let isSpeechRunning      = false;
let speechUpdateInterval = null;
let audioStream          = null;

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

    recognition.lang           = 'es-ES';
    recognition.continuous     = true;
    recognition.interimResults = true;

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
 * Inicia el reconocimiento de voz + análisis de audio (Web Audio API).
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
        // Solicitar stream de audio para el analizador
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        if (!recognition) initSpeechRecognition();

        recognition.start();
        isSpeechRunning = true;
        speechTracker.start();
        resetAudioStats();

        // Iniciar análisis de audio con callback para el medidor de volumen
        startAudioAnalysis(audioStream, (volumePct, isSilent) => {
            _updateVolumeMeter(volumePct, isSilent, 'speech');
        });

        speechUpdateInterval = setInterval(() => {
            speechTracker.updateTime();
            _updateAudioStats('speech');
        }, 1000);

        document.getElementById('start-speech').disabled = true;
        document.getElementById('stop-speech').disabled  = false;
        speechStatus.textContent = 'Análisis de voz iniciado. Comience a hablar...';
        speechStatus.className   = 'status success';
    } catch (err) {
        speechStatus.textContent = `Error al iniciar reconocimiento de voz: ${err.message}`;
        speechStatus.className   = 'status error';
    }
}

/** Detiene el reconocimiento de voz, el analizador y congela las estadísticas. */
export function stopSpeechRecognition() {
    if (!recognition) return;

    recognition.stop();
    isSpeechRunning = false;
    clearInterval(speechUpdateInterval);
    speechTracker.stop();
    stopAudioAnalysis();

    if (audioStream) {
        audioStream.getTracks().forEach(t => t.stop());
        audioStream = null;
    }

    // Mostrar stats finales de audio
    _updateAudioStats('speech');
    _resetVolumeMeter('speech');

    document.getElementById('start-speech').disabled = false;
    document.getElementById('stop-speech').disabled  = true;

    const speechStatus = document.getElementById('speech-status');
    speechStatus.textContent = 'Análisis de voz detenido.';
    speechStatus.className   = 'status';

    // Guardar sesión si hubo datos suficientes
    const profile = getCurrentProfile();
    if (profile && speechTracker.totalTime >= 5) {
        const cat        = speechTracker.getFillerCategory();
        const audio      = getAudioStats();
        const topFillers = Object.entries(speechTracker.fillerWordsMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        saveSession({
            studentName:     profile.name,
            grade:           profile.grade,
            topic:           profile.topic,
            type:            'speech',
            duration:        speechTracker.totalTime,
            gazePercentage:  null,
            fillerRate:      speechTracker.getFillerRate(),
            fillerCount:     speechTracker.fillerWords,
            totalWords:      speechTracker.totalWords,
            wordsPerMinute:  speechTracker.getWordsPerMinute(),
            avgVolume:       audio.avgVolume,
            peakVolume:      audio.peakVolume,
            pauseCount:      audio.pauseCount,
            longestPauseSec: audio.longestPauseSec,
            topFillers,
            evaluation:      cat.text,
        });
    }
}

/** Reinicia las estadísticas de voz y audio. */
export function resetSpeechStats() {
    speechTracker.reset();
    resetAudioStats();
    _resetVolumeMeter('speech');
    _resetAudioStats('speech');

    const speechStatus = document.getElementById('speech-status');
    speechStatus.textContent = 'Estadísticas reiniciadas.';
    speechStatus.className   = 'status';
}

// ---- Helpers de UI -------------------------------------------------------

/**
 * Actualiza el medidor de volumen visual.
 * @param {number}  volumePct   0-100
 * @param {boolean} isSilent
 * @param {string}  prefix      'speech' | 'combined'
 */
function _updateVolumeMeter(volumePct, isSilent, prefix) {
    const bar = document.getElementById(`${prefix}-volume-bar`);
    if (!bar) return;

    bar.style.width = `${volumePct}%`;

    // Color: verde → amarillo → rojo según nivel
    if (volumePct < 30)      bar.className = 'vu-bar vu-low';
    else if (volumePct < 65) bar.className = 'vu-bar vu-mid';
    else                     bar.className = 'vu-bar vu-high';
}

/**
 * Actualiza las estadísticas de audio en el DOM.
 * @param {string} prefix 'speech' | 'combined'
 */
function _updateAudioStats(prefix) {
    const stats = getAudioStats();
    const pc = document.getElementById(`${prefix}-pause-count`);
    const lp = document.getElementById(`${prefix}-longest-pause`);
    if (pc) pc.textContent = stats.pauseCount;
    if (lp) lp.textContent = `${stats.longestPauseSec}s`;
}

/** Pone el medidor en cero. */
function _resetVolumeMeter(prefix) {
    const bar = document.getElementById(`${prefix}-volume-bar`);
    if (bar) { bar.style.width = '0%'; bar.className = 'vu-bar vu-low'; }
}

/** Pone las stats de audio en cero en el DOM. */
function _resetAudioStats(prefix) {
    const pc = document.getElementById(`${prefix}-pause-count`);
    const lp = document.getElementById(`${prefix}-longest-pause`);
    const wpm = document.getElementById('words-per-minute');
    if (pc)  pc.textContent  = '0';
    if (lp)  lp.textContent  = '0s';
    if (wpm) wpm.textContent = '0';
}

