/**
 * utils.js
 * Funciones auxiliares reutilizables en toda la aplicación.
 */

/**
 * Formatea segundos en HH:MM:SS.
 * @param {number} timeInSeconds
 * @returns {string}
 */
export function formatTime(timeInSeconds) {
    const hours   = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    return [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0')
    ].join(':');
}

/**
 * Calcula el centro geométrico de un conjunto de puntos {x, y}.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ x: number, y: number }}
 */
export function calculateCenter(points) {
    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < points.length; i++) {
        sumX += points[i].x;
        sumY += points[i].y;
    }

    return {
        x: sumX / points.length,
        y: sumY / points.length
    };
}

/**
 * Calcula la relación de aspecto del ojo (Eye Aspect Ratio).
 * Un valor bajo indica que el ojo está más cerrado.
 * @param {{ x: number, y: number }[]} eye  Array de 6 puntos del ojo
 * @returns {number}
 */
export function calculateEAR(eye) {
    const height1 = Math.sqrt(
        Math.pow(eye[1].x - eye[5].x, 2) +
        Math.pow(eye[1].y - eye[5].y, 2)
    );
    const height2 = Math.sqrt(
        Math.pow(eye[2].x - eye[4].x, 2) +
        Math.pow(eye[2].y - eye[4].y, 2)
    );
    const width = Math.sqrt(
        Math.pow(eye[0].x - eye[3].x, 2) +
        Math.pow(eye[0].y - eye[3].y, 2)
    );

    return (height1 + height2) / (2 * width);
}
