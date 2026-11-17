// ═══════════════════════════════════════════════════════════════════
//  SIMULACIÓN: GRÁFICAS DEL MOVIMIENTO (MRU y MRUA)
//  Física y Química para la ESO
//
//  Un móvil (coche o persona) recorre una pista recta y, a la vez, se
//  dibujan sus gráficas x‑t, v‑t y a‑t con el mismo eje de tiempo.
//  El modelo está en js/movimiento.js y los retos en js/retos.js.
// ═══════════════════════════════════════════════════════════════════

// --- LIENZO ---
// Horizontal en pantallas anchas; vertical en el móvil para que cada gráfica tenga altura.
const CV_ANCHO = { w: 1000, h: 700 };
const CV_ALTO  = { w: 440,  h: 800 };
let CV_W = CV_ANCHO.w, CV_H = CV_ANCHO.h;
let vertical = false;

// Escalas fijas de las gráficas (acordadas: así las pendientes se comparan entre recorridos)
const EJES = {
    x: { min: -20, max: 100, menor: 10, etiqueta: 20, unidad: 'm',    nombre: 'Posición' },
    v: { min: -10, max: 10,  menor: 1,  etiqueta: 5,  unidad: 'm/s',  nombre: 'Velocidad' },
    a: { min: -3,  max: 3,   menor: 0.5, etiqueta: 1, unidad: 'm/s²', nombre: 'Aceleración' },
};

// --- ESTADO ---
let modo = 'explorar';        // 'explorar' | 'retos' | 'mano'
let tipoExplorar = 'mru';     // 'mru' | 'mrua'
let tipoLibre = 'mru';        // tipo del reto «Libre»
let movil = 'coche';          // 'coche' | 'persona'
const ver = { x: true, v: true, a: false, marcas: true, pendiente: false, area: false, anterior: true, pausar: false };

let mov = null;               // movimiento actual
let prev = null;              // recorrido anterior { mov, hasta }
let objetivo = null;          // gráfica del reto (Movimiento) o de «Muévelo tú»
let tRec = 0;                 // hasta dónde ha llegado el recorrido
let tCur = 0;                 // instante que se muestra (cursor)
let corriendo = false;
let terminado = false;
let velocidad = 1;
let eventoActivo = null;      // momento clave en el que se ha parado
let aviso = null;             // mensaje sobre las gráficas { txt, tipo: 'ok' | 'ko' | 'info' }
let mirando = 1;              // hacia dónde mira la persona (+1 derecha, −1 izquierda)

// Retos
let retoN = 0;                // 0 = libre; 1…10
let tramosUI = [];            // [{ dur, val }]
const intentos = {};
const conSolucion = {};

// Muévelo tú
let manoX = 0;                // posición del móvil (m)
let manoXf = 0;               // posición suavizada que se graba
let arrastrando = false;
let grabando = false;         // la grabación ha empezado
let dentroFranja = 0;         // segundos dentro de la franja
let scrubbing = false;

let THEME = {};
let L = {};                   // geometría del lienzo (calcLayout)
let canvasEl;


// ─────────────────────────────────────────────────────────────────
function setup() {
    elegirOrientacion();
    const canvas = createCanvas(CV_W, CV_H);
    canvas.parent('canvas-container');
    canvasEl = canvas.elt;
    canvasEl.setAttribute('role', 'img');
    canvasEl.setAttribute('tabindex', '0');
    canvasEl.setAttribute('aria-label', i18n.t('Pista con el móvil y gráficas posición-tiempo, velocidad-tiempo y aceleración-tiempo. Con la simulación seleccionada, la barra espaciadora inicia o pausa, R reinicia y las flechas mueven el cursor del tiempo o, en «Muévelo tú», el móvil.'));
    // Deja desplazar la página en vertical, pero no en horizontal (se arrastra en horizontal)
    canvasEl.style.touchAction = 'pan-y';
    fitCanvas();
    frameRate(60);
    textFont('monospace');

    setupModos();
    setupExplorar();
    setupRetos();
    setupMano();
    setupVer();
    setupDock();
    setupThemeSelector();
    setupTeclado();

    setMode('explorar');

    // Ajustes desde la dirección (fichas de actividades): ver js/parametros.js
    const pulsar = (sel) => (v) => { const b = document.querySelector(sel(v)); if (b) b.click(); };
    const casilla = (id) => urlParam.toggle(id, (c) => c.checked);
    aplicarParametrosUrl({
        tema:      (v) => { const t = { simulaciencia: 'marca', marca: 'marca', claro: 'light', oscuro: 'dark', contraste: 'contrast' }[v];
                            const b = t && document.querySelector(`.theme-opt[data-theme="${t}"]`); if (b) b.click(); },
        modo:      urlParam.click({ explorar: 'mode-explorar', retos: 'mode-retos', mano: 'mode-mano' }),
        reto:      (v) => urlParam.select('select-reto')(v === 'libre' ? '0' : v),
        tipo:      (v) => { if (!['mru', 'mrua'].includes(v)) return;
                            document.getElementById((modo === 'retos' ? 'libre-' : 'tipo-') + v).click(); },
        ejemplo:   urlParam.select('select-ejemplo'),
        x0:        (v) => (modo === 'retos' ? numParam('num-x0')(v) : urlParam.range('slider-x0')(v)),
        v:         (v) => (modo === 'retos' ? numParam('num-v0')(v) : urlParam.range('slider-v0')(v)),
        a:         urlParam.range('slider-a'),
        para:      casilla('check-para'),
        tramos:    (v) => { if (modo === 'retos') tramosDesdeTexto(v); },
        seguir:    urlParam.select('select-seguir'),
        movil:     urlParam.click({ coche: 'movil-coche', persona: 'movil-persona' }),
        graficas:  (v) => { ['x', 'v', 'a'].forEach((k) => { const c = document.getElementById('check-g' + k);
                                if (c.checked !== v.includes(k)) c.click(); }); },
        marcas:    casilla('check-marcas'),
        pendiente: casilla('check-pendiente'),
        area:      casilla('check-area'),
        anterior:  casilla('check-anterior'),
        pausar:    casilla('check-pausar'),
        velocidad: pulsar((v) => `[data-speed="${{ '0.5': '0.5', '0,5': '0.5', '1': '1', '2': '2' }[v]}"]`),
    });
}

// Número de un campo de los retos desde la dirección
function numParam(id) {
    return (v) => {
        const n = parseFloat(v.replace(',', '.'));
        const el = document.getElementById(id);
        if (!el || !isFinite(n)) return;
        el.value = String(n);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    };
}

function draw() {
    updateTheme();
    actualizar();
    background(THEME.bg);
    drawPista();
    drawGraficas();
    if (frameCount % 3 === 0) actualizarPanel();
}


// ═══════════════════════════════════════════════════════════════════
//  TIEMPO
// ═══════════════════════════════════════════════════════════════════
function actualizar() {
    const dtReal = Math.min(deltaTime / 1000, 0.05);
    if (modo === 'mano') { actualizarMano(dtReal); return; }
    if (!corriendo || !mov) return;

    let tNew = tRec + dtReal * velocidad;
    // ¿Hay un momento clave en este paso?
    if (ver.pausar) {
        const e = mov.eventos.find((ev) => ev.t > tRec + 1e-9 && ev.t <= tNew + 1e-9);
        if (e && e.t < mov.T - 1e-6) {
            tRec = tCur = e.t;
            pausar();
            eventoActivo = e;
            anunciarEvento(e);
            return;
        }
    }
    if (tNew >= mov.T) {
        tRec = tCur = mov.T;
        corriendo = false;
        terminado = true;
        actualizarBotonPlay();
        alTerminar();
        return;
    }
    tRec = tCur = tNew;
}

function alTerminar() {
    if (mov.fin === 'borde') {
        const txt = i18n.t('El móvil ha llegado al final de la pista en t = {t} s.', { t: i18n.num(mov.T, 1) });
        anunciar(txt);
        aviso = { txt, tipo: 'info' };
    } else anunciar(i18n.t('Fin del recorrido: t = {t} s.', { t: i18n.num(mov.T, 1) }));
    if (modo === 'retos' && retoN > 0) evaluarReto();
    actualizarTabla(true);
    actualizarInstante();
}

function anunciarEvento(e) {
    const st = mov.at(e.t);
    const datos = { t: i18n.num(e.t, 1), a: fmtNum(st.a, 1) };
    anunciar(e.tipo === 'para'
        ? i18n.t('Pausa en t = {t} s: el móvil se para. v = 0 m/s.', datos)
        : i18n.t('Pausa en t = {t} s: el móvil cambia de sentido. v = 0 m/s y a = {a} m/s².', datos));
}

function iniciar() {
    if (modo === 'mano') {
        if (terminado) return;
        if (!grabando) empezarGrabacion();
        corriendo = true;
        actualizarBotonPlay();
        return;
    }
    if (!mov) return;
    if (terminado || tRec >= mov.T - 1e-9) volverAlPrincipio();
    // Si se ha movido el cursor hacia atrás, se sigue desde donde se quedó el recorrido
    tCur = tRec;
    eventoActivo = null;
    corriendo = true;
    actualizarBotonPlay();
    actualizarInstante();
}

function pausar() {
    corriendo = false;
    actualizarBotonPlay();
    actualizarInstante();
}

function volverAlPrincipio() {
    tRec = tCur = 0;
    terminado = false;
    eventoActivo = null;
    aviso = null;
    actualizarTabla(true);
}

function reiniciar() {
    corriendo = false;
    if (modo === 'mano') {
        if (grabando && mov && mov.T > 0.3 && ver.anterior) prev = { mov, hasta: mov.T };
        nuevaGrabacion();
    } else {
        volverAlPrincipio();
    }
    actualizarBotonPlay();
    actualizarInstante();
}

