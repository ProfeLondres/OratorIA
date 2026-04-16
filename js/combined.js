/**
 * combined.js
 * Orquesta el análisis combinado: cámara + micrófono al mismo tiempo.
 * Expone también la función de evaluación global usada por los callbacks
 * de gazeTracker y speechTracker.
 */

import { gazeTracker }                           from './gazeTracker.js';
import { speechTracker }                         from './speechTracker.js';
import { startFaceDetection, stopFaceDetection } from './faceDetection.js';
import { initSpeechRecognition, getRecognition,
         _updateVolumeMeter, _updateAudioStats,
         _resetVolumeMeter, _resetAudioStats }   from './speech.js';
import { updateCombinedChart, resetCombinedChart } from './charts.js';
import { formatTime }                            from './utils.js';
import { saveSession }                           from './sessionStore.js';
import { getCurrentProfile }                     from './studentProfile.js';
import { startAudioAnalysis, stopAudioAnalysis,
         getAudioStats, resetAudioStats }        from './audioAnalyzer.js';

let combinedStream        = null;
let combinedUpdateInterval = null;

// Variable mutable exportada como getter para que los bindings de ES Modules
// reflejen siempre el valor actual en los módulos importadores.
let _isCombinedRunning = false;

/** @returns {boolean} */
export function isCombinedRunning() {
    return _isCombinedRunning;
}

// ---- Ciclo de vida ----------------------------------------------------

/**
 * Solicita cámara + micrófono e inicia el análisis completo.
 * @param {boolean} modelsLoaded
 * @param {boolean} speechRecognitionSupported
 */
export async function startCombinedAnalysis(modelsLoaded, speechRecognitionSupported) {
    const combinedStatus = document.getElementById('combined-status');

    if (!modelsLoaded) {
        combinedStatus.textContent = 'Los modelos aún no han cargado. Por favor, espere.';
        combinedStatus.className   = 'status error';
        return;
    }

    if (!speechRecognitionSupported) {
        combinedStatus.textContent = 'Tu navegador no soporta reconocimiento de voz. Usa Chrome.';
        combinedStatus.className   = 'status error';
        return;
    }

    try {
        combinedStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });

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

        // Reconocimiento de voz
        if (!getRecognition()) initSpeechRecognition();
        getRecognition().start();

        // Analizador de audio usando el mismo stream de combinedStream
        resetAudioStats();
        startAudioAnalysis(combinedStream, (volumePct, isSilent) => {
            _updateVolumeMeter(volumePct, isSilent, 'combined');
        });

        // Reiniciar trackers
        gazeTracker.reset();
        gazeTracker.lastUpdateTime = Date.now();
        speechTracker.reset();
        speechTracker.start();

        // Actualizar datos cada segundo
        combinedUpdateInterval = setInterval(() => {
            speechTracker.updateTime();
            updateCombinedChart(
                gazeTracker.getLookingPercentage(),
                speechTracker.getFillerRate()
            );
            _updateAudioStats('combined');
            // Sincronizar WPM al panel combinado
            const wpmEl = document.getElementById('combined-wpm');
            if (wpmEl) wpmEl.textContent = speechTracker.getWordsPerMinute();
        }, 1000);

        document.getElementById('start-combined').disabled = true;
        document.getElementById('stop-combined').disabled  = false;
        combinedStatus.textContent = 'Análisis combinado iniciado. Comience su presentación...';
        combinedStatus.className   = 'status success';

        _isCombinedRunning = true;
    } catch (err) {
        combinedStatus.textContent =
            `Error al iniciar análisis: ${err.message}. Verifique permisos de cámara y micrófono.`;
        combinedStatus.className = 'status error';
    }
}

/** Detiene todos los streams y análisis del modo combinado. */
export function stopCombinedAnalysis() {
    if (!combinedStream) return;

    combinedStream.getTracks().forEach(t => t.stop());
    combinedStream = null;

    const combinedVideo  = document.getElementById('combined-video');
    const combinedCanvas = document.getElementById('combined-canvas');
    combinedVideo.srcObject = null;

    const rec = getRecognition();
    if (rec) rec.stop();

    clearInterval(combinedUpdateInterval);
    stopFaceDetection(combinedCanvas);
    stopAudioAnalysis();

    speechTracker.stop();
    gazeTracker.update(gazeTracker.isLooking);
    gazeTracker.lastUpdateTime = null;

    // Mostrar stats finales y resetear medidores
    _updateAudioStats('combined');
    _resetVolumeMeter('combined');

    document.getElementById('start-combined').disabled = false;
    document.getElementById('stop-combined').disabled  = true;

    const combinedStatus = document.getElementById('combined-status');
    combinedStatus.textContent = 'Análisis combinado detenido.';
    combinedStatus.className   = 'status';

    _isCombinedRunning = false;

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
            studentName:     profile.name,
            grade:           profile.grade,
            topic:           profile.topic,
            type:            'combined',
            duration,
            gazePercentage:  gazeTracker.getLookingPercentage(),
            fillerRate:      speechTracker.getFillerRate(),
            fillerCount:     speechTracker.fillerWords,
            totalWords:      speechTracker.totalWords,
            wordsPerMinute:  speechTracker.getWordsPerMinute(),
            avgVolume:       audio.avgVolume,
            peakVolume:      audio.peakVolume,
            pauseCount:      audio.pauseCount,
            longestPauseSec: audio.longestPauseSec,
            topFillers,
            evaluation:      evalText,
        });
    }
}

/** Reinicia todas las estadísticas y la gráfica combinada. */
export function resetCombinedStats() {
    gazeTracker.reset();
    speechTracker.reset();
    resetAudioStats();
    resetCombinedChart();
    _resetVolumeMeter('combined');
    _resetAudioStats('combined');

    const wpmEl = document.getElementById('combined-wpm');
    if (wpmEl) wpmEl.textContent = '0';

    const combinedStatus = document.getElementById('combined-status');
    combinedStatus.textContent = 'Estadísticas reiniciadas.';
    combinedStatus.className   = 'status';
}

// ---- Evaluación global ------------------------------------------------

/**
 * Actualiza el panel de evaluación combinada según los datos actuales.
 * Solo actúa cuando hay más de 10 segundos de datos en ambos trackers.
 */
export function updateCombinedEvaluation() {
    const lookingPct = gazeTracker.getLookingPercentage();
    const fillerRate = speechTracker.getFillerRate();
    const el         = document.getElementById('combined-evaluation');

    if (gazeTracker.totalTime < 10 || speechTracker.totalTime < 10) {
        el.textContent = 'Evaluación: No hay datos suficientes';
        el.className   = 'status center';
        return;
    }

    // Evaluación de contacto visual
    let eyeEval;
    if      (lookingPct >= 70) eyeEval = 'excelente contacto visual';
    else if (lookingPct >= 50) eyeEval = 'buen contacto visual';
    else if (lookingPct >= 30) eyeEval = 'contacto visual moderado';
    else                       eyeEval = 'contacto visual insuficiente';

    // Evaluación de muletillas
    let fillerEval;
    if      (fillerRate <= 3)  fillerEval = 'uso mínimo de muletillas';
    else if (fillerRate <= 8)  fillerEval = 'uso moderado de muletillas';
    else if (fillerRate <= 15) fillerEval = 'uso elevado de muletillas';
    else                       fillerEval = 'uso excesivo de muletillas';

    // Evaluación global
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
