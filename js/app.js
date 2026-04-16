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

import { formatTime }                                from './utils.js';

import { showProfileModal, updateStudentBar }        from './studentProfile.js';
import { initHistory, renderHistory }                from './history.js';

// ---- Estado de la aplicación ------------------------------------------
let modelsLoaded = false;
const speechRecognitionSupported =
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

// ---- Exponer showTab globalmente para los onclick del HTML ------------
window.showTab = showTab;

// ---- Callbacks de los trackers ----------------------------------------
gazeTracker.onHistoryUpdate = () => updateGazeChart(gazeTracker.historyData);

gazeTracker.onCombinedUpdate = () => {
    if (!isCombinedRunning()) return;
    document.getElementById('combined-time').textContent    = formatTime(gazeTracker.totalTime);
    document.getElementById('combined-looking').textContent =
        `${Math.round(gazeTracker.getLookingPercentage())}%`;
    updateCombinedEvaluation();
};

speechTracker.onFillerChartUpdate = () => updateFillerChart(speechTracker.fillerWordsMap);

speechTracker.onCombinedUpdate = () => {
    if (!isCombinedRunning()) return;
    document.getElementById('combined-filler-rate').textContent =
        speechTracker.getFillerRate().toFixed(1);
    updateCombinedEvaluation();
};

// ---- Inicialización ---------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {

    // -- Botones de seguimiento de mirada --
    document.getElementById('start-tracking').addEventListener('click', () => {
        showProfileModal(profile => {
            updateStudentBar(profile);
            startTracking(modelsLoaded);
        });
    });
    document.getElementById('stop-tracking').addEventListener('click', () => {
        stopTracking();
        updateStudentBar(null);
    });
    document.getElementById('reset-stats').addEventListener('click', resetGazeStats);

    // -- Botones de análisis de voz --
    document.getElementById('start-speech').addEventListener('click', () => {
        showProfileModal(profile => {
            updateStudentBar(profile);
            startSpeechRecognition(speechRecognitionSupported);
        });
    });
    document.getElementById('stop-speech').addEventListener('click', () => {
        stopSpeechRecognition();
        updateStudentBar(null);
    });
    document.getElementById('reset-speech').addEventListener('click', resetSpeechStats);

    // -- Botones de análisis combinado --
    document.getElementById('start-combined').addEventListener('click', () => {
        showProfileModal(profile => {
            updateStudentBar(profile);
            startCombinedAnalysis(modelsLoaded, speechRecognitionSupported);
        });
    });
    document.getElementById('stop-combined').addEventListener('click', () => {
        stopCombinedAnalysis();
        updateStudentBar(null);
    });
    document.getElementById('reset-combined').addEventListener('click', resetCombinedStats);

    // -- Ocultar instrucciones --
    document.getElementById('hide-instructions')
        .addEventListener('click', () => {
            document.getElementById('setup-instructions').style.display = 'none';
        });

    // -- Navegación por pestañas --
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => {
            showTab(btn.dataset.tab);
            // Refrescar historial cuando se abre esa pestaña
            if (btn.dataset.tab === 'history') {
                const filter = document.getElementById('history-filter').value;
                renderHistory(filter);
            }
        });
    });

    // -- Inicializar historial --
    initHistory();

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