// Cambia el movimiento: el recorrido que ya se había hecho pasa a ser «el anterior».
function nuevoMovimiento(m) {
    if (mov && tRec > 0.3 && ver.anterior) prev = { mov, hasta: tRec };
    mov = m;
    corriendo = false;
    volverAlPrincipio();
    actualizarBotonPlay();
    actualizarInstante();
}


// ═══════════════════════════════════════════════════════════════════
//  MODOS
// ═══════════════════════════════════════════════════════════════════
function setupModos() {
    ['explorar', 'retos', 'mano'].forEach((m) =>
        document.getElementById('mode-' + m).addEventListener('click', () => setMode(m)));
}

function setMode(m) {
    modo = m;
    document.body.classList.remove('mode-explorar', 'mode-retos', 'mode-mano');
    document.body.classList.add('mode-' + m);
    ['explorar', 'retos', 'mano'].forEach((k) => {
        const b = document.getElementById('mode-' + k);
        b.classList.toggle('active', k === m);
        b.setAttribute('aria-selected', String(k === m));
    });
    corriendo = false;
    prev = null;
    objetivo = null;
    mov = null;
    if (m === 'explorar') movimientoExplorar();
    else if (m === 'retos') elegirReto(retoN);
    else entrarMano();
    actualizarTipoBody();
    actualizarBotonPlay();
    actualizarInstante();
}

// Clases del body que dicen si hay aceleración en el modo actual
function tipoActual() {
    if (modo === 'explorar') return tipoExplorar;
    if (modo === 'retos') return retoN > 0 ? RETOS[retoN - 1].tipo : tipoLibre;
    return 'mano';
}
function actualizarTipoBody() {
    const t = tipoActual();
    document.body.classList.toggle('tipo-mru', t === 'mru');
    document.body.classList.toggle('tipo-mrua', t === 'mrua');
    document.body.classList.toggle('tipo-mano', t === 'mano');
    document.body.classList.toggle('reto-libre', modo === 'retos' && retoN === 0);
    document.body.classList.toggle('reto-mrua', modo === 'retos' && t === 'mrua');
    // La gráfica a‑t no existe en MRU por tramos ni a mano: la casilla se ve atenuada
    const sinA = (modo === 'retos' && t === 'mru') || modo === 'mano';
    document.getElementById('check-ga').closest('label').classList.toggle('is-off', sinA);
}

// La gráfica a‑t tiene sentido en este modo
function hayAceleracion() {
    const t = tipoActual();
    return t === 'mrua' || (modo === 'explorar' && t === 'mru');
}


// ═══════════════════════════════════════════════════════════════════
//  MODO EXPLORAR
// ═══════════════════════════════════════════════════════════════════
const EJEMPLOS = {
    paseo:    { tipo: 'mru',  x0: 0,   v: 1.5, movil: 'persona' },
    corre:    { tipo: 'mru',  x0: 0,   v: 4,   movil: 'persona' },
    calle:    { tipo: 'mru',  x0: -20, v: 8.5, movil: 'coche' },
    vuelve:   { tipo: 'mru',  x0: 60,  v: -2,  movil: 'persona' },
    marcha:   { tipo: 'mru',  x0: 50,  v: -2,  movil: 'coche' },
    arranca:  { tipo: 'mrua', x0: -20, v: 0,   a: 0.5, para: false, movil: 'coche' },
    semaforo: { tipo: 'mrua', x0: 0,   v: 10,  a: -2,  para: true,  movil: 'coche' },
    sube:     { tipo: 'mrua', x0: 0,   v: 7,   a: -1,  para: false, movil: 'coche' },
};

function setupExplorar() {
    const tipoBtns = { mru: document.getElementById('tipo-mru'), mrua: document.getElementById('tipo-mrua') };
    Object.entries(tipoBtns).forEach(([t, b]) => b.addEventListener('click', () => {
        tipoExplorar = t;
        marcarRadio(tipoBtns, t);
        // En MRUA se ve la a‑t; en MRU empieza apagada (acuerdo de la mesa de revisión)
        const ga = document.getElementById('check-ga');
        if ((t === 'mrua') !== ga.checked) ga.click();
        actualizarTipoBody();
        movimientoExplorar();
    }));
    ['x0', 'v0', 'a'].forEach((k) => {
        const s = document.getElementById('slider-' + k);
        s.addEventListener('input', () => {
            document.getElementById('select-ejemplo').value = '';
            movimientoExplorar();
        });
    });
    document.getElementById('check-para').addEventListener('change', movimientoExplorar);
    document.getElementById('select-ejemplo').addEventListener('change', (e) => {
        const ej = EJEMPLOS[e.target.value];
        if (!ej) return;
        if (ej.tipo !== tipoExplorar) tipoBtns[ej.tipo].click();
        document.getElementById('slider-x0').value = ej.x0;
        document.getElementById('slider-v0').value = ej.v;
        if (ej.a !== undefined) document.getElementById('slider-a').value = ej.a;
        if (ej.para !== undefined) document.getElementById('check-para').checked = ej.para;
        document.getElementById('movil-' + ej.movil).click();
        movimientoExplorar();
    });
}

function leerExplorar() {
    return {
        x0: parseFloat(document.getElementById('slider-x0').value),
        v0: parseFloat(document.getElementById('slider-v0').value),
        a:  parseFloat(document.getElementById('slider-a').value),
        para: document.getElementById('check-para').checked,
    };
}

function movimientoExplorar() {
    const p = leerExplorar();
    pintarDeslizadores();
    const m = tipoExplorar === 'mru'
        ? crearMovimiento({ tipo: 'mru', x0: p.x0, tramos: [{ dur: T_MAX, v: p.v0 }] })
        : crearMovimiento({ tipo: 'mrua', x0: p.x0, v0: p.v0, tramos: [{ dur: T_MAX, a: p.a }], para: p.para });
    nuevoMovimiento(m);
    actualizarEcuaciones();
}

function pintarDeslizadores() {
    const p = leerExplorar();
    document.getElementById('val-x0').textContent = `${fmtNum(p.x0, 0)} m`;
    document.getElementById('val-v0').textContent = `${fmtNum(p.v0, p.v0 % 1 ? 1 : 0)} m/s`;
    document.getElementById('val-a').textContent = `${fmtNum(p.a, 1)} m/s²`;
    document.getElementById('kmh-v0').textContent = i18n.t('Equivale a {k} km/h.', { k: fmtNum(p.v0 * 3.6, 0) });
    document.querySelectorAll('input[type="range"]').forEach(rellenarDeslizador);
}

function rellenarDeslizador(s) {
    const min = parseFloat(s.min), max = parseFloat(s.max);
    const pct = max > min ? (parseFloat(s.value) - min) / (max - min) * 100 : 0;
    s.style.setProperty('--fill', pct + '%');
}


// ═══════════════════════════════════════════════════════════════════
//  MODO RETOS
// ═══════════════════════════════════════════════════════════════════
function setupRetos() {
    poblarSelectReto();
    document.getElementById('select-reto').addEventListener('change', (e) => elegirReto(parseInt(e.target.value, 10) || 0));
    const libreBtns = { mru: document.getElementById('libre-mru'), mrua: document.getElementById('libre-mrua') };
    Object.entries(libreBtns).forEach(([t, b]) => b.addEventListener('click', () => {
        if (tipoLibre === t) return;
        tipoLibre = t;
        marcarRadio(libreBtns, t);
        tramosUI = [{ dur: 5, val: 0 }];
        actualizarTipoBody();
        const ga = document.getElementById('check-ga');
        if ((t === 'mrua') !== ga.checked) ga.click();
        renderTramos();
        movimientoRetos();
    }));
    ['num-x0', 'num-v0'].forEach((id) => document.getElementById(id).addEventListener('input', movimientoRetos));
    document.getElementById('btn-add-tramo').addEventListener('click', () => {
        if (tramosUI.length >= 4) return;
        tramosUI.push({ dur: 5, val: 0 });
        renderTramos();
        movimientoRetos();
        const ins = document.querySelectorAll('#tramos .tramo input');
        if (ins.length) ins[ins.length - 2].focus();
    });
    document.getElementById('btn-comprobar').addEventListener('click', () => {
        volverAlPrincipio();
        iniciar();
    });
    document.getElementById('btn-pista').addEventListener('click', () => {
        const p = document.getElementById('reto-pista');
        p.hidden = !p.hidden;
    });
    document.getElementById('btn-solucion').addEventListener('click', verSolucion);
}

function poblarSelectReto() {
    const sel = document.getElementById('select-reto');
    const hechos = retosSuperados();
    const actual = sel.value;
    sel.innerHTML = '';
    const opt = (v, txt) => { const o = document.createElement('option'); o.value = v; o.textContent = txt; return o; };
    sel.appendChild(opt(0, i18n.t('Libre: construye tu propio movimiento')));
    const grupos = [[i18n.t('MRU · 2.º ESO'), 0, 5], [i18n.t('MRUA · 4.º ESO'), 5, 10]];
    for (const [nombre, a, b] of grupos) {
        const g = document.createElement('optgroup');
        g.label = nombre;
        for (let i = a; i < b; i++) {
            const n = i + 1;
            g.appendChild(opt(n, `${hechos.includes(n) ? '✓ ' : ''}${n}. ${i18n.t(RETOS[i].nombre)}`));
        }
        sel.appendChild(g);
    }
    if (actual) sel.value = actual;
}

