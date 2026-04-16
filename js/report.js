/**
 * report.js
 * Genera un reporte imprimible (HTML → PDF) para una sesión de OratorIA.
 * El reporte se abre en una nueva pestaña y el usuario puede guardarlo
 * como PDF usando la función de impresión del navegador (Ctrl+P → PDF).
 */

import { formatTime } from './utils.js';
import { EMOTIONS }  from './expressionTracker.js';

// ---- API pública ---------------------------------------------------------

/**
 * Abre el reporte de una sesión en una nueva pestaña.
 * @param {Object} session  Objeto de sesión del sessionStore
 */
export function generateReport(session) {
    const html = _buildHTML(session);
    const win  = window.open('', '_blank');
    if (!win) {
        alert('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.');
        return;
    }
    win.document.write(html);
    win.document.close();
    win.onload = () => {
        win.focus();
        setTimeout(() => win.print(), 600);
    };
}

// ---- Cálculo de puntaje --------------------------------------------------

/**
 * Calcula el puntaje de la sesión en escala 1.0 – 5.0 (sistema colombiano).
 * @param {Object} session
 * @returns {{ score: number, label: string, color: string } | null}
 */
function _calcScore(session) {
    let points = 0;
    let maxPts = 0;

    // Contacto visual: 0-40 pts
    if (session.gazePercentage != null) {
        maxPts += 40;
        const g = session.gazePercentage;
        if      (g >= 70) points += 40;
        else if (g >= 50) points += 30;
        else if (g >= 30) points += 20;
        else if (g >= 10) points += 10;
    }

    // Muletillas: 0-30 pts
    if (session.fillerRate != null) {
        maxPts += 30;
        const f = session.fillerRate;
        if      (f <= 3)  points += 30;
        else if (f <= 8)  points += 20;
        else if (f <= 15) points += 10;
    }

    // Velocidad de habla: 0-15 pts (ideal 100-160 wpm)
    if (session.wordsPerMinute > 0) {
        maxPts += 15;
        const w = session.wordsPerMinute;
        if      (w >= 100 && w <= 160) points += 15;
        else if (w >= 80  && w <= 180) points += 10;
        else if (w > 0)                points += 5;
    }

    // Pausas: 0-15 pts
    if (session.pauseCount != null) {
        maxPts += 15;
        const p = session.pauseCount;
        if      (p <= 2) points += 15;
        else if (p <= 5) points += 10;
        else if (p <= 8) points += 5;
    }

    if (maxPts === 0) return null;

    const pct   = (points / maxPts) * 100;
    const grade = +(1 + (pct / 100) * 4).toFixed(1);  // escala 1.0 – 5.0

    let label, color;
    if      (grade >= 4.6) { label = 'Excelente';     color = '#27ae60'; }
    else if (grade >= 4.0) { label = 'Sobresaliente'; color = '#2ecc71'; }
    else if (grade >= 3.5) { label = 'Aceptable';     color = '#f39c12'; }
    else if (grade >= 3.0) { label = 'Insuficiente';  color = '#e67e22'; }
    else                   { label = 'Deficiente';    color = '#e74c3c'; }

    return { score: grade, pct: Math.round(pct), label, color };
}

// ---- Recomendaciones personalizadas --------------------------------------

function _recommendations(session) {
    const recs = [];

    if (session.gazePercentage != null) {
        if (session.gazePercentage < 30) {
            recs.push({ icon: '👁', text: 'Contacto visual muy bajo: Practica mirando al público mientras hablas. Elige 2-3 puntos focales en la sala y alterna entre ellos cada 5-7 segundos.' });
        } else if (session.gazePercentage < 55) {
            recs.push({ icon: '👁', text: 'Contacto visual moderado: Intenta mirar al público más del 60% del tiempo. Memoriza las ideas principales para no depender de tus notas.' });
        }
    }

    if (session.fillerRate != null) {
        if (session.fillerRate > 15) {
            recs.push({ icon: '🗣', text: 'Demasiadas muletillas: El exceso de "este", "ehm" o "o sea" distrae. Practica haciendo una pausa en silencio cada vez que sientas la necesidad de usar una muletilla.' });
        } else if (session.fillerRate > 8) {
            recs.push({ icon: '🗣', text: 'Uso elevado de muletillas: Grábate hablando y escucha tus muletillas más frecuentes. La consciencia es el primer paso para eliminarlas.' });
        } else if (session.fillerRate > 3) {
            recs.push({ icon: '🗣', text: 'Uso moderado de muletillas: Vas por buen camino. Continúa practicando para llegar a menos de 3 muletillas por minuto.' });
        }
    }

    if (session.wordsPerMinute > 0) {
        if (session.wordsPerMinute > 170) {
            recs.push({ icon: '⏱', text: `Velocidad alta (${session.wordsPerMinute} pal/min): Hablas demasiado rápido. Practica haciendo pausas conscientes después de cada idea clave. El ritmo ideal es 100-160 palabras por minuto.` });
        } else if (session.wordsPerMinute < 80) {
            recs.push({ icon: '⏱', text: `Velocidad baja (${session.wordsPerMinute} pal/min): Tu ritmo es lento. Practica el discurso varias veces para ganar fluidez y confianza.` });
        }
    }

    if (session.pauseCount > 5) {
        recs.push({ icon: '⏸', text: `${session.pauseCount} pausas largas detectadas: Prepara mejor el contenido para reducir los momentos de bloqueo. Las pausas breves son positivas, pero las largas sugieren falta de ensayo.` });
    }

    if (session.confidenceScore != null && session.confidenceScore < 40) {
        recs.push({ icon: '💪', text: `Índice de confianza bajo (${session.confidenceScore}%): El análisis facial detectó señales de nerviosismo frecuentes. Practica frente al espejo y con grabaciones para ganar seguridad en tu expresión.` });
    }

    if (recs.length === 0) {
        recs.push({ icon: '⭐', text: '¡Excelente desempeño! Mantén estos niveles y considera practicar en espacios más grandes para proyectar mejor tu voz y lenguaje corporal.' });
    }

    return recs;
}

