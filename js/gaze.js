/**
 * gaze.js
 * Controla el ciclo de vida del seguimiento de mirada:
 * iniciar cámara → detección facial → detener → reiniciar estadísticas.
 */

import { gazeTracker }                           from './gazeTracker.js';
import { startFaceDetection, stopFaceDetection } from './faceDetection.js';
import { updateGazeChart }                       from './charts.js';
import { saveSession }                           from './sessionStore.js';
import { getCurrentProfile }                     from './studentProfile.js';
import { expressionTracker }                     from './expressionTracker.js';

let videoStream = null;

/**
 * Solicita acceso a la cámara e inicia la detección facial.
 * @param {boolean} modelsLoaded  Indica si los modelos ya terminaron de cargar.
 */
export async function startTracking(modelsLoaded) {
    const trackingStatus = document.getElementById('tracking-status');

    if (!modelsLoaded) {
        trackingStatus.textContent = 'Los modelos aún no han cargado. Por favor, espere.';
        trackingStatus.className   = 'status error';
        return;
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });

        const video         = document.getElementById('video');
        const overlayCanvas = document.getElementById('overlay-canvas');
        video.srcObject     = videoStream;

        video.onloadedmetadata = () => {
            const w = video.clientWidth;
            const h = video.videoHeight / (video.videoWidth / w);
            overlayCanvas.width  = w;
            overlayCanvas.height = h;
            startFaceDetection(video, overlayCanvas);
        };

        document.getElementById('start-tracking').disabled = true;
        document.getElementById('stop-tracking').disabled  = false;
        trackingStatus.textContent = 'Seguimiento iniciado. Analizando dirección de mirada...';
        trackingStatus.className   = 'status';

        gazeTracker.lastUpdateTime = Date.now();
        expressionTracker.reset();
    } catch (err) {
        trackingStatus.textContent = `Error al acceder a la cámara: ${err.message}. Conceda permisos de cámara.`;
        trackingStatus.className   = 'status error';
    }
}

/** Detiene la cámara y la detección facial. */
export function stopTracking() {
    if (!videoStream) return;

    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;

    const video         = document.getElementById('video');
    const overlayCanvas = document.getElementById('overlay-canvas');
    video.srcObject     = null;

    stopFaceDetection(overlayCanvas);

    // Forzar borrado completo del canvas
    overlayCanvas.width = overlayCanvas.width;

    document.getElementById('start-tracking').disabled = false;
    document.getElementById('stop-tracking').disabled  = true;

    const trackingStatus = document.getElementById('tracking-status');
    trackingStatus.textContent = 'Seguimiento detenido.';
    trackingStatus.className   = 'status';

    gazeTracker.update(gazeTracker.isLooking);
    gazeTracker.lastUpdateTime = null;

    // Guardar sesión si hubo datos suficientes
    const profile = getCurrentProfile();
    if (profile && gazeTracker.totalTime >= 5) {
        saveSession({
            studentName:       profile.name,
            grade:             profile.grade,
            topic:             profile.topic,
            type:              'gaze',
            duration:          gazeTracker.totalTime,
            gazePercentage:    gazeTracker.getLookingPercentage(),
            fillerRate:        null,
            fillerCount:       null,
            totalWords:        null,
            dominantExpression: expressionTracker.getDominantExpression(),
            confidenceScore:   expressionTracker.getConfidenceScore(),
            expressionProfile: expressionTracker.getProfile(),
            evaluation:        _gazeEvaluation(gazeTracker.getLookingPercentage()),
        });
    }
}

/** Retorna texto de evaluación según porcentaje de contacto visual. */
function _gazeEvaluation(pct) {
    if (pct >= 70) return 'Excelente contacto visual';
    if (pct >= 50) return 'Buen contacto visual';
    if (pct >= 30) return 'Contacto visual moderado';
    return 'Contacto visual insuficiente';
}

/** Reinicia todas las estadísticas de mirada. */
export function resetGazeStats() {
    gazeTracker.reset();
    updateGazeChart(gazeTracker.historyData);

    const trackingStatus = document.getElementById('tracking-status');
    trackingStatus.textContent = 'Estadísticas reiniciadas.';
    trackingStatus.className   = 'status';
}