function elegirReto(n) {
    retoN = n;
    document.getElementById('select-reto').value = String(n);
    const r = n > 0 ? RETOS[n - 1] : null;
    objetivo = r ? movimientoDeReto(r) : null;
    prev = null;
    mov = null;
    actualizarTipoBody();

    // Ficha del reto
    const meta = document.getElementById('reto-meta');
    const hist = document.getElementById('reto-historia');
    const dato = document.getElementById('reto-dato');
    if (r) {
        meta.textContent = i18n.t(r.objetivo === 'x' ? 'Reproduce la gráfica x‑t ({tipo})' : 'Reproduce la gráfica v‑t ({tipo})', { tipo: i18n.t(r.tipo === 'mru' ? 'MRU' : 'MRUA') });
        hist.textContent = i18n.t(r.historia);
        dato.textContent = r.dato ? i18n.t(r.dato) : '';
        dato.hidden = !r.dato;
        document.getElementById('reto-pista').textContent = i18n.t(r.pista);
    } else {
        meta.textContent = i18n.t('Sin gráfica objetivo');
        hist.textContent = i18n.t('Construye un movimiento por tramos y míralo en las gráficas. Sirve para preparar ejemplos de clase.');
        dato.hidden = true;
    }
    document.getElementById('btn-pista').hidden = !r;
    document.getElementById('reto-pista').hidden = true;
    document.getElementById('btn-solucion').hidden = !(r && (intentos[n] || 0) >= 2);
    ocultarFeedback();

    // Gráficas: la del reto siempre visible; a‑t solo si hay aceleración
    const tipo = tipoActual();
    if (r) {
        const c = document.getElementById('check-g' + r.objetivo);
        if (!c.checked) c.click();
    }
    const ga = document.getElementById('check-ga');
    if ((tipo === 'mrua') !== ga.checked) ga.click();

    document.getElementById('num-x0').value = '0';
    document.getElementById('num-v0').value = '0';
    tramosUI = [{ dur: 5, val: 0 }];
    renderTramos();
    movimientoRetos();
}

function renderTramos() {
    const ol = document.getElementById('tramos');
    ol.innerHTML = '';
    const mrua = tipoActual() === 'mrua';
    tramosUI.forEach((tr, i) => {
        const li = document.createElement('li');
        li.className = 'tramo';
        const n = i + 1;
        li.innerHTML = `
            <span class="tramo-n">${i18n.t('Tramo {n}', { n })}</span>
            <div class="num-field">
                <label for="tr-dur-${i}">${i18n.t('Duración')}</label>
                <div class="num-box"><input type="number" id="tr-dur-${i}" class="num-input" min="1" max="20" step="1" value="${tr.dur}" inputmode="numeric"><span class="num-unit">s</span></div>
            </div>
            <div class="num-field">
                <label for="tr-val-${i}" class="${mrua ? 'mag-a' : 'mag-v'}">${i18n.t(mrua ? 'Aceleración' : 'Velocidad')}</label>
                <div class="num-box"><input type="number" id="tr-val-${i}" class="num-input" min="${mrua ? -3 : -10}" max="${mrua ? 3 : 10}" step="0.5" value="${tr.val}" inputmode="decimal"><span class="num-unit">${mrua ? 'm/s²' : 'm/s'}</span></div>
            </div>
            <button type="button" class="tramo-del" aria-label="${i18n.t('Quitar el tramo {n}', { n })}" title="${i18n.t('Quitar el tramo {n}', { n })}" ${tramosUI.length < 2 ? 'disabled' : ''}>×</button>`;
        li.querySelector(`#tr-dur-${i}`).addEventListener('input', (e) => { tr.dur = leerNum(e.target, 1, 20, 1); movimientoRetos(); });
        li.querySelector(`#tr-val-${i}`).addEventListener('input', (e) => { tr.val = leerNum(e.target, mrua ? -3 : -10, mrua ? 3 : 10, 0); movimientoRetos(); });
        li.querySelector('.tramo-del').addEventListener('click', () => {
            tramosUI.splice(i, 1);
            renderTramos();
            movimientoRetos();
            document.getElementById('btn-add-tramo').focus();
        });
        ol.appendChild(li);
    });
    document.getElementById('btn-add-tramo').disabled = tramosUI.length >= 4;
}

