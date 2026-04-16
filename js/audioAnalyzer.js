/**
 * audioAnalyzer.js
 * Análisis de audio en tiempo real usando la Web Audio API.
 *
 * Métricas que proporciona:
 *  - Nivel de volumen actual (0-100) en cada frame
 *  - Volumen promedio de la sesión
 *  - Volumen pico
 *  - Cantidad de pausas (silencio > PAUSE_MIN_MS ms)
 *  - Pausa más larga en segundos
 */

// ---- Configuración -------------------------------------------------------

/** RMS mínimo para considerar que hay voz (calibrado para micrófono típico) */
const SILENCE_THRESHOLD  = 0.012;

/** Duración mínima de silencio para contar como pausa (ms) */
const PAUSE_MIN_MS = 2000;

/** Factor de escala para mapear RMS → porcentaje visual */
const VOLUME_SCALE = 280;

// ---- Estado interno -------------------------------------------------------

let _audioCtx    = null;
let _analyser    = null;
let _source      = null;
let _rafId       = null;

// Stats acumuladas
let _samples     = 0;
let _volumeSum   = 0;
let _peakVolume  = 0;
let _pauseCount  = 0;
let _longestPauseSec = 0;

// Control de pausas
let _isSilent    = false;
let _silenceStart = null;

// ---- API pública ----------------------------------------------------------

/**
 * Inicia el análisis de audio sobre un MediaStream.
 * @param {MediaStream} stream           Stream de audio (micrófono)
 * @param {function}    onFrame          Callback(volumePct: number, isSilent: boolean) — ~60fps
 */
export function startAudioAnalysis(stream, onFrame) {
    stopAudioAnalysis(); // Limpiar sesión previa si existe
    resetAudioStats();

    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    _analyser = _audioCtx.createAnalyser();
    _analyser.fftSize                = 256;
    _analyser.smoothingTimeConstant  = 0.5;

    _source = _audioCtx.createMediaStreamSource(stream);
    _source.connect(_analyser);
    // NO conectar al destination para evitar feedback

    const dataArray = new Float32Array(_analyser.fftSize);

    const loop = () => {
        _rafId = requestAnimationFrame(loop);
        _analyser.getFloatTimeDomainData(dataArray);

        // Calcular RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms        = Math.sqrt(sum / dataArray.length);
        const volumePct  = Math.min(100, Math.round(rms * VOLUME_SCALE));
        const silentNow  = rms < SILENCE_THRESHOLD;

        // Acumular estadísticas de volumen
        _samples++;
        _volumeSum  += volumePct;
        if (volumePct > _peakVolume) _peakVolume = volumePct;

        // Detección de pausas
        const now = Date.now();

        if (silentNow && !_isSilent) {
            // Inicio de silencio
            _isSilent     = true;
            _silenceStart = now;
        } else if (!silentNow && _isSilent) {
            // Fin de silencio
            _isSilent = false;
            const durationMs  = now - _silenceStart;
            const durationSec = durationMs / 1000;
            if (durationMs >= PAUSE_MIN_MS) {
                _pauseCount++;
                if (durationSec > _longestPauseSec) _longestPauseSec = durationSec;
            }
            _silenceStart = null;
        }

        if (onFrame) onFrame(volumePct, silentNow);
    };

    loop();
}

/**
 * Detiene el análisis y libera recursos.
 * Cierra la pausa activa si la hubiera.
 */
export function stopAudioAnalysis() {
    if (_rafId) {
        cancelAnimationFrame(_rafId);
        _rafId = null;
    }

    // Cerrar pausa en curso
    if (_isSilent && _silenceStart !== null) {
        const durationMs  = Date.now() - _silenceStart;
        const durationSec = durationMs / 1000;
        if (durationMs >= PAUSE_MIN_MS) {
            _pauseCount++;
            if (durationSec > _longestPauseSec) _longestPauseSec = durationSec;
        }
        _isSilent     = false;
        _silenceStart = null;
    }

    if (_source) {
        try { _source.disconnect(); } catch (_) {}
        _source = null;
    }
    if (_audioCtx) {
        _audioCtx.close().catch(() => {});
        _audioCtx = null;
    }
    _analyser = null;
}

/**
 * Reinicia todos los contadores de estadísticas.
 */
export function resetAudioStats() {
    _samples      = 0;
    _volumeSum    = 0;
    _peakVolume   = 0;
    _pauseCount   = 0;
    _longestPauseSec = 0;
    _isSilent     = false;
    _silenceStart = null;
}

/**
 * Retorna las estadísticas acumuladas de la sesión.
 * @returns {{ avgVolume: number, peakVolume: number, pauseCount: number, longestPauseSec: number }}
 */
export function getAudioStats() {
    return {
        avgVolume:     _samples > 0 ? Math.round(_volumeSum / _samples) : 0,
        peakVolume:    _peakVolume,
        pauseCount:    _pauseCount,
        longestPauseSec: Math.round(_longestPauseSec * 10) / 10,
    };
}
