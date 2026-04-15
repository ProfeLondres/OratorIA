/**
 * app.js
 * Punto de entrada principal de OratorIA.
 * Importa todos los módulos, registra event listeners, carga los modelos
 * y establece los callbacks de comunicación entre trackers y UI.
 */

import { gazeTracker }    from './gazeTracker.js';
import { speechTracker }  from './speechTracker.js';

import { loadFaceApiModels }                         from './faceDetection.js';
import { initGazeChart, updateGazeChart,
         initFillerChart, updateFillerChart,
         initCombinedChart }                         from './charts.js';

import { startTracking, stopTracking,
         resetGazeStats }                            from './gaze.js';

import { startSpeechRecognition, stopSpeechRecognition,
         resetSpeechStats }                          from './speech.js';

import { startCombinedAnalysis, stopCombinedAnalysis,
         resetCombinedStats, isCombinedRunning,
         updateCombinedEvaluation }                  from './combined.js';

import { showTab, showNotification,
         updateLoadingProgress }                     from './ui.js';

import { formatTime } from './utils.js';

// ---- Estado de la aplicación ------------------------------------------
let modelsLoaded = false;
const speechRecognitionSupported =
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

// ---- Exponer showTab globalmente para los onclick del HTML ------------
window.showTab = showTab;

// ---- Callbacks de los trackers ----------------------------------------
// gazeTracker notifica cuando su historial cambia → actualizar gráfica
gazeTracker.onHistoryUpdate = () => updateGazeChart(gazeTracker.historyData);

// gazeTracker notifica cada actualización de UI → sincronizar panel combinado
gazeTracker.onCombinedUpdate = () => {
    if (!isCombinedRunning()) return;
    document.getElementById('combined-time').textContent    = formatTime(gazeTracker.totalTime);
    document.getElementById('combined-looking').textContent =
        `${Math.round(gazeTracker.getLookingPercentage())}%`;
    updateCombinedEvaluation();
};

// speechTracker notifica cambios en muletillas → actualizar gráfica de barras
speechTracker.onFillerChartUpdate = () => updateFillerChart(speechTracker.fillerWordsMap);

// speechTracker notifica cada actualización de UI → sincronizar panel combinado
speechTracker.onCombinedUpdate = () => {
    if (!isCombinedRunning()) return;
    document.getElementById('combined-filler-rate').textContent =
        speechTracker.getFillerRate().toFixed(1);
    updateCombinedEvaluation();
};

// ---- Inicialización ---------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {

    // -- Botones de seguimiento de mirada --
    document.getElementById('start-tracking')
        .addEventListener('click', () => startTracking(modelsLoaded));
    document.getElementById('stop-tracking')
        .addEventListener('click', stopTracking);
    document.getElementById('reset-stats')
        .addEventListener('click', resetGazeStats);

    // -- Botones de análisis de voz --
    document.getElementById('start-speech')
        .addEventListener('click', () => startSpeechRecognition(speechRecognitionSupported));
    document.getElementById('stop-speech')
        .addEventListener('click', stopSpeechRecognition);
    document.getElementById('reset-speech')
        .addEventListener('click', resetSpeechStats);

    // -- Botones de análisis combinado --
    document.getElementById('start-combined')
        .addEventListener('click', () => startCombinedAnalysis(modelsLoaded, speechRecognitionSupported));
    document.getElementById('stop-combined')
        .addEventListener('click', stopCombinedAnalysis);
    document.getElementById('reset-combined')
        .addEventListener('click', resetCombinedStats);

    // -- Ocultar instrucciones --
    document.getElementById('hide-instructions')
        .addEventListener('click', () => {
            document.getElementById('setup-instructions').style.display = 'none';
        });

    // -- Navegación por pestañas (data-tab en cada botón) --
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    // -- Carga de modelos de reconocimiento facial --
    try {
        await loadFaceApiModels((progress, total) =>
            updateLoadingProgress(progress, total)
        );

        document.getElementById('loading-models').style.display = 'none';
        showNotification('Modelos de reconocimiento facial cargados correctamente', 'success');

        // Inicializar gráficas
        initGazeChart(document.getElementById('gaze-chart'));
        initFillerChart(document.getElementById('filler-chart'));
        initCombinedChart(document.getElementById('combined-chart'));

        // Advertir si el navegador no soporta reconocimiento de voz
        if (!speechRecognitionSupported) {
            const msg = 'Tu navegador no soporta reconocimiento de voz. Recomendamos usar Chrome.';

            const speechStatus = document.getElementById('speech-status');
            speechStatus.textContent = msg;
            speechStatus.className   = 'status error';
            document.getElementById('start-speech').disabled = true;

            const combinedStatus = document.getElementById('combined-status');
            combinedStatus.textContent = msg;
            combinedStatus.className   = 'status error';
            document.getElementById('start-combined').disabled = true;
        }

        modelsLoaded = true;
    } catch (error) {
        console.error('Error al cargar modelos:', error);
        document.getElementById('loading-models').innerHTML = `
            <div class="status error">
                <strong>Error al cargar los modelos de reconocimiento facial</strong>
                <p>${error.message || 'Verifica tu conexión y que estés usando un servidor local.'}</p>
                <button onclick="location.reload()">Reintentar</button>
            </div>
        `;
    }
});