// Lee un campo numérico (vale con coma o con punto) y lo deja dentro de su rango.
function leerNum(el, min, max, def) {
    const n = parseFloat(String(el.value).replace(',', '.'));
    if (!isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
}

function movimientoRetos() {
    const mrua = tipoActual() === 'mrua';
    const x0 = leerNum(document.getElementById('num-x0'), PISTA.min, PISTA.max, 0);
    const v0 = leerNum(document.getElementById('num-v0'), -10, 10, 0);
    const tramos = tramosUI.map((t) => (mrua ? { dur: t.dur, a: t.val } : { dur: t.dur, v: t.val }));
    const total = tramosUI.reduce((s, t) => s + t.dur, 0);
    const hint = document.getElementById('tramos-hint');
    hint.textContent = total > T_MAX
        ? i18n.t('Los tramos suman {n} s: la simulación solo usa los primeros 20 s.', { n: fmtNum(total, 0) })
        : i18n.t('Duración total: {n} s.', { n: fmtNum(total, 0) });
    nuevoMovimiento(crearMovimiento({ tipo: mrua ? 'mrua' : 'mru', x0, v0, tramos }));
    ocultarFeedback();
}

// «tramos=6:5,6:0,8:2.5» → duración:valor de cada tramo
function tramosDesdeTexto(v) {
    const t = v.split(/[;,]/).map((p) => p.split(':').map((n) => parseFloat(n))).filter((p) => p.length === 2 && p.every(isFinite));
    if (!t.length) return;
    tramosUI = t.slice(0, 4).map(([dur, val]) => ({ dur: Math.max(1, Math.min(20, dur)), val }));
    renderTramos();
    movimientoRetos();
}

function evaluarReto() {
    const r = RETOS[retoN - 1];
    const res = compararReto(mov, r, objetivo);
    const fb = document.getElementById('reto-feedback');
    fb.hidden = false;
    fb.classList.toggle('ok', res.ok);
    fb.classList.toggle('ko', !res.ok);
    if (res.ok) {
        fb.innerHTML = `<strong>✓ ${i18n.t('¡Reto superado!')}</strong> ${res.msg}`;
        if (!conSolucion[retoN]) { marcarSuperado(retoN); poblarSelectReto(); }
        else fb.innerHTML += ' ' + i18n.t('Esta vez has usado la solución: prueba otro reto sin ella.');
        anunciar(i18n.t('¡Reto superado!') + ' ' + res.msg);
        aviso = { txt: '✓ ' + i18n.t('¡Reto superado!') + ' ' + res.msg, tipo: 'ok' };
    } else {
        intentos[retoN] = (intentos[retoN] || 0) + 1;
        fb.innerHTML = `<strong>${i18n.t('Todavía no.')}</strong> ${res.msg}`;
        if (intentos[retoN] >= 2) document.getElementById('btn-solucion').hidden = false;
        anunciar(i18n.t('Todavía no.') + ' ' + res.msg);
        aviso = { txt: i18n.t('Todavía no.') + ' ' + res.msg, tipo: 'ko' };
    }
}

function ocultarFeedback() {
    const fb = document.getElementById('reto-feedback');
    fb.hidden = true;
    fb.textContent = '';
}

function verSolucion() {
    const r = RETOS[retoN - 1];
    if (!r) return;
    conSolucion[retoN] = true;
    document.getElementById('num-x0').value = String(r.x0);
    document.getElementById('num-v0').value = String(r.v0 || 0);
    tramosUI = r.tramos.map((t) => ({ dur: t.dur, val: r.tipo === 'mrua' ? t.a : t.v }));
    renderTramos();
    movimientoRetos();
    const fb = document.getElementById('reto-feedback');
    fb.hidden = false;
    fb.classList.remove('ok', 'ko');
    fb.textContent = i18n.t('Esta es una solución. Pulsa «Comprobar» para verla y fíjate en qué parte de la gráfica corresponde a cada tramo.');
}


// ═══════════════════════════════════════════════════════════════════
//  MODO MUÉVELO TÚ
// ═══════════════════════════════════════════════════════════════════
function setupMano() {
    document.getElementById('select-seguir').addEventListener('change', () => {
        prev = null;
        entrarMano();
    });
}

function entrarMano() {
    const n = parseInt(document.getElementById('select-seguir').value, 10) || 0;
    const s = SEGUIR[n];
    objetivo = s ? crearMovimiento({ tipo: 'mru', x0: s.x0, tramos: s.tramos }) : null;
    document.getElementById('seguir-hint').hidden = !s;
    document.getElementById('seguir-card').hidden = !s;
    const ga = document.getElementById('check-ga');
    if (ga.checked) ga.click();
    const gx = document.getElementById('check-gx');
    if (!gx.checked) gx.click();
    nuevaGrabacion();
}

function nuevaGrabacion() {
    // Con una gráfica que seguir, el móvil empieza donde empieza esa gráfica;
    // si no, se queda donde terminó la grabación anterior.
    const ultimo = mov && mov.tipo === 'mano' && mov.T > 0 ? mov.at(mov.T).x : null;
    manoX = objetivo ? objetivo.xIni : (ultimo !== null ? ultimo : 0);
    mov = new MovimientoGrabado(manoX);
    tRec = tCur = 0;
    grabando = false;
    terminado = false;
    corriendo = false;
    arrastrando = false;
    dentroFranja = 0;
    aviso = null;
    actualizarTabla(true);
    actualizarBotonPlay();
    actualizarInstante();
}

function empezarGrabacion() {
    grabando = true;
    corriendo = true;
    manoXf = manoX;
    mov = new MovimientoGrabado(manoX);
    tRec = tCur = 0;
    dentroFranja = 0;
    actualizarBotonPlay();
    anunciar(i18n.t('Grabando: tienes 20 segundos.'));
}

function actualizarMano(dt) {
    if (!corriendo) return;
    // Teclado: flechas con la simulación seleccionada
    if (document.activeElement === canvasEl) {
        const rapido = keyIsDown(SHIFT) ? 6 : 3;
        if (keyIsDown(LEFT_ARROW))  manoX -= rapido * dt;
        if (keyIsDown(RIGHT_ARROW)) manoX += rapido * dt;
    }
    // Ratón o dedo: el móvil va hacia el puntero, como mucho a 10 m/s
    if (arrastrando) {
        const objetivoX = pxAx(mouseX);
        const maxPaso = 10 * dt;
        manoX += Math.max(-maxPaso, Math.min(maxPaso, objetivoX - manoX));
    }
    manoX = Math.max(PISTA.min, Math.min(PISTA.max, manoX));
    // El puntero llega a saltos irregulares: se suaviza la posición (≈ 0,1 s)
    // antes de grabarla, como hace la electrónica de un sensor de movimiento.
    manoXf += (manoX - manoXf) * (1 - Math.exp(-dt / 0.1));

    const tNew = Math.min(T_MAX, tRec + dt);
    mov.agregar(tNew, manoXf);
    if (objetivo && Math.abs(manoXf - objetivo.at(tNew).x) <= FRANJA) dentroFranja += tNew - tRec;
    tRec = tCur = tNew;
    if (tRec >= T_MAX - 1e-9) {
        corriendo = false;
        terminado = true;
        arrastrando = false;
        actualizarBotonPlay();
        const txt = objetivo
            ? i18n.t('Fin de la grabación. Has estado dentro de la franja el {p} % del tiempo.', { p: Math.round(100 * dentroFranja / T_MAX) })
            : i18n.t('Fin de la grabación: 20 s.');
        anunciar(txt);
        aviso = { txt: txt + ' ' + i18n.t('Pulsa «Reiniciar» para grabar otra vez.'), tipo: 'info' };
        actualizarTabla(true);
        actualizarInstante();
    }
}


// ═══════════════════════════════════════════════════════════════════
//  VER (común)
// ═══════════════════════════════════════════════════════════════════
function setupVer() {
    ['x', 'v', 'a'].forEach((k) => {
        const c = document.getElementById('check-g' + k);
        c.addEventListener('change', () => {
            // Al menos una gráfica tiene que verse
            if (!c.checked && !['x', 'v', 'a'].some((j) => j !== k && ver[j])) { c.checked = true; return; }
            ver[k] = c.checked;
        });
        ver[k] = c.checked;
    });
    const casillas = { marcas: 'check-marcas', pendiente: 'check-pendiente', area: 'check-area', anterior: 'check-anterior', pausar: 'check-pausar' };
    Object.entries(casillas).forEach(([k, id]) => {
        const c = document.getElementById(id);
        ver[k] = c.checked;
        c.addEventListener('change', () => {
            ver[k] = c.checked;
            if (k === 'anterior' && !c.checked) prev = null;
            if (k === 'pendiente' && c.checked && !ver.x) document.getElementById('check-gx').click();
            if (k === 'area' && c.checked && !ver.v) document.getElementById('check-gv').click();
        });
    });
    const movilBtns = { coche: document.getElementById('movil-coche'), persona: document.getElementById('movil-persona') };
    Object.entries(movilBtns).forEach(([m, b]) => b.addEventListener('click', () => {
        movil = m;
        marcarRadio(movilBtns, m);
    }));
}

function marcarRadio(btns, activo) {
    Object.entries(btns).forEach(([k, b]) => {
        b.classList.toggle('active', k === activo);
        b.setAttribute('aria-checked', String(k === activo));
    });
}


// ═══════════════════════════════════════════════════════════════════
//  BOTONES SOBRE LA SIMULACIÓN
// ═══════════════════════════════════════════════════════════════════
function setupDock() {
    document.getElementById('btn-play').addEventListener('click', () => (corriendo ? pausar() : iniciar()));
    document.getElementById('btn-reiniciar').addEventListener('click', reiniciar);
    const speedBtns = document.querySelectorAll('[data-speed]');
    speedBtns.forEach((b) => b.addEventListener('click', () => {
        velocidad = parseFloat(b.dataset.speed);
        speedBtns.forEach((o) => {
            o.classList.toggle('active', o === b);
            o.setAttribute('aria-checked', String(o === b));
        });
    }));
    const inst = document.getElementById('slider-instante');
    inst.addEventListener('input', () => {
        tCur = Math.min(tRec, parseFloat(inst.value));
        eventoActivo = null;
        pintarInstante();
    });
    document.getElementById('btn-copiar').addEventListener('click', copiarTabla);
}

function actualizarBotonPlay() {
    const b = document.getElementById('btn-play');
    const txt = b.querySelector('.btn-txt'), ico = b.querySelector('.btn-ico');
    const ICO = {
        play:  '<svg class="ico" viewBox="0 0 16 16"><path d="M4 2.5v11l9.5-5.5z"/></svg>',
        pause: '<svg class="ico" viewBox="0 0 16 16"><rect x="3" y="2.5" width="3.6" height="11" rx="1"/><rect x="9.4" y="2.5" width="3.6" height="11" rx="1"/></svg>',
        rec:   '<svg class="ico" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/></svg>',
    };
    let t, i;
    if (corriendo) { t = 'Pausar'; i = 'pause'; }
    else if (modo === 'mano' && !grabando) { t = 'Grabar'; i = 'rec'; }
    else if (tRec > 0 && !terminado) { t = 'Seguir'; i = 'play'; }
    else { t = 'Iniciar'; i = 'play'; }
    txt.textContent = i18n.t(t);
    if (ico.dataset.i !== i) { ico.innerHTML = ICO[i]; ico.dataset.i = i; }
    b.setAttribute('aria-pressed', String(corriendo));
    b.disabled = modo === 'mano' && terminado;
}

// Barra «Instante»: se puede usar cuando el recorrido está parado
function actualizarInstante() {
    const inst = document.getElementById('slider-instante');
    inst.max = String(Math.max(0, Math.round(tRec * 10) / 10));
    inst.disabled = corriendo || tRec <= 0;
    inst.value = String(Math.round(tCur * 10) / 10);
    pintarInstante();
}
function pintarInstante() {
    const inst = document.getElementById('slider-instante');
    document.getElementById('val-instante').textContent = `${i18n.num(tCur, 1)} s`;
    rellenarDeslizador(inst);
    inst.setAttribute('aria-valuetext', `${i18n.num(tCur, 1)} s`);
}


// ═══════════════════════════════════════════════════════════════════
//  TECLADO Y RATÓN
// ═══════════════════════════════════════════════════════════════════
function setupTeclado() {
    canvasEl.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); corriendo ? pausar() : iniciar(); return; }
        if (e.key === 'r' || e.key === 'R') { reiniciar(); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (modo === 'mano') {
                if (!grabando && !terminado) { empezarGrabacion(); }
                return;
            }
            if (tRec <= 0) return;
            if (corriendo) pausar();
            const paso = (e.shiftKey ? 1 : 0.1) * (e.key === 'ArrowLeft' ? -1 : 1);
            tCur = Math.max(0, Math.min(tRec, Math.round((tCur + paso) * 10) / 10));
            eventoActivo = null;
            actualizarInstante();
        }
    });
    canvasEl.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault(); });
}

function dentroLienzo() { return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height; }
function enPista() { return mouseY >= 0 && mouseY <= L.pista.y1; }
function enGraficas() {
    return L.graf.some((g) => mouseY >= g.y0 - 6 && mouseY <= g.y1 + 6) && mouseX >= L.px0 - 10 && mouseX <= L.px1 + 10;
}

function mousePressed() {
    if (!dentroLienzo()) return;
    if (modo === 'mano' && enPista()) {
        if (terminado) return;
        if (!grabando) empezarGrabacion();
        else if (!corriendo) { corriendo = true; actualizarBotonPlay(); }
        arrastrando = true;
        return;
    }
    if (enGraficas() && tRec > 0) {
        if (corriendo) pausar();
        scrubbing = true;
        moverCursor();
    }
}
function mouseDragged() { if (scrubbing) moverCursor(); }
function mouseReleased() { arrastrando = false; scrubbing = false; }

function moverCursor() {
    tCur = Math.max(0, Math.min(tRec, pxAt(mouseX)));
    eventoActivo = null;
    actualizarInstante();
}


// ═══════════════════════════════════════════════════════════════════
//  GEOMETRÍA
// ═══════════════════════════════════════════════════════════════════
function elegirOrientacion() {
    const cont = document.getElementById('canvas-container');
    const w = cont ? cont.clientWidth : window.innerWidth;
    vertical = w < 640;
    const d = vertical ? CV_ALTO : CV_ANCHO;
    CV_W = d.w; CV_H = d.h;
}

function calcLayout() {
    const P = vertical ? 12 : 16;
    const pistaH = vertical ? 132 : 150;
    const px0 = vertical ? 54 : 78, px1 = CV_W - (vertical ? 14 : 22);
    const tramo = { x0: vertical ? 22 : 40, x1: CV_W - (vertical ? 30 : 48) };
    const visibles = ['x', 'v', 'a'].filter((k) => ver[k] && (k !== 'a' || hayAceleracion()));
    const franjaA = ver.a && !hayAceleracion();
    const top = pistaH + (vertical ? 8 : 10);
    const bottom = CV_H - (vertical ? 26 : 30);
    const gap = vertical ? 10 : 14;
    const hFranja = franjaA ? 40 : 0;
    const n = visibles.length;
    const hG = n ? (bottom - top - hFranja - (franjaA ? gap : 0) - gap * (n - 1)) / n : 0;
    const graf = visibles.map((k, i) => ({ k, y0: top + i * (hG + gap), y1: top + i * (hG + gap) + hG }));
    L = {
        P, px0, px1, tramo, graf,
        pista: { y1: pistaH },
        franjaA: franjaA ? { y0: bottom - hFranja, y1: bottom } : null,
        bottom,
        fs: vertical ? 12 : 14,
    };
}

