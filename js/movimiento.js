'use strict';
// ═══════════════════════════════════════════════════════════════════
//  MODELO DEL MOVIMIENTO RECTILÍNEO
//
//  Un movimiento es una sucesión de tramos. En cada tramo la aceleración
//  es constante, así que la posición y la velocidad se calculan con las
//  ecuaciones exactas del MRU y del MRUA (no hay integración numérica).
//  El movimiento hecho «a mano» se guarda como una lista de muestras.
// ═══════════════════════════════════════════════════════════════════

const PISTA = { min: -20, max: 100 };   // m: extremos de la pista
const T_MAX = 20;                       // s: duración máxima de un recorrido
const DT_MUESTRA = 0.02;                // s: separación de las muestras que se dibujan
const EPS = 1e-9;

// Posición y velocidad dentro de un tramo, a un tiempo τ desde su comienzo.
function xTramo(s, tau) { return s.x0 + s.v0 * tau + 0.5 * s.a * tau * tau; }
function vTramo(s, tau) { return s.v0 + s.a * tau; }

// Instante (desde el comienzo del tramo) en el que el móvil sale de la pista,
// o null si no sale. Se busca a pasos de 1 ms y se afina por bisección.
function tiempoBorde(s) {
    const dur = s.t1 - s.t0;
    const fuera = (x) => x > PISTA.max + 1e-6 || x < PISTA.min - 1e-6;
    if (fuera(xTramo(s, 0))) return 0;
    const paso = 0.001;
    let tOk = 0;
    for (let tau = paso; tau < dur + paso; tau += paso) {
        const tt = Math.min(tau, dur);
        if (fuera(xTramo(s, tt))) {
            let lo = tOk, hi = tt;
            for (let k = 0; k < 40; k++) {
                const mid = (lo + hi) / 2;
                if (fuera(xTramo(s, mid))) hi = mid; else lo = mid;
            }
            return lo;
        }
        tOk = tt;
    }
    return null;
}

// Crea un movimiento por tramos.
//   tipo:   'mru'  → cada tramo lleva su velocidad { dur, v } (cambia de golpe entre tramos)
//           'mrua' → cada tramo lleva su aceleración { dur, a } (la velocidad es continua)
//   x0, v0: posición y velocidad iniciales (v0 solo en MRUA)
//   para:   en MRUA, si al frenar llega a v = 0 se queda parado (no da marcha atrás)
function crearMovimiento({ tipo, x0, v0 = 0, tramos, para = false, tMax = T_MAX }) {
    const segs = [];
    let t = 0, x = x0, v = tipo === 'mru' ? 0 : v0;
    for (const tr of tramos) {
        if (t >= tMax - EPS) break;
        const dur = Math.min(tr.dur, tMax - t);
        if (!(dur > EPS)) continue;
        if (tipo === 'mru') {
            v = tr.v;
            segs.push({ t0: t, t1: t + dur, x0: x, v0: v, a: 0 });
            x += v * dur;
        } else {
            const a = tr.a;
            const tStop = (a !== 0 && v !== 0 && Math.sign(v) !== Math.sign(a)) ? -v / a : Infinity;
            if (para && tStop < dur - EPS) {
                segs.push({ t0: t, t1: t + tStop, x0: x, v0: v, a });
                x += v * tStop + 0.5 * a * tStop * tStop;
                v = 0;
                segs.push({ t0: t + tStop, t1: t + dur, x0: x, v0: 0, a: 0, parado: true });
            } else {
                segs.push({ t0: t, t1: t + dur, x0: x, v0: v, a });
                x += v * dur + 0.5 * a * dur * dur;
                v += a * dur;
            }
        }
        t += dur;
    }

    // Si el móvil llega a un extremo de la pista, el recorrido acaba ahí.
    let fin = 'tiempo';
    for (let i = 0; i < segs.length; i++) {
        const tb = tiempoBorde(segs[i]);
        if (tb !== null) {
            segs[i].t1 = segs[i].t0 + tb;
            segs.length = i + 1;
            if (tb <= EPS) segs.pop();
            fin = 'borde';
            break;
        }
    }

    return new Movimiento(tipo, segs, fin, x0);
}

class Movimiento {
    constructor(tipo, segs, fin, x0) {
        this.tipo = tipo;
        this.segs = segs;
        this.fin = fin;
        this.xIni = x0;
        this.T = segs.length ? segs[segs.length - 1].t1 : 0;
        this.analitico = true;
        this.construirMuestras();
        this.eventos = this.buscarEventos();
    }

    // Tramo en el instante t. En el límite entre dos tramos manda el siguiente
    // (la velocidad del MRU por tramos ya ha cambiado), salvo al final del todo.
    tramoEn(t) {
        const s = this.segs;
        for (let i = s.length - 1; i >= 0; i--) if (t >= s[i].t0 - EPS) return s[i];
        return s[0];
    }

