/**
 * charts.js
 * Gestión de todas las gráficas de la aplicación usando Chart.js.
 * Las instancias se mantienen en este módulo para evitar referencias externas.
 */

let gazeChartInstance    = null;
let fillerChartInstance  = null;
let combinedChartInstance = null;

// ---- Gráfica de mirada (línea) ----------------------------------------

/**
 * Inicializa la gráfica de evolución del contacto visual.
 * @param {HTMLCanvasElement} canvas
 */
export function initGazeChart(canvas) {
    const ctx = canvas.getContext('2d');
    gazeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Porcentaje mirando a la cámara',
                data: [],
                borderColor: '#2ecc71',
                backgroundColor: 'rgba(46, 204, 113, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: 'Porcentaje (%)' }
                },
                x: { title: { display: true, text: 'Tiempo' } }
            }
        }
    });
}

/**
 * Actualiza la gráfica de mirada con los datos del historial.
 * @param {{ timestamps: number[], lookingPercentages: number[] }} historyData
 */
export function updateGazeChart(historyData) {
    if (!gazeChartInstance) return;

    gazeChartInstance.data.labels = historyData.timestamps.map(ts => {
        const d = new Date(ts);
        return [
            d.getHours().toString().padStart(2, '0'),
            d.getMinutes().toString().padStart(2, '0'),
            d.getSeconds().toString().padStart(2, '0')
        ].join(':');
    });

    gazeChartInstance.data.datasets[0].data = historyData.lookingPercentages;
    gazeChartInstance.update();
}

// ---- Gráfica de muletillas (barras) ------------------------------------

/**
 * Inicializa la gráfica de frecuencia de muletillas.
 * @param {HTMLCanvasElement} canvas
 */
export function initFillerChart(canvas) {
    const ctx = canvas.getContext('2d');
    fillerChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Frecuencia de muletillas',
                data: [],
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Frecuencia' }
                }
            }
        }
    });
}

/**
 * Actualiza la gráfica con las 5 muletillas más frecuentes.
 * @param {Object.<string, number>} fillerWordsMap
 */
export function updateFillerChart(fillerWordsMap) {
    if (!fillerChartInstance) return;

    const top5 = Object.entries(fillerWordsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    fillerChartInstance.data.labels              = top5.map(([word]) => word);
    fillerChartInstance.data.datasets[0].data    = top5.map(([, count]) => count);
    fillerChartInstance.update();
}

// ---- Gráfica combinada (doble eje) ------------------------------------

/**
 * Inicializa la gráfica de análisis combinado (contacto visual + muletillas).
 * @param {HTMLCanvasElement} canvas
 */
export function initCombinedChart(canvas) {
    const ctx = canvas.getContext('2d');
    combinedChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Contacto visual (%)',
                    data: [],
                    borderColor: '#2ecc71',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Muletillas por minuto',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    position: 'left',
                    title: { display: true, text: 'Contacto visual (%)' }
                },
                y1: {
                    beginAtZero: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    title: { display: true, text: 'Muletillas/min' }
                },
                x: { title: { display: true, text: 'Tiempo' } }
            }
        }
    });
}

/**
 * Agrega un punto al gráfico combinado (máximo 20 puntos).
 * @param {number} gazePercentage   Porcentaje de contacto visual actual
 * @param {number} fillerRate       Muletillas por minuto actuales
 */
export function updateCombinedChart(gazePercentage, fillerRate) {
    if (!combinedChartInstance) return;

    const now   = new Date();
    const label = [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
    ].join(':');

    combinedChartInstance.data.labels.push(label);
    combinedChartInstance.data.datasets[0].data.push(gazePercentage);
    combinedChartInstance.data.datasets[1].data.push(fillerRate);

    if (combinedChartInstance.data.labels.length > 20) {
        combinedChartInstance.data.labels.shift();
        combinedChartInstance.data.datasets[0].data.shift();
        combinedChartInstance.data.datasets[1].data.shift();
    }

    combinedChartInstance.update();
}

/** Limpia todos los datos de la gráfica combinada. */
export function resetCombinedChart() {
    if (!combinedChartInstance) return;
    combinedChartInstance.data.labels              = [];
    combinedChartInstance.data.datasets[0].data    = [];
    combinedChartInstance.data.datasets[1].data    = [];
    combinedChartInstance.update();
}