// ---- Construcción del HTML del reporte -----------------------------------

function _buildHTML(s) {
    const score    = _calcScore(s);
    const recs     = _recommendations(s);
    const date     = new Date(s.id).toLocaleDateString('es-CO', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    const modeLabel = s.type === 'gaze' ? 'Seguimiento de Mirada'
                    : s.type === 'speech' ? 'Análisis de Voz'
                    : 'Análisis Combinado';

    const topFillersHTML = _topFillersHTML(s.topFillers);
    const gazeSection       = s.gazePercentage    != null ? _gazeSectionHTML(s)       : '';
    const speechSection     = s.fillerRate        != null ? _speechSectionHTML(s)     : '';
    const audioSection      = s.wordsPerMinute || s.pauseCount ? _audioSectionHTML(s) : '';
    const emotionSection    = s.expressionProfile ? _emotionSectionHTML(s)            : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte OratorIA — ${_esc(s.studentName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f4f6f8;
    color: #2c3e50;
    padding: 0;
  }
  .page {
    max-width: 800px;
    margin: 30px auto;
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  }

  /* --- Header --- */
  .report-header {
    background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
    color: white;
    padding: 28px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .report-header h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .report-header .subtitle { font-size: 13px; opacity: 0.8; margin-top: 4px; }
  .school-name { font-size: 13px; opacity: 0.75; text-align: right; }
  .school-name strong { font-size: 15px; opacity: 1; display: block; }

  /* --- Info del estudiante --- */
  .student-card {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0;
    border-bottom: 2px solid #f0f0f0;
  }
  .student-field {
    padding: 18px 24px;
    border-right: 1px solid #f0f0f0;
  }
  .student-field:last-child { border-right: none; }
  .field-label { font-size: 11px; text-transform: uppercase; color: #999; letter-spacing: 0.08em; }
  .field-value { font-size: 16px; font-weight: 700; margin-top: 4px; color: #2c3e50; }
  .field-value.small { font-size: 13px; }

  /* --- Score --- */
  .score-banner {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 20px 36px;
    background: #fafbfc;
    border-bottom: 2px solid #f0f0f0;
  }
  .score-circle {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 800;
    flex-shrink: 0;
  }
  .score-circle .grade { font-size: 28px; line-height: 1; }
  .score-circle .scale { font-size: 11px; opacity: 0.85; }
  .score-info h2 { font-size: 20px; }
  .score-info .score-label { font-size: 14px; color: #666; margin-top: 4px; }
  .score-bar-wrap { margin-top: 10px; height: 8px; background: #e8e8e8; border-radius: 4px; width: 300px; }
  .score-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }

  /* --- Secciones --- */
  .section {
    padding: 22px 36px;
    border-bottom: 1px solid #f0f0f0;
  }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #2c3e50;
    margin-bottom: 14px;
    padding-bottom: 6px;
    border-bottom: 2px solid #3498db;
    display: inline-block;
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .metric-card {
    background: #f7f9fc;
    border-radius: 8px;
    padding: 14px 16px;
  }
  .metric-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.06em; }
  .metric-value { font-size: 22px; font-weight: 800; color: #2c3e50; margin-top: 2px; }
  .metric-sub   { font-size: 11px; color: #aaa; margin-top: 2px; }

  /* --- Barra de progreso --- */
  .prog-wrap { margin: 14px 0 6px; }
  .prog-label { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px; }
  .prog-track { height: 12px; background: #e8e8e8; border-radius: 6px; overflow: hidden; }
  .prog-fill  { height: 100%; border-radius: 6px; }

  /* --- Muletillas top --- */
  .fillers-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .filler-chip {
    padding: 4px 12px;
    background: #fff3cd;
    color: #856404;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .filler-chip span { font-weight: 400; font-size: 11px; color: #b8960c; margin-left: 4px; }

  /* --- Recomendaciones --- */
  .rec-list { list-style: none; }
  .rec-list li {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f5f5f5;
    font-size: 13px;
    line-height: 1.6;
    color: #444;
  }
  .rec-list li:last-child { border-bottom: none; }
  .rec-icon { font-size: 20px; flex-shrink: 0; }

  /* --- Footer --- */
  .report-footer {
    background: #f7f9fc;
    padding: 14px 36px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #bbb;
  }

  /* --- Print --- */
  @media print {
    body { background: white; }
    .page {
      max-width: 100%;
      margin: 0;
      box-shadow: none;
      border-radius: 0;
    }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Encabezado -->
  <div class="report-header">
    <div>
      <h1>OratorIA</h1>
      <div class="subtitle">Reporte de Evaluación · ${modeLabel}</div>
    </div>
    <div class="school-name">
      <strong>Colegio Londres</strong>
      ${date}
    </div>
  </div>

  <!-- Info del estudiante -->
  <div class="student-card">
    <div class="student-field">
      <div class="field-label">Estudiante</div>
      <div class="field-value">${_esc(s.studentName)}</div>
    </div>
    <div class="student-field">
      <div class="field-label">Grado</div>
      <div class="field-value">${_esc(s.grade || '—')}</div>
    </div>
    <div class="student-field">
      <div class="field-label">Tema · Duración</div>
      <div class="field-value small">${_esc(s.topic || '—')}</div>
      <div class="field-label" style="margin-top:4px">${formatTime(s.duration || 0)}</div>
    </div>
  </div>

  ${score ? `
  <!-- Puntaje global -->
  <div class="score-banner">
    <div class="score-circle" style="background:${score.color}">
      <div class="grade">${score.score}</div>
      <div class="scale">/ 5.0</div>
    </div>
    <div class="score-info">
      <h2>${score.label}</h2>
      <div class="score-label">Puntaje general: ${score.pct}%</div>
      <div class="score-bar-wrap">
        <div class="score-bar-fill" style="width:${score.pct}%;background:${score.color}"></div>
      </div>
    </div>
  </div>` : ''}

  ${gazeSection}
  ${emotionSection}
  ${speechSection}
  ${topFillersHTML}
  ${audioSection}

  <!-- Recomendaciones -->
  <div class="section">
    <div class="section-title">📌 Recomendaciones Personalizadas</div>
    <ul class="rec-list">
      ${recs.map(r => `<li><span class="rec-icon">${r.icon}</span><span>${_esc(r.text)}</span></li>`).join('')}
    </ul>
  </div>

  <!-- Footer -->
  <div class="report-footer">
    <span>Generado por OratorIA · Colegio Londres</span>
    <span class="no-print">
      <button onclick="window.print()" style="
        background:#3498db;color:white;border:none;padding:8px 18px;
        border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">
        💾 Guardar como PDF
      </button>
    </span>
    <span>${new Date().toLocaleDateString('es-CO')}</span>
  </div>

</div>
</body>
</html>`;
}

// ---- Secciones del reporte -----------------------------------------------

function _gazeSectionHTML(s) {
    const pct     = Math.round(s.gazePercentage);
    const avoiding = 100 - pct;
    const color   = pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';

    return `
  <div class="section">
    <div class="section-title">👁 Contacto Visual</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Mirando a la cámara</div>
        <div class="metric-value" style="color:${color}">${pct}%</div>
        <div class="metric-sub">${formatTime((s.duration || 0) * (pct / 100))}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Evitando la mirada</div>
        <div class="metric-value" style="color:#e74c3c">${avoiding}%</div>
        <div class="metric-sub">${formatTime((s.duration || 0) * (avoiding / 100))}</div>
      </div>
    </div>
    <div class="prog-wrap">
      <div class="prog-label"><span>Contacto visual</span><span>${pct}%</span></div>
      <div class="prog-track">
        <div class="prog-fill" style="width:${pct}%;background:${color}"></div>
      </div>
    </div>
  </div>`;
}

function _speechSectionHTML(s) {
    const rate    = (s.fillerRate || 0).toFixed(1);
    const color   = s.fillerRate <= 3 ? '#27ae60'
                  : s.fillerRate <= 8 ? '#f39c12'
                  : s.fillerRate <= 15 ? '#e67e22' : '#e74c3c';
    const rateMax = Math.min(s.fillerRate || 0, 20);

    return `
  <div class="section">
    <div class="section-title">🗣 Análisis de Voz</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Muletillas / minuto</div>
        <div class="metric-value" style="color:${color}">${rate}</div>
        <div class="metric-sub">${s.fillerCount || 0} total detectadas</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total de palabras</div>
        <div class="metric-value">${s.totalWords || 0}</div>
      </div>
    </div>
    <div class="prog-wrap">
      <div class="prog-label"><span>Muletillas por minuto (máx. 20)</span><span>${rate}</span></div>
      <div class="prog-track">
        <div class="prog-fill" style="width:${(rateMax/20)*100}%;background:${color}"></div>
      </div>
    </div>
  </div>`;
}

function _topFillersHTML(topFillers) {
    if (!topFillers || topFillers.length === 0) return '';
    const chips = topFillers
        .map(([word, count]) => `<span class="filler-chip">${_esc(word)}<span>×${count}</span></span>`)
        .join('');
    return `
  <div class="section">
    <div class="section-title">🔖 Muletillas más frecuentes</div>
    <div class="fillers-list">${chips}</div>
  </div>`;
}

function _audioSectionHTML(s) {
    const wpm     = s.wordsPerMinute || 0;
    const wpmColor = (wpm >= 100 && wpm <= 160) ? '#27ae60'
                   : (wpm >= 80 && wpm <= 180)  ? '#f39c12' : '#e74c3c';
    const wpmPct   = Math.min(100, Math.round((wpm / 200) * 100));

    return `
  <div class="section">
    <div class="section-title">⏱ Métricas de Habla</div>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Velocidad de habla</div>
        <div class="metric-value" style="color:${wpmColor}">${wpm}</div>
        <div class="metric-sub">palabras por minuto</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Pausas largas (&gt;2s)</div>
        <div class="metric-value">${s.pauseCount ?? '—'}</div>
        <div class="metric-sub">Más larga: ${s.longestPauseSec ?? '—'}s</div>
      </div>
      ${s.avgVolume ? `
      <div class="metric-card">
        <div class="metric-label">Volumen promedio</div>
        <div class="metric-value">${s.avgVolume}%</div>
        <div class="metric-sub">Pico: ${s.peakVolume || '—'}%</div>
      </div>` : ''}
    </div>
    <div class="prog-wrap">
      <div class="prog-label">
        <span>Velocidad (ideal: 100-160 pal/min)</span>
        <span style="color:${wpmColor}">${wpm} pal/min</span>
      </div>
      <div class="prog-track">
        <div class="prog-fill" style="width:${wpmPct}%;background:${wpmColor}"></div>
      </div>
    </div>
  </div>`;
}

function _emotionSectionHTML(s) {
    const score      = s.confidenceScore ?? 0;
    const scoreColor = score >= 70 ? '#27ae60' : score >= 45 ? '#f39c12' : '#e74c3c';
    const dominant   = s.dominantExpression;
    const meta       = dominant ? (EMOTIONS[dominant] || EMOTIONS.neutral) : null;
    const profile    = s.expressionProfile || {};

    const sorted = Object.entries(profile).sort((a, b) => b[1] - a[1]);

    const bars = sorted.map(([expr, pct]) => {
        const em = EMOTIONS[expr] || { emoji: '❓', label: expr, color: '#aaa' };
        return `
            <div style="margin:6px 0;">
                <div style="display:flex;justify-content:space-between;font-size:12px;color:#666;margin-bottom:3px">
                    <span>${em.emoji} ${em.label}</span>
                    <span>${pct}%</span>
                </div>
                <div style="height:8px;background:#e8e8e8;border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${em.color};border-radius:4px"></div>
                </div>
            </div>`;
    }).join('');

    return `
  <div class="section">
    <div class="section-title">🧠 Análisis Emocional</div>
    <div class="metrics-grid" style="margin-bottom:16px">
      <div class="metric-card">
        <div class="metric-label">Índice de confianza</div>
        <div class="metric-value" style="color:${scoreColor}">${score}%</div>
        <div class="metric-sub">Estados positivos</div>
      </div>
      ${meta ? `
      <div class="metric-card">
        <div class="metric-label">Expresión predominante</div>
        <div class="metric-value" style="font-size:28px">${meta.emoji}</div>
        <div class="metric-sub">${meta.label}</div>
      </div>` : ''}
    </div>
    <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:8px">Distribución de expresiones</div>
    ${bars}
  </div>`;
}

// ---- Utils ---------------------------------------------------------------

function _esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