    at(t) {
        if (!this.segs.length) return { x: this.xIni, v: 0, a: 0 };
        t = Math.max(0, Math.min(this.T, t));
        let s = this.tramoEn(t);
        if (t >= this.T - EPS) s = this.segs[this.segs.length - 1];
        const tau = t - s.t0;
        return { x: xTramo(s, tau), v: vTramo(s, tau), a: s.a };
    }

    // Distancia recorrida (siempre positiva) desde t = 0 hasta t.
    dist(t) { return interpolar(this.m.t, this.m.s, Math.max(0, Math.min(this.T, t))); }

    construirMuestras() {
        const m = { t: [], x: [], v: [], a: [], s: [] };
        let sAcum = 0, xPrev = null;
        const push = (t, x, v, a) => {
            if (xPrev !== null) sAcum += Math.abs(x - xPrev);
            xPrev = x;
            m.t.push(t); m.x.push(x); m.v.push(v); m.a.push(a); m.s.push(sAcum);
        };
        for (const s of this.segs) {
            const dur = s.t1 - s.t0;
            // En MRUA la distancia se integra con más finura cerca del punto de retorno
            const n = Math.max(1, Math.ceil(dur / DT_MUESTRA));
            for (let k = 0; k <= n; k++) {
                const tau = dur * k / n;
                push(s.t0 + tau, xTramo(s, tau), vTramo(s, tau), s.a);
            }
        }
        if (!m.t.length) push(0, this.xIni, 0, 0);
        this.m = m;
    }

    // Momentos clave: cuando el móvil se para o cambia de sentido.
    buscarEventos() {
        const ev = [];
        const sg = (v) => (Math.abs(v) < 1e-9 ? 0 : Math.sign(v));
        const s = this.segs;
        for (let i = 0; i < s.length; i++) {
            const seg = s[i], dur = seg.t1 - seg.t0;
            // Dentro de un tramo de MRUA, la velocidad pasa por cero y cambia de signo
            if (seg.a !== 0 && seg.v0 !== 0 && sg(seg.v0) !== sg(seg.a)) {
                const tau = -seg.v0 / seg.a;
                if (tau > EPS && tau < dur - EPS) ev.push({ t: seg.t0 + tau, tipo: 'cambia' });
            }
            // En el límite con el tramo siguiente
            if (i + 1 < s.length) {
                const sig = s[i + 1];
                const vFin = vTramo(seg, dur);
                const antes = sg(vFin) !== 0 ? sg(vFin) : (seg.a !== 0 ? -sg(seg.a) : 0);
                const despues = sg(sig.v0) !== 0 ? sg(sig.v0) : sg(sig.a);
                if (antes !== 0 && despues === 0) ev.push({ t: seg.t1, tipo: 'para' });
                else if (antes !== 0 && despues !== 0 && antes !== despues) ev.push({ t: seg.t1, tipo: 'cambia' });
            }
        }
        return ev;
    }
}

// Movimiento grabado con el ratón, el dedo o el teclado («Muévelo tú»).
// La velocidad se calcula como la pendiente de la posición en el último cuarto
// de segundo (como hace un sensor de movimiento real); la aceleración no se calcula.
class MovimientoGrabado {
    constructor(x0) {
        this.tipo = 'mano';
        this.analitico = false;
        this.fin = 'tiempo';
        this.xIni = x0;
        this.m = { t: [0], x: [x0], v: [0], a: [0], s: [0] };
        this.T = 0;
        this.eventos = [];
    }

    agregar(t, x) {
        const m = this.m;
        const n = m.t.length;
        if (t <= m.t[n - 1] + 1e-6) return;
        const VENTANA = 0.25;
        let j = n - 1;
        while (j > 0 && t - m.t[j] < VENTANA) j--;
        const v = (x - m.x[j]) / (t - m.t[j]);
        m.t.push(t); m.x.push(x); m.v.push(v); m.a.push(0);
        m.s.push(m.s[n - 1] + Math.abs(x - m.x[n - 1]));
        this.T = t;
    }

    at(t) {
        const m = this.m;
        t = Math.max(0, Math.min(this.T, t));
        return { x: interpolar(m.t, m.x, t), v: interpolar(m.t, m.v, t), a: null };
    }

    dist(t) { return interpolar(this.m.t, this.m.s, Math.max(0, Math.min(this.T, t))); }
}

// Interpolación lineal en una tabla ordenada (ts puede repetir valores en los saltos).
function interpolar(ts, ys, t) {
    const n = ts.length;
    if (n === 1 || t <= ts[0]) return ys[0];
    if (t >= ts[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (ts[mid] <= t) lo = mid; else hi = mid;
    }
    const dt = ts[hi] - ts[lo];
    if (dt <= 0) return ys[hi];
    return ys[lo] + (ys[hi] - ys[lo]) * (t - ts[lo]) / dt;
}
