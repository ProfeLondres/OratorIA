/**
 * combined.js
 * Orquesta el análisis combinado: cámara + micrófono al mismo tiempo.
 * Expone también la función de evaluación global usada por los callbacks
 * de gazeTracker y speechTracker.
 */

import { gazeTracker }                           from './gazeTracker.js';
import { speechTracker }                         from './speechTracker.js';
import { expressionTracker }                     from './expressionTracker.js';
import { startFaceDetection, stopFaceDetection } from './faceDetection.js';
import { initSpeechRecognition, getRecognition } from './speech.js';
import { updateCombinedChart, resetCombinedChart } from './charts.js';
import { saveSession }                           from './sessionStore.js';
import { getCurrentProfile }                     from './studentProfile.js';
import { startAudioAnalysis, stopAudioAnalysis,
         getAudioStats, resetAudioStats }        from './audioAnalyzer.js';

let combinedStream         = null;
let combinedUpdateInterval = null;
let _isCombinedRunning     = false;

/** @returns {boolean} */
export function isCombinedRunning() {
    return _isCombinedRunning;
}

// ---- Ciclo de vida ----------------------------------------------------

/**
 * Solicita cámara + micrófono e inicia el análisis completo.
 * @param {boolean} modelsLoaded
 * @param {boolean} speechSupported
 */
export async function startCombinedAnalysis(modelsLoaded, speechSupported) {
    const combinedStatus = document.getElementById('combined-status');

    if (!modelsLoaded) {
        combinedStatus.textContent = 'Los modelos aún no han cargado. Por favor, espere.';
        combinedStatus.className   = 'status error';
        return;
    }

    try {
        // Solicitar cámara (+ micrófono solo si el navegador soporta speech)
        const mediaConstraints = speechSupported
            ? { audio: true, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } }
            : { audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } };

        combinedStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

        const combinedVideo  = document.getElementById('combined-video');
        const combinedCanvas = document.getElementById('combined-canvas');
        combinedVideo.srcObject = combinedStream;
        combinedVideo.muted     = true;

        combinedVideo.onloadedmetadata = () => {
            const w = combinedVideo.clientWidth;
            const h = combinedVideo.videoHeight / (combinedVideo.videoWidth / w);
            combinedCanvas.width  = w;
            combinedCanvas.height = h;
            startFaceDetection(combinedVideo, combinedCanvas);
        };

        // Reconocimiento de voz (solo si es soportado)
        if (speechSupported) {
            if (!getRecognition()) initSpeechRecognition();
            // Sobreescribir onend para que se reinicie mientras el modo
            // combinado esté activo (isSpeechRunning no aplica aquí)
            getRecognition().onend = () => {
                if (_isCombinedRunning) {
                    try { getRecognition().start(); } catch (_) {}
                }
            };
            getRecognition().start();
        }

        // Analizador de audio usando el stream (solo si hay audio)
        resetAudioStats();
        if (speechSupported) {
            startAudioAnalysis(combinedStream, (volumePct) => {
                _updateVolumeMeter(volumePct);
            });
        }

        // Reiniciar trackers
        gazeTracker.reset();
        gazeTracker.lastUpdateTime = Date.now();
        speechTracker.reset();
        speechTracker.start();
        expressionTracker.reset();

        // Actualizar datos cada segundo
        combinedUpdateInterval = setInterval(() => {
            speechTracker.updateTime();
            updateCombinedChart(
                gazeTracker.getLookingPercentage(),
                speechTracker.getFillerRate()
            );
            _updateAudioStats();
            const wpmEl = document.getElementById('combined-wpm');
            if (wpmEl) wpmEl.textContent = speechTracker.getWordsPerMinute();
        }, 1000);

        document.getElementById('start-combined').disabled = true;
        document.getElementById('stop-combined').disabled  = false;

        combinedStatus.textContent = speechSupported
            ? 'Análisis combinado iniciado. Comience su presentación...'
            : 'Análisis de mirada y expresiones iniciado (sin reconocimiento de voz).';
        combinedStatus.className = 'status success';

        _isCombinedRunning = true;
    } catch (err) {
        combinedStatus.textContent =
            `Error al iniciar análisis: ${err.message}. Verifique permisos de cámara.`;
        combinedStatus.className = 'status error';
    }
}