// metros → píxeles de la pista y al revés
function axPx(x) { return L.tramo.x0 + (x - PISTA.min) / (PISTA.max - PISTA.min) * (L.tramo.x1 - L.tramo.x0); }
function pxAx(px) { return PISTA.min + (px - L.tramo.x0) / (L.tramo.x1 - L.tramo.x0) * (PISTA.max - PISTA.min); }
// tiempo ↔ píxeles de las gráficas
function atPx(t) { return L.px0 + t / T_MAX * (L.px1 - L.px0); }
function pxAt(px) { return (px - L.px0) / (L.px1 - L.px0) * T_MAX; }
function valPy(g, val) { const e = EJES[g.k]; return g.y1 - (val - e.min) / (e.max - e.min) * (g.y1 - g.y0); }


// ═══════════════════════════════════════════════════════════════════
//  DIBUJO: PISTA Y MÓVIL
// ═══════════════════════════════════════════════════════════════════
function estadoEn(t) {
    if (!mov) return { x: 0, v: 0, a: 0 };
    if (modo === 'mano' && !grabando) return { x: manoX, v: 0, a: null };
    return mov.at(t);
}

function drawPista() {
    calcLayout();
    const fs = L.fs;
    const yRoad = vertical ? 86 : 100;       // parte de arriba de la calzada
    const roadH = vertical ? 12 : 14;
    const yRule = yRoad + roadH + 4;
    const x0 = L.tramo.x0, x1 = L.tramo.x1;

    // Fondo de la zona de la pista
    noStroke();
    fill(THEME.panel);
    rect(6, 6, CV_W - 12, L.pista.y1 - 6, 10);

    // Franja de «Muévelo tú»: dónde se puede arrastrar
    if (modo === 'mano' && !terminado) {
        fill(THEME.zonaMano);
        rect(x0 - 8, yRoad - 64, x1 - x0 + 16, 64 + roadH + 4, 8);
    }

    // Calzada
    fill(THEME.road);
    rect(x0 - 6, yRoad, x1 - x0 + 12, roadH, 4);
    stroke(THEME.roadLine);
    strokeWeight(1.5);
    drawingContext.setLineDash([10, 8]);
    line(x0, yRoad + roadH / 2, x1, yRoad + roadH / 2);
    drawingContext.setLineDash([]);

    // Regla
    stroke(THEME.axis);
    strokeWeight(1.5);
    line(x0, yRule, x1 + 16, yRule);
    // Flecha del sentido positivo
    noStroke();
    fill(THEME.xCol);
    triangle(x1 + 22, yRule, x1 + 12, yRule - 5, x1 + 12, yRule + 5);
    textAlign(LEFT, CENTER);
    textSize(fs);
    textStyle(BOLD);
    text('x +', x1 + 4, yRule - 13);
    textStyle(NORMAL);
    for (let m = PISTA.min; m <= PISTA.max; m += 5) {
        const px = axPx(m);
        const grande = m % 10 === 0;
        stroke(m === 0 ? THEME.text : THEME.axis);
        strokeWeight(m === 0 ? 2 : 1);
        line(px, yRule, px, yRule + (grande ? 8 : 4));
        if (grande && (!vertical || m % 20 === 0)) {
            noStroke();
            fill(m === 0 ? THEME.text : THEME.dim);
            textAlign(CENTER, TOP);
            textSize(fs - 1);
            if (m === 0) textStyle(BOLD);
            text(fmtNum(m, 0), px, yRule + 10);
            textStyle(NORMAL);
        }
    }
    noStroke();
    fill(THEME.dim);
    textAlign(RIGHT, TOP);
    textSize(fs - 2);
    text('m', x1 + 22, yRule + 10);

    // Origen
    const pO = axPx(0);
    stroke(THEME.text);
    strokeWeight(1);
    drawingContext.setLineDash([3, 3]);
    line(pO, yRoad - 6, pO, yRule);
    drawingContext.setLineDash([]);

    if (!mov) return;
    const st = estadoEn(tCur);

    // Marcas cada segundo (como una foto estroboscópica)
    if (ver.marcas && tRec > 0) {
        noStroke();
        fill(THEME.marca);
        for (let k = 0; k <= Math.floor(tCur + 1e-6); k++) circle(axPx(mov.at(k).x), yRoad + roadH / 2, vertical ? 6 : 8);
    }

    // Posición: línea del móvil a la regla
    const px = axPx(st.x);
    stroke(THEME.xCol);
    strokeWeight(2);
    line(px, yRoad + roadH, px, yRule);
    noStroke();
    fill(THEME.xCol);
    triangle(px, yRule, px - 5, yRule - 7, px + 5, yRule - 7);

    // Móvil
    if (Math.abs(st.v) > 0.05) mirando = Math.sign(st.v);
    if (movil === 'coche') drawCoche(px, yRoad, st.x);
    else drawPersona(px, yRoad, mov.dist(tCur));

    // Flechas de velocidad y aceleración (escala: 9 px por m/s y 22 px por m/s²)
    const yV = yRoad - (vertical ? 44 : 48);
    const yA = yV - 18;
    const kV = vertical ? 5.5 : 9, kA = vertical ? 14 : 22;
    drawFlecha(px, yV, st.v * kV, THEME.vCol, 'v');
    if (st.a !== null && hayAceleracion() && (tipoActual() === 'mrua')) drawFlecha(px, yA, st.a * kA, THEME.aCol, 'a');

    // Etiqueta con la posición (en el móvil vertical la tapa el aviso de los momentos clave)
    const hayAviso = eventoActivo && Math.abs(tCur - eventoActivo.t) < 1e-6;
    if (!(vertical && hayAviso)) {
    noStroke();
    fill(THEME.xCol);
    textAlign(px > CV_W - 120 ? RIGHT : px < 120 ? LEFT : CENTER, TOP);
    textSize(fs);
    textStyle(BOLD);
    text(`x = ${fmtNum(st.x, 1)} m`, px, vertical ? 5 : 7);
    textStyle(NORMAL);
    }

    // Momento clave: v = 0 con su aceleración
    if (hayAviso) {
        const s2 = mov.at(eventoActivo.t);
        const txt = eventoActivo.tipo === 'para'
            ? i18n.t('Se para: v = 0')
            : i18n.t('Cambia de sentido: v = 0, a = {a} m/s²', { a: fmtNum(s2.a, 1) });
        // En la mitad de la pista donde no está el móvil, para no tapar sus flechas
        textSize(fs);
        textStyle(BOLD);
        const w = textWidth(txt) + 20;
        const bx = px > CV_W / 2 ? 16 : CV_W - w - 16;
        fill(THEME.aviso);
        rect(bx, 12, w, 26, 6);
        fill(THEME.avisoTxt);
        textAlign(CENTER, CENTER);
        text(txt, bx + w / 2, 25);
        textStyle(NORMAL);
    }
}

function drawFlecha(x, y, len, col, nombre) {
    const fs = L.fs;
    if (Math.abs(len) < 2) {
        noStroke();
        fill(col);
        circle(x, y, 6);
        textAlign(LEFT, CENTER);
        textSize(fs - 1);
        text(`${nombre} = 0`, x + 8, y);
        return;
    }
    stroke(col);
    strokeWeight(3);
    const xe = x + len;
    line(x, y, xe - Math.sign(len) * 6, y);
    noStroke();
    fill(col);
    const d = Math.sign(len);
    triangle(xe, y, xe - d * 10, y - 6, xe - d * 10, y + 6);
    textAlign(d > 0 ? LEFT : RIGHT, CENTER);
    textSize(fs);
    textStyle(BOLD);
    text(nombre, xe + d * 6, y);
    textStyle(NORMAL);
}

// Coche visto de lado. Nunca se da la vuelta: con v < 0 va marcha atrás
// (las ruedas giran hacia atrás). Así se ve que el signo lo da el eje, no el morro.
function drawCoche(cx, yRoad, xm) {
    const s = vertical ? 0.78 : 1;
    const w = 66 * s, h = 18 * s, r = 7.5 * s;
    const yb = yRoad - r * 0.9;
    push();
    translate(cx, 0);
    noStroke();
    fill(THEME.cocheSombra);
    ellipse(0, yRoad + 1, w * 1.05, 6);
    // Carrocería
    fill(THEME.coche);
    rect(-w / 2, yb - h, w, h, 6 * s, 9 * s, 4 * s, 4 * s);
    // Cabina
    fill(THEME.coche);
    beginShape();
    vertex(-w * 0.30, yb - h);
    vertex(-w * 0.18, yb - h - 13 * s);
    vertex(w * 0.16, yb - h - 13 * s);
    vertex(w * 0.32, yb - h);
    endShape(CLOSE);
    fill(THEME.cristal);
    beginShape();
    vertex(-w * 0.24, yb - h - 1);
    vertex(-w * 0.15, yb - h - 10 * s);
    vertex(-w * 0.01, yb - h - 10 * s);
    vertex(-w * 0.01, yb - h - 1);
    endShape(CLOSE);
    beginShape();
    vertex(w * 0.03, yb - h - 1);
    vertex(w * 0.03, yb - h - 10 * s);
    vertex(w * 0.14, yb - h - 10 * s);
    vertex(w * 0.26, yb - h - 1);
    endShape(CLOSE);
    // Faro delantero (indica el morro, que siempre mira hacia +x)
    fill(THEME.faro);
    rect(w / 2 - 5 * s, yb - h + 4 * s, 5 * s, 4 * s, 1);
    fill(THEME.piloto);
    rect(-w / 2, yb - h + 4 * s, 4 * s, 4 * s, 1);
    // Ruedas que giran con el avance
    const ang = (axPx(xm) - axPx(0)) / r;
    for (const wx of [-w * 0.3, w * 0.3]) {
        fill(THEME.rueda);
        circle(wx, yb, r * 2);
        fill(THEME.llanta);
        circle(wx, yb, r * 1.0);
        stroke(THEME.rueda);
        strokeWeight(1.6);
        for (let k = 0; k < 3; k++) {
            const aa = ang + k * TWO_PI / 3;
            line(wx, yb, wx + Math.cos(aa) * r * 0.5, yb + Math.sin(aa) * r * 0.5);
        }
        noStroke();
    }
    pop();
}

