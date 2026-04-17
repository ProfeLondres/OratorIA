/**
 * faceDetection.js
 * Carga de modelos de face-api.js, detección facial en tiempo real,
 * análisis de dirección de mirada y detección de expresiones faciales.
 */

import { MODEL_URL, TOTAL_MODELS } from './config.js';
import { calculateCenter }         from './utils.js';
import { gazeTracker }             from './gazeTracker.js';
import { expressionTracker }       from './expressionTracker.js';

let faceDetectionInterval  = null;
let expressionModelLoaded  = false;

// ---- Carga de modelos -------------------------------------------------

/**
 * Descarga los modelos necesarios de face-api.js.
 * faceExpressionNet es opcional: si falla, el sistema continúa sin expresiones.
 * @param {(progress: number, total: number) => void} [onProgress]
 */
export async function loadFaceApiModels(onProgress) {
    let loaded = 0;

    const tick = () => {
        loaded++;
        if (onProgress) onProgress(loaded, TOTAL_MODELS);
    };

    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL).then(tick);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL).then(tick);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL).then(tick);

    try {
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        expressionModelLoaded = true;
    } catch (err) {
        console.warn('faceExpressionNet no pudo cargarse; las expresiones estarán deshabilitadas.', err);
    } finally {
        tick(); // siempre avanzar el progreso al 100%
    }
}

// ---- Detección facial en tiempo real ----------------------------------

/**
 * Inicia un bucle de detección facial a 10 FPS sobre un elemento de video.
 * Detecta dirección de mirada Y expresiones faciales.
 *
 * @param {HTMLVideoElement}  videoElement
 * @param {HTMLCanvasElement} canvasElement
 */
export function startFaceDetection(videoElement, canvasElement) {
    if (faceDetectionInterval) clearInterval(faceDetectionInterval);

    faceDetectionInterval = setInterval(async () => {
        if (!videoElement.srcObject) {
            clearInterval(faceDetectionInterval);
            return;
        }

        try {
            const options = new faceapi.SsdMobilenetv1Options({
                minConfidence: 0.5,
                maxResults: 1
            });

            const detection = faceapi
                .detectAllFaces(videoElement, options)
                .withFaceLandmarks();

            const results = await (expressionModelLoaded
                ? detection.withFaceExpressions()
                : detection);

            const ctx = canvasElement.getContext('2d');
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            const displaySize = { width: canvasElement.width, height: canvasElement.height };
            const resized     = faceapi.resizeResults(results, displaySize);

            if (resized.length > 0) {
                const face      = resized[0];
                const isLooking = analyzeGazeDirection(face.landmarks);

                // Actualizar tracker de mirada
                gazeTracker.update(isLooking);

                // Actualizar tracker de expresiones (solo si el modelo cargó)
                if (expressionModelLoaded && face.expressions) {
                    expressionTracker.update(face.expressions);
                }

                // Dibujar landmarks y bounding box
                faceapi.draw.drawFaceLandmarks(canvasElement, face);
                _drawGazeBox(ctx, face.detection.box, isLooking);

            } else {
                const el = document.getElementById('current-state');
                if (el) {
                    el.textContent = 'Estado: No detectado';
                    el.className   = 'status center';
                }
                expressionTracker.updateUI(null);
            }
        } catch (err) {
            console.error('Error en detección facial:', err);
        }
    }, 100); // ~10 FPS
}

/**
 * Detiene el bucle de detección y limpia el canvas.
 * @param {HTMLCanvasElement} [canvasElement]
 */
export function stopFaceDetection(canvasElement) {
    if (faceDetectionInterval) {
        clearInterval(faceDetectionInterval);
        faceDetectionInterval = null;
    }
    if (canvasElement) {
        canvasElement.getContext('2d')
            .clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
}

// ---- Análisis de dirección de mirada ----------------------------------

/**
 * Determina si el orador está mirando a la cámara basándose en landmarks.
 * @param {faceapi.FaceLandmarks68} landmarks
 * @returns {boolean}
 */
export function analyzeGazeDirection(landmarks) {
    if (!landmarks) return false;

    const leftEye  = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose     = landmarks.getNose();

    const leftCenter  = calculateCenter(leftEye);
    const rightCenter = calculateCenter(rightEye);
    const noseCenter  = calculateCenter(nose);

    const eyeDistance = Math.sqrt(
        Math.pow(rightCenter.x - leftCenter.x, 2) +
        Math.pow(rightCenter.y - leftCenter.y, 2)
    );

    const verticalDiff  = Math.abs(leftCenter.y - rightCenter.y);
    const isSymmetrical = verticalDiff < (eyeDistance * 0.1);

    const midEyeY  = (leftCenter.y + rightCenter.y) / 2;
    const vertGaze = midEyeY - noseCenter.y;

    return isSymmetrical && vertGaze < -5 && eyeDistance > 30;
}

// ---- Helpers privados -------------------------------------------------

function _drawGazeBox(ctx, box, isLooking) {
    const color = isLooking ? '#2ecc71' : '#e74c3c';
    const fill  = isLooking ? 'rgba(46, 204, 113, 0.7)' : 'rgba(231, 76, 60, 0.7)';
    const label = isLooking ? 'Mirando' : 'Evitando';

    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    ctx.fillStyle = fill;
    ctx.fillRect(box.x, box.y - 30, box.width, 30);

    ctx.fillStyle = '#fff';
    ctx.font      = '16px Arial';
    ctx.fillText(label, box.x + 5, box.y - 10);
}