/** Detiene todos los streams y análisis del modo combinado. */
export function stopCombinedAnalysis() {
    if (!combinedStream) return;

    // Marcar como detenido ANTES de rec.stop() para que onend no reinicie
    _isCombinedRunning = false;

    combinedStream.getTracks().forEach(t => t.stop());
    combinedStream = null;

    const combinedVideo  = document.getElementById('combined-video');
    const combinedCanvas = document.getElementById('combined-canvas');
    combinedVideo.srcObject = null;

    const rec = getRecognition();
    if (rec) { try { rec.stop(); } catch (_) {} }

    clearInterval(combinedUpdateInterval);
    stopFaceDetection(combinedCanvas);

    // Forzar borrado completo del canvas
    combinedCanvas.width = combinedCanvas.width;
    stopAudioAnalysis();

    speechTracker.stop();
    gazeTracker.update(gazeTracker.isLooking);
    gazeTracker.lastUpdateTime = null;

    _updateAudioStats();
    _resetVolumeMeter();

    document.getElementById('start-combined').disabled = false;
    document.getElementById('stop-combined').disabled  = true;

    const combinedStatus = document.getElementById('combined-status');
    combinedStatus.textContent = 'Análisis combinado detenido.';
    combinedStatus.className   = 'status';

    // Guardar sesión si hubo datos suficientes
    const profile  = getCurrentProfile();
    const duration = Math.max(gazeTracker.totalTime, speechTracker.totalTime);
    if (profile && duration >= 5) {
        const evalEl   = document.getElementById('combined-evaluation');
        const evalText = evalEl ? evalEl.textContent.replace('Evaluación: ', '') : null;
        const audio    = getAudioStats();
        const topFillers = Object.entries(speechTracker.fillerWordsMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
        saveSession({
            studentName:        profile.name,
            grade:              profile.grade,
            topic:              profile.topic,
            type:               'combined',
            duration,
            gazePercentage:     gazeTracker.getLookingPercentage(),
            fillerRate:         speechTracker.getFillerRate(),
            fillerCount:        speechTracker.fillerWords,
            totalWords:         speechTracker.totalWords,
            wordsPerMinute:     speechTracker.getWordsPerMinute(),
            avgVolume:          audio.avgVolume,
            peakVolume:         audio.peakVolume,
            pauseCount:         audio.pauseCount,
            longestPauseSec:    audio.longestPauseSec,
            topFillers,
            dominantExpression: expressionTracker.getDominantExpression(),
            confidenceScore:    expressionTracker.getConfidenceScore(),
            expressionProfile:  expressionTracker.getProfile(),
            evaluation:         evalText,
        });
    }
}

/** Reinicia todas las estadísticas y la gráfica combinada. */
export function resetCombinedStats() {
    gazeTracker.reset();
    speechTracker.reset();
    resetAudioStats();
    resetCombinedChart();
    expressionTracker.reset();
    _resetVolumeMeter();

    const els = {
        'combined-pause-count':   '0',
        'combined-longest-pause': '0s',
        'combined-wpm':           '0',
    };
    for (const [id, val] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    const combinedStatus = document.getElementById('combined-status');
    combinedStatus.textContent = 'Estadísticas reiniciadas.';
    combinedStatus.className   = 'status';
}

// ---- Evaluación global ------------------------------------------------

export function updateCombinedEvaluation() {
    const lookingPct = gazeTracker.getLookingPercentage();
    const fillerRate = speechTracker.getFillerRate();
    const el         = document.getElementById('combined-evaluation');

    if (gazeTracker.totalTime < 10 || speechTracker.totalTime < 10) {
        el.textContent = 'Evaluación: No hay datos suficientes';
        el.className   = 'status center';
        return;
    }

    let eyeEval;
    if      (lookingPct >= 70) eyeEval = 'excelente contacto visual';
    else if (lookingPct >= 50) eyeEval = 'buen contacto visual';
    else if (lookingPct >= 30) eyeEval = 'contacto visual moderado';
    else                       eyeEval = 'contacto visual insuficiente';

    let fillerEval;
    if      (fillerRate <= 3)  fillerEval = 'uso mínimo de muletillas';
    else if (fillerRate <= 8)  fillerEval = 'uso moderado de muletillas';
    else if (fillerRate <= 15) fillerEval = 'uso elevado de muletillas';
    else                       fillerEval = 'uso excesivo de muletillas';

    let cssClass;
    if (lookingPct >= 60 && fillerRate <= 5) {
        el.textContent = `Evaluación: Excelente presentación (${eyeEval}, ${fillerEval})`;
        cssClass = 'success';
    } else if (lookingPct >= 40 && fillerRate <= 10) {
        el.textContent = `Evaluación: Buena presentación (${eyeEval}, ${fillerEval})`;
        cssClass = 'success';
    } else if (lookingPct >= 30 && fillerRate <= 15) {
        el.textContent = `Evaluación: Presentación aceptable (${eyeEval}, ${fillerEval})`;
        cssClass = 'warning';
    } else {
        el.textContent = `Evaluación: Necesita mejorar (${eyeEval}, ${fillerEval})`;
        cssClass = 'error';
    }

    el.className = `status center ${cssClass}`;
}

// ---- Helpers de UI (audio) locales ------------------------------------

function _updateVolumeMeter(volumePct) {
    const bar = document.getElementById('combined-volume-bar');
    if (!bar) return;
    bar.style.width = `${volumePct}%`;
    bar.className   = volumePct < 30 ? 'vu-bar vu-low'
                    : volumePct < 65 ? 'vu-bar vu-mid'
                    : 'vu-bar vu-high';
}

function _resetVolumeMeter() {
    const bar = document.getElementById('combined-volume-bar');
    if (bar) { bar.style.width = '0%'; bar.className = 'vu-bar vu-low'; }
}

function _updateAudioStats() {
    const stats = getAudioStats();
    const pc = document.getElementById('combined-pause-count');
    const lp = document.getElementById('combined-longest-pause');
    if (pc) pc.textContent = stats.pauseCount;
    if (lp) lp.textContent = `${stats.longestPauseSec}s`;
}