// Persona que camina: se da la vuelta hacia donde va y mueve las piernas según lo que ha andado.
function drawPersona(cx, yRoad, distancia) {
    const s = vertical ? 0.9 : 1.15;
    const fase = distancia * 1.6;
    const paso = Math.sin(fase) * 0.55;
    const yPie = yRoad, yCad = yRoad - 22 * s, yHom = yRoad - 40 * s, yCab = yRoad - 49 * s;
    push();
    translate(cx, 0);
    scale(mirando, 1);
    noStroke();
    fill(THEME.cocheSombra);
    ellipse(0, yRoad + 1, 30 * s, 5);
    stroke(THEME.persona);
    strokeCap(ROUND);
    strokeWeight(5 * s);
    // Piernas
    line(0, yCad, Math.sin(paso) * 13 * s, yPie - 1);
    line(0, yCad, Math.sin(-paso) * 13 * s, yPie - 1);
    // Tronco
    line(0, yCad, 2 * s, yHom);
    // Brazos
    strokeWeight(4 * s);
    line(1 * s, yHom + 2 * s, Math.sin(-paso) * 11 * s, yHom + 16 * s);
    line(1 * s, yHom + 2 * s, Math.sin(paso) * 11 * s, yHom + 16 * s);
    noStroke();
    fill(THEME.persona);
    circle(4 * s, yCab, 13 * s);
    // Nariz: hacia dónde mira
    fill(THEME.persona);
    triangle(10 * s, yCab - 1, 13 * s, yCab + 1, 10 * s, yCab + 3);
    pop();
}


// ═══════════════════════════════════════════════════════════════════
//  DIBUJO: GRÁFICAS
// ═══════════════════════════════════════════════════════════════════
function drawGraficas() {
    for (let i = 0; i < L.graf.length; i++) drawGrafica(L.graf[i], i === L.graf.length - 1);
    if (L.franjaA) drawFranjaA();
    if (aviso && L.graf.length) drawAviso();
}

// Resultado del reto o fin del recorrido, arriba de la primera gráfica (así se ve
// aunque el panel quede fuera de la pantalla)
function drawAviso() {
    const g = L.graf[0];
    const ancho = L.px1 - L.px0 - 24;
    textSize(L.fs);
    textStyle(BOLD);
    const lineas = Math.ceil((textWidth(aviso.txt) + 24) / ancho);
    const w = lineas > 1 ? ancho : textWidth(aviso.txt) + 24;
    const h = lineas * (L.fs + 6) + 12;
    const x = (L.px0 + L.px1) / 2 - w / 2, y = g.y0 + 22;
    noStroke();
    fill(aviso.tipo === 'ok' ? THEME.vCol : aviso.tipo === 'ko' ? THEME.aCol : THEME.etiquetaBg);
    rect(x - 2, y - 2, w + 4, h + 4, 9);
    fill(THEME.etiquetaBg);
    rect(x, y, w, h, 8);
    fill(aviso.tipo === 'ok' ? THEME.vCol : aviso.tipo === 'ko' ? THEME.aCol : THEME.text);
    textAlign(CENTER, CENTER);
    text(aviso.txt, x + 12, y + 4, w - 24, h - 8);
    textStyle(NORMAL);
}

function drawGrafica(g, ultima) {
    const e = EJES[g.k];
    const fs = L.fs;
    const col = THEME[g.k + 'Col'];
    const { px0, px1 } = L;

    // Marco
    noStroke();
    fill(THEME.panel);
    rect(px0 - (vertical ? 48 : 70), g.y0 - 6, px1 - px0 + (vertical ? 56 : 82), g.y1 - g.y0 + 12, 8);

    // Cuadrícula
    strokeWeight(1);
    for (let t = 0; t <= T_MAX + 1e-9; t += 1) {
        stroke(t % 5 === 0 ? THEME.gridStrong : THEME.grid);
        line(atPx(t), g.y0, atPx(t), g.y1);
    }
    for (let v = e.min; v <= e.max + 1e-9; v += e.menor) {
        const y = valPy(g, v);
        const esEtiqueta = Math.abs(v / e.etiqueta - Math.round(v / e.etiqueta)) < 1e-6;
        stroke(Math.abs(v) < 1e-9 ? THEME.zero : esEtiqueta ? THEME.gridStrong : THEME.grid);
        strokeWeight(Math.abs(v) < 1e-9 ? 1.6 : 1);
        line(px0, y, px1, y);
        if (esEtiqueta) {
            noStroke();
            fill(THEME.dim);
            textAlign(RIGHT, CENTER);
            textSize(fs - 2);
            text(fmtNum(v, 0), px0 - 5, y);
        }
    }

    // Título del eje (girado) y nombre de la gráfica
    push();
    translate(px0 - (vertical ? 36 : 52), (g.y0 + g.y1) / 2);
    rotate(-HALF_PI);
    noStroke();
    fill(col);
    textAlign(CENTER, CENTER);
    textSize(fs);
    textStyle(BOLD);
    text(`${g.k} (${e.unidad})`, 0, 0);
    textStyle(NORMAL);
    pop();

    // Eje del tiempo
    if (ultima) {
        fill(THEME.dim);
        textAlign(CENTER, TOP);
        textSize(fs - 2);
        const paso = vertical ? 5 : 2;
        for (let t = 0; t <= T_MAX; t += paso) text(fmtNum(t, 0), atPx(t), g.y1 + 6);
        // Nombre del eje bajo la columna de valores, donde no choca con los números
        textAlign(RIGHT, TOP);
        fill(THEME.text);
        textStyle(BOLD);
        textSize(fs - 1);
        text('t (s)', px0 - 5, g.y1 + 6);
        textStyle(NORMAL);
    }

    // Todo lo que sigue se recorta al rectángulo de la gráfica
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(px0, g.y0, px1 - px0, g.y1 - g.y0);
    drawingContext.clip();

    // Franja de «Muévelo tú»
    if (objetivo && modo === 'mano' && g.k === 'x') drawFranja(g);
    // Área bajo v‑t hasta el cursor
    if (g.k === 'v' && ver.area && mov && tRec > 0) drawArea(g);
    // Gráfica del reto
    if (objetivo && ((modo === 'retos' && RETOS[retoN - 1] && RETOS[retoN - 1].objetivo === g.k) || (modo === 'mano' && g.k === 'x'))) {
        drawCurva(objetivo, g, objetivo.T, THEME.objetivo, 2.5, [9, 6]);
    }
    // Recorrido anterior
    if (prev && ver.anterior && (g.k !== 'a' || prev.mov.analitico)) drawCurva(prev.mov, g, prev.hasta, THEME.prev, 2.5);
    // Recorrido actual
    let fuera = false;
    if (mov && tRec > 0) fuera = drawCurva(mov, g, tRec, col, 3.2);

    // Pendiente de x‑t en el cursor
    if (g.k === 'x' && ver.pendiente && mov && tRec > 0) drawPendiente(g);
    drawingContext.restore();

    // Cursor del instante
    if (mov && (tRec > 0 || modo === 'mano')) {
        const xc = atPx(tCur);
        stroke(THEME.cursor);
        strokeWeight(1.5);
        drawingContext.setLineDash([4, 4]);
        line(xc, g.y0, xc, g.y1);
        drawingContext.setLineDash([]);
        if (tRec > 0) {
            const st = estadoEn(tCur);
            const val = st[g.k];
            if (val !== null && val !== undefined) {
                const y = Math.max(g.y0, Math.min(g.y1, valPy(g, val)));
                noStroke();
                fill(THEME.bg);
                circle(xc, y, 13);
                fill(col);
                circle(xc, y, 9);
                // Valor junto al punto
                const txt = `${fmtNum(val, 1)} ${e.unidad}`;
                textSize(fs - 1);
                textStyle(BOLD);
                const w = textWidth(txt) + 10;
                const derecha = xc + w + 14 < px1;
                const bx = derecha ? xc + 10 : xc - 10 - w;
                const by = Math.max(g.y0 + 2, Math.min(g.y1 - 20, y - 22));
                fill(THEME.etiquetaBg);
                rect(bx, by, w, 18, 4);
                fill(col);
                textAlign(LEFT, CENTER);
                text(txt, bx + 5, by + 9);
                textStyle(NORMAL);
            }
        }
    }

    // Nombre de la gráfica, encima de las curvas para que siempre se lea
    const nombres = { x: 'Posición – tiempo', v: 'Velocidad – tiempo', a: 'Aceleración – tiempo' };
    const nombre = i18n.t(nombres[g.k]);
    noStroke();
    textSize(fs - 2);
    fill(THEME.etiquetaBg);
    rect(px0 + 2, g.y0 + 2, textWidth(nombre) + 8, fs + 2, 3);
    fill(THEME.dim);
    textAlign(LEFT, TOP);
    text(nombre, px0 + 6, g.y0 + 4);

    if (fuera) {
        noStroke();
        fill(THEME.dim);
        textAlign(RIGHT, TOP);
        textSize(fs - 2);
        text(i18n.t('La gráfica se sale de la escala'), px1 - 6, g.y0 + 4);
    }

    // Invitación a predecir antes del primer recorrido
    if (tRec <= 0 && !prev && g === L.graf[0]) drawInvitacion(g);
}

