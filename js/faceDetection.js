/**
 * faceDetection.js
 * Carga de modelos de face-api.js, detección facial en tiempo real
 * y análisis de dirección de mirada mediante landmarks.
 */

import { MODEL_URL, TOTAL_MODELS } from './config.js';
import { calculateCenter, calculateEAR } from './utils.js';
import { gazeTracker } from './gazeTracker.js';

let faceDetectionInterval = null;

// ---- Carga de modelos -------------------------------------------------

/**
 * Descarga los tres modelos necesarios de face-api.js.
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
}

// ---- Detección facial en tiempo real ----------------------------------

/**
 * Inicia un bucle de detección facial a 10 FPS sobre un elemento de video.
 * Dibuja los resultados en el canvas superpuesto y actualiza gazeTracker.
 *
 * @param {HTMLVideoElement}  videoElement
 * @param {HTMLCanvasElement} canvasElement
 */
export function startFaceDetection(videoElement, canvasElement) {
    // Reemplaza cualquier bucle anterior
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

            const results = await faceapi
                .detectAllFaces(videoElement, options)
                .withFaceLandmarks();

            const ctx = canvasElement.getContext('2d');
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            const displaySize  = { width: canvasElement.width, height: canvasElement.height };
            const resized      = faceapi.resizeResults(results, displaySize);

            if (resized.length > 0) {
                const face             = resized[0];
                const isLooking        = analyzeGazeDirection(face.landmarks);

                // Dibuja landmarks y bounding box
                faceapi.draw.drawFaceLandmarks(canvasElement, face);
                _drawGazeBox(ctx, face.detection.box, isLooking);

                gazeTracker.update(isLooking);
            } else {
                const el = document.getElementById('current-state');
                el.textContent = 'Estado: No detectado';
                el.className   = 'status center';
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

    // Los ojos deben estar aproximadamente a la misma altura (simetría)
    const verticalDiff  = Math.abs(leftCenter.y - rightCenter.y);
    const isSymmetrical = verticalDiff < (eyeDistance * 0.1);

    // Los ojos deben estar por encima de la nariz (mirada al frente)
    const midEyeY    = (leftCenter.y + rightCenter.y) / 2;
    const vertGaze   = midEyeY - noseCenter.y;

    // EAR calculado (disponible para extensiones futuras)
    // const avgEAR = (calculateEAR(leftEye) + calculateEAR(rightEye)) / 2;

    return isSymmetrical && vertGaze < -5 && eyeDistance > 30;
}

// ---- Helpers privados -------------------------------------------------

/**
 * Dibuja el rectángulo de color y la etiqueta de estado sobre el canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {boolean} isLooking
 */
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