function drawCurva(m, g, hasta, col, peso, dash) {
    const ts = m.m.t, ys = m.m[g.k];
    const e = EJES[g.k];
    let fuera = false;
    noFill();
    stroke(col);
    strokeWeight(peso);
    if (dash) drawingContext.setLineDash(dash);
    beginShape();
    for (let i = 0; i < ts.length; i++) {
        if (ts[i] > hasta + 1e-9) {
            // último punto exacto
            const st = m.at(hasta);
            vertex(atPx(hasta), valPy(g, st[g.k]));
            break;
        }
        const y = ys[i];
        if (y > e.max + 1e-6 || y < e.min - 1e-6) fuera = true;
        vertex(atPx(ts[i]), valPy(g, y));
    }
    endShape();
    drawingContext.setLineDash([]);
    return fuera;
}

function drawArea(g) {
    const ts = mov.m.t, vs = mov.m.v;
    const y0 = valPy(g, 0);
    noStroke();
    fill(THEME.area);
    beginShape();
    vertex(atPx(0), y0);
    for (let i = 0; i < ts.length && ts[i] <= tCur + 1e-9; i++) vertex(atPx(ts[i]), valPy(g, vs[i]));
    const st = mov.at(tCur);
    vertex(atPx(tCur), valPy(g, st.v));
    vertex(atPx(tCur), y0);
    endShape(CLOSE);
    // Valor del área (con signo) = desplazamiento
    const dx = st.x - mov.at(0).x;
    const txt = i18n.t('área = Δx = {v} m', { v: fmtNum(dx, 1) });
    textSize(L.fs - 1);
    textStyle(BOLD);
    const w = textWidth(txt) + 12;
    fill(THEME.etiquetaBg);
    rect(L.px1 - w - 6, g.y1 - 26, w, 20, 4);
    fill(THEME.vCol);
    textAlign(LEFT, CENTER);
    text(txt, L.px1 - w, g.y1 - 16);
    textStyle(NORMAL);
}

function drawPendiente(g) {
    const st = mov.at(tCur);
    // Pendiente hacia delante en el cursor (en el MRU por tramos, la del tramo que empieza)
    const v = st.v;
    const t1 = tCur - 2.5, t2 = tCur + 2.5;
    stroke(THEME.tangente);
    strokeWeight(2);
    drawingContext.setLineDash([2, 4]);
    line(atPx(t1), valPy(g, st.x + v * (t1 - tCur)), atPx(t2), valPy(g, st.x + v * (t2 - tCur)));
    drawingContext.setLineDash([]);
    const txt = i18n.t('pendiente = v = {v} m/s', { v: fmtNum(v, 1) });
    textSize(L.fs - 1);
    textStyle(BOLD);
    const w = textWidth(txt) + 12;
    noStroke();
    fill(THEME.etiquetaBg);
    rect(L.px1 - w - 6, g.y1 - 26, w, 20, 4);
    fill(THEME.vCol);
    textAlign(LEFT, CENTER);
    text(txt, L.px1 - w, g.y1 - 16);
    textStyle(NORMAL);
}

function drawFranja(g) {
    const ts = objetivo.m.t, xs = objetivo.m.x;
    noStroke();
    fill(THEME.franja);
    beginShape();
    for (let i = 0; i < ts.length; i++) vertex(atPx(ts[i]), valPy(g, xs[i] + FRANJA));
    for (let i = ts.length - 1; i >= 0; i--) vertex(atPx(ts[i]), valPy(g, xs[i] - FRANJA));
    endShape(CLOSE);
}

function drawFranjaA() {
    const f = L.franjaA;
    noStroke();
    fill(THEME.panel);
    rect(L.px0 - (vertical ? 48 : 70), f.y0, L.px1 - L.px0 + (vertical ? 56 : 82), f.y1 - f.y0, 8);
    fill(THEME.dim);
    textAlign(CENTER, CENTER);
    textSize(L.fs - 2);
    const txt = modo === 'mano'
        ? i18n.t('Sin gráfica a‑t: al mover con la mano la aceleración cambia tan deprisa que su gráfica sería ilegible.')
        : i18n.t('Sin gráfica a‑t: en el MRU por tramos la velocidad cambia de golpe y la aceleración sería infinita un instante.');
    text(txt, (L.px0 + L.px1) / 2 - (vertical ? 20 : 30), (f.y0 + f.y1) / 2, L.px1 - L.px0 + (vertical ? 40 : 60));
}

function drawInvitacion(g) {
    let txt;
    if (modo === 'explorar') txt = i18n.t('Antes de pulsar ▶, piensa: ¿qué forma tendrá la gráfica {g}?', { g: g.k === 'x' ? 'x‑t' : g.k === 'v' ? 'v‑t' : 'a‑t' });
    else if (modo === 'retos') txt = retoN > 0 ? i18n.t('Lee la gráfica del reto, construye los tramos y pulsa «Comprobar».') : i18n.t('Construye los tramos en el panel y pulsa ▶.');
    else txt = grabando ? '' : i18n.t('Arrastra el móvil por la pista (o pulsa la pista y usa las flechas ← →).');
    if (!txt) return;
    textSize(L.fs);
    const w = Math.min(L.px1 - L.px0 - 40, textWidth(txt) + 28);
    const cx = (L.px0 + L.px1) / 2, cy = (g.y0 + g.y1) / 2;
    noStroke();
    fill(THEME.etiquetaBg);
    rect(cx - w / 2, cy - 22, w, 44, 8);
    fill(THEME.text);
    textAlign(CENTER, CENTER);
    text(txt, cx - w / 2 + 10, cy - 20, w - 20, 40);
}


// ═══════════════════════════════════════════════════════════════════
//  PANEL: DATOS, TABLA Y ECUACIONES
// ═══════════════════════════════════════════════════════════════════
function actualizarPanel() {
    if (!mov) return;
    const st = estadoEn(tCur);
    const set = (id, v) => { const el = document.getElementById(id); if (el.textContent !== v) el.textContent = v; };
    set('metric-t', i18n.num(tCur, 1));
    set('metric-x', fmtNum(st.x, 1));
    set('metric-v', fmtNum(st.v, 1));
    set('metric-kmh', `${fmtNum(st.v * 3.6, 0)} km/h`);
    set('metric-a', st.a === null ? '—' : fmtNum(st.a, 1));
    set('metric-s', fmtNum(tRec > 0 ? mov.dist(tCur) : 0, 1));
    set('metric-dx', fmtNum(st.x - mov.at(0).x, 1));
    if (objetivo && modo === 'mano') set('metric-seguir', String(Math.round(100 * dentroFranja / T_MAX)));
    if (!scrubbing) {
        const inst = document.getElementById('slider-instante');
        if (corriendo) { inst.max = String(Math.round(tRec * 10) / 10); inst.value = inst.max; pintarInstante(); }
    }
    actualizarTabla(false);
    if (modo === 'explorar') actualizarEcuaciones();
}

let filasTabla = -1;
function actualizarTabla(forzar) {
    const n = mov ? Math.floor(tRec + 1e-6) : -1;
    if (!forzar && n === filasTabla) return;
    filasTabla = n;
    const conA = mov && mov.analitico && tipoActual() === 'mrua';
    document.getElementById('tabla-valores').classList.toggle('sin-a', !conA);
    const tb = document.querySelector('#tabla-valores tbody');
    let html = '';
    for (let k = 0; k <= n; k++) {
        const st = mov.at(k);
        html += `<tr><td>${fmtNum(k, 0)}</td><td>${fmtNum(st.x, 1)}</td><td>${fmtNum(st.v, 1)}</td><td class="col-a">${conA ? fmtNum(st.a, 1) : ''}</td></tr>`;
    }
    if (n < 0) html = `<tr><td colspan="4" class="tabla-vacia">${i18n.t('Pon en marcha el movimiento para llenar la tabla.')}</td></tr>`;
    tb.innerHTML = html;
}

function copiarTabla() {
    const conA = !document.getElementById('tabla-valores').classList.contains('sin-a');
    const filas = [['t (s)', 'x (m)', 'v (m/s)'].concat(conA ? ['a (m/s²)'] : [])];
    const n = mov ? Math.floor(tRec + 1e-6) : -1;
    for (let k = 0; k <= n; k++) {
        const st = mov.at(k);
        // En la hoja de cálculo, el signo menos normal (no el tipográfico)
        const f = (v, d) => fmtNum(v, d).replace('−', '-');
        filas.push([f(k, 0), f(st.x, 1), f(st.v, 1)].concat(conA ? [f(st.a, 1)] : []));
    }
    const tsv = filas.map((r) => r.join('\t')).join('\n');
    const hecho = () => anunciar(i18n.t('Tabla copiada: pégala en una hoja de cálculo.'), true);
    const btn = document.getElementById('btn-copiar');
    const avisar = () => { hecho(); btn.textContent = i18n.t('Copiada ✓'); setTimeout(() => { btn.textContent = i18n.t('Copiar tabla'); }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(avisar, () => copiaManual(tsv, avisar));
    else copiaManual(tsv, avisar);
}
function copiaManual(txt, ok) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { if (document.execCommand('copy')) ok(); } catch (e) { /* nada */ }
    ta.remove();
}

let ultimaEcuacion = '';
function actualizarEcuaciones() {
    if (!mov) return;
    const p = leerExplorar();
    const t = tCur;
    const st = mov.at(t);
    const n = (v, d = 1) => fmtNum(v, d);
    // «+ 4 · t» o «− 4 · t»
    const termino = (c, s, d = 1) => (c < 0 ? `− ${n(-c, d)} · ${s}` : `+ ${n(c, d)} · ${s}`);
    const fila = (nombre, eq) => `<div class="formula"><span class="formula-name">${nombre}</span><span class="formula-eq">${eq}</span></div>`;
    // Los decimales justos: 8 · t, 0,5 · t², 0,25 · t²
    const dv = (v) => (Math.abs(v % 1) < 1e-9 ? 0 : Math.abs((v * 10) % 1) < 1e-9 ? 1 : 2);
    let html = '';
    let nota = '';
    const ts = n(t, 1);
    if (tipoExplorar === 'mru') {
        html += fila(i18n.t('Posición'), 'x = x₀ + v · t');
        html += fila(i18n.t('Con tus datos'), `x = ${n(p.x0, 0)} ${termino(p.v0, 't', dv(p.v0))}`);
        html += fila(i18n.t('En t = {t} s', { t: ts }), `x = ${n(p.x0, 0)} ${termino(p.v0, ts, dv(p.v0))} = ${n(st.x)} m`);
    } else {
                html += fila(i18n.t('Posición'), 'x = x₀ + v₀ · t + ½ · a · t²');
        html += fila(i18n.t('Velocidad'), 'v = v₀ + a · t');
        html += fila(i18n.t('Con tus datos'), `x = ${n(p.x0, 0)} ${termino(p.v0, 't', dv(p.v0))} ${termino(p.a / 2, 't²', dv(p.a / 2))}`);
        html += fila('', `v = ${n(p.v0, dv(p.v0))} ${termino(p.a, 't', dv(p.a))}`);
        const seg = mov.segs.find((s) => s.parado);
        if (seg && t > seg.t0 + 1e-6) {
            nota = i18n.t('Desde t = {t} s el móvil está parado: x = {x} m y v = 0. Las ecuaciones del MRUA ya no valen.', { t: n(seg.t0, 1), x: n(seg.x0, 1) });
        } else {
            html += fila(i18n.t('En t = {t} s', { t: ts }), `x = ${n(st.x)} m · v = ${n(st.v)} m/s`);
        }
    }
    if (mov.fin === 'borde') nota = (nota ? nota + ' ' : '') + i18n.t('El móvil llega al final de la pista en t = {t} s.', { t: n(mov.T, 1) });
    const clave = html + nota;
    if (clave === ultimaEcuacion) return;
    ultimaEcuacion = clave;
    document.getElementById('ecuaciones').innerHTML = html;
    document.getElementById('ecuaciones-nota').textContent = nota;
}


// ═══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════════════════════════
// Número con coma o punto según el idioma y con el signo menos tipográfico; sin «−0».
function fmtNum(v, d) {
    const f = Math.pow(10, d);
    let r = Math.round(v * f) / f;
    if (Object.is(r, -0) || Math.abs(r) < 0.5 / f) r = 0;
    const s = i18n.num(Math.abs(r), d);
    return (r < 0 ? '−' : '') + s;
}

// Ajusta el lienzo al hueco sin deformarlo. En pantallas estrechas pasa a vertical.
function fitCanvas() {
    const cont = document.getElementById('canvas-container');
    const cv = cont.querySelector('canvas');
    if (!cv) return;
    const cs = getComputedStyle(cont);
    const w = cont.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const apilado = window.matchMedia('(max-width: 1100px)').matches;
    const h = apilado ? Infinity : cont.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const s = Math.max(0.1, Math.min(w / CV_W, h / CV_H));
    cv.style.width = Math.floor(CV_W * s) + 'px';
    cv.style.height = Math.floor(CV_H * s) + 'px';
}

function windowResized() {
    const antes = vertical;
    elegirOrientacion();
    if (antes !== vertical) resizeCanvas(CV_W, CV_H);
    fitCanvas();
}

let ultimoAnuncio = '';
function anunciar(txt, repetir) {
    if (txt === ultimoAnuncio && !repetir) return;
    ultimoAnuncio = txt;
    const el = document.getElementById('anuncio');
    el.textContent = '';
    setTimeout(() => { el.textContent = txt; }, 30);
}


// ═══════════════════════════════════════════════════════════════════
//  TEMAS (oscuro · claro · alto contraste · SimulaCiencia)
// ═══════════════════════════════════════════════════════════════════
function setupThemeSelector() {
    const themeBtn = document.getElementById('theme-btn');
    const themePanel = document.getElementById('theme-panel');
    const themeOpts = document.querySelectorAll('.theme-opt');
    const closePanel = () => {
        themePanel.classList.remove('open');
        themePanel.setAttribute('aria-hidden', 'true');
        themeBtn.classList.remove('active');
        themeBtn.setAttribute('aria-expanded', 'false');
    };
    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = themePanel.classList.toggle('open');
        themeBtn.classList.toggle('active', isOpen);
        themeBtn.setAttribute('aria-expanded', String(isOpen));
        themePanel.setAttribute('aria-hidden', String(!isOpen));
    });
    document.addEventListener('click', (e) => {
        if (!themeBtn.contains(e.target) && !themePanel.contains(e.target)) closePanel();
    });
    themeOpts.forEach((btn) => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.body.classList.remove('theme-light', 'theme-contrast', 'theme-marca');
            if (theme === 'marca') document.body.classList.add('theme-light', 'theme-marca');
            else if (theme !== 'dark') document.body.classList.add('theme-' + theme);
            themeOpts.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            closePanel();
        });
    });
}

// Colores del lienzo. Cada magnitud tiene su color, el mismo en la pista, en
// las gráficas y en el panel: posición (cian), velocidad (verde), aceleración (naranja).
function updateTheme() {
    const b = document.body.classList;
    if (b.contains('theme-marca')) {
        THEME = {
            bg: '#f8fafc', panel: '#ffffff', grid: '#eef2f6', gridStrong: '#dbe3ec', zero: '#94a3b8',
            axis: '#64748b', text: '#1e293b', dim: '#64748b',
            xCol: '#0369a1', vCol: '#0f766e', aCol: '#c2410c', objetivo: '#6d28d9', prev: 'rgba(100,116,139,0.45)',
            cursor: '#b45309', area: 'rgba(15,118,110,0.18)', tangente: '#1e293b', franja: 'rgba(109,40,217,0.12)',
            road: '#cbd5e1', roadLine: '#f8fafc', marca: '#0369a1', zonaMano: 'rgba(3,105,161,0.06)',
            coche: '#0369a1', cristal: '#e0f2fe', faro: '#fde68a', piloto: '#dc2626', rueda: '#1e293b', llanta: '#cbd5e1',
            cocheSombra: 'rgba(15,23,42,0.12)', persona: '#1e293b',
            etiquetaBg: 'rgba(255,255,255,0.92)', aviso: '#6d28d9', avisoTxt: '#ffffff',
        };
    } else if (b.contains('theme-light')) {
        THEME = {
            bg: '#ccd6e8', panel: '#e9eef5', grid: '#d6dee9', gridStrong: '#b4c0d2', zero: '#5a6a80',
            axis: '#5a6a80', text: '#0d1520', dim: '#4a5a6a',
            xCol: '#0077a0', vCol: '#137a55', aCol: '#b4560c', objetivo: '#8a5a00', prev: 'rgba(74,90,106,0.45)',
            cursor: '#8a5a00', area: 'rgba(19,122,85,0.18)', tangente: '#0d1520', franja: 'rgba(154,108,0,0.15)',
            road: '#9aa8bc', roadLine: '#e9eef5', marca: '#0077a0', zonaMano: 'rgba(0,119,160,0.07)',
            coche: '#0077a0', cristal: '#dff1f8', faro: '#ffd24a', piloto: '#d83030', rueda: '#1a2638', llanta: '#9aa8bc',
            cocheSombra: 'rgba(0,0,0,0.15)', persona: '#1a2638',
            etiquetaBg: 'rgba(233,238,245,0.94)', aviso: '#8a5a00', avisoTxt: '#ffffff',
        };
    } else if (b.contains('theme-contrast')) {
        THEME = {
            bg: '#000000', panel: '#000000', grid: '#222200', gridStrong: '#555500', zero: '#ffffff',
            axis: '#ffffff', text: '#ffffff', dim: '#dddddd',
            xCol: '#00ffff', vCol: '#00ff88', aCol: '#ffaa00', objetivo: '#ffff00', prev: 'rgba(200,200,200,0.55)',
            cursor: '#ffff00', area: 'rgba(0,255,136,0.25)', tangente: '#ffffff', franja: 'rgba(255,255,0,0.18)',
            road: '#444444', roadLine: '#ffffff', marca: '#00ffff', zonaMano: 'rgba(0,255,255,0.08)',
            coche: '#00ffff', cristal: '#000000', faro: '#ffff00', piloto: '#ff3333', rueda: '#ffffff', llanta: '#000000',
            cocheSombra: 'rgba(255,255,255,0.15)', persona: '#ffffff',
            etiquetaBg: 'rgba(0,0,0,0.9)', aviso: '#ffff00', avisoTxt: '#000000',
        };
    } else {
        THEME = {
            bg: '#141414', panel: '#191d22', grid: '#20262d', gridStrong: '#2c343e', zero: '#5a6878',
            axis: '#5a6878', text: '#e0e0e0', dim: '#9aa6b2',
            xCol: '#00c8ff', vCol: '#55cc80', aCol: '#ff9a4a', objetivo: '#ffd24a', prev: 'rgba(160,170,180,0.4)',
            cursor: '#ffd24a', area: 'rgba(85,204,128,0.18)', tangente: '#ffffff', franja: 'rgba(255,210,74,0.2)',
            road: '#2c3238', roadLine: '#5a6268', marca: '#00c8ff', zonaMano: 'rgba(0,200,255,0.05)',
            coche: '#2a8fc4', cristal: '#bfe6f6', faro: '#ffe9a0', piloto: '#ff5a5a', rueda: '#0d0f12', llanta: '#9aa6b2',
            cocheSombra: 'rgba(0,0,0,0.45)', persona: '#e8e8e8',
            etiquetaBg: 'rgba(20,20,20,0.88)', aviso: '#ffd24a', avisoTxt: '#141414',
        };
    }
}
