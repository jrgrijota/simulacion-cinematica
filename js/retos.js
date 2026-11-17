'use strict';
// ═══════════════════════════════════════════════════════════════════
//  RETOS: gráficas que hay que reproducir
//
//  Cada reto es un movimiento por tramos con valores enteros (o de media
//  unidad) para que se puedan leer en la cuadrícula. El alumno ve solo la
//  gráfica objetivo (x‑t o v‑t) y los datos que esa gráfica no da.
//  Los textos están en español; se traducen con i18n.t() al mostrarlos.
// ═══════════════════════════════════════════════════════════════════

const RETOS = [
    // ── MRU · 2.º ESO ──
    {
        nombre: 'Paseo', tipo: 'mru', objetivo: 'x', x0: 0,
        tramos: [{ dur: 20, v: 2 }],
        historia: 'Sales de casa (x = 0) y paseas en línea recta, siempre al mismo ritmo.',
        pista: 'Mira cuántos metros sube la gráfica en cada segundo: esa es la velocidad.',
    },
    {
        nombre: 'Ida y vuelta', tipo: 'mru', objetivo: 'x', x0: 0,
        tramos: [{ dur: 10, v: 4 }, { dur: 10, v: -4 }],
        historia: 'Vas hasta la casa de un amigo y vuelves por el mismo camino, sin pararte.',
        pista: 'Cuando la gráfica baja, la posición disminuye: el móvil vuelve hacia el origen y su velocidad es negativa.',
    },
    {
        nombre: 'Parada en el quiosco', tipo: 'mru', objetivo: 'x', x0: 0,
        tramos: [{ dur: 6, v: 5 }, { dur: 6, v: 0 }, { dur: 8, v: 2.5 }],
        historia: 'Vas al quiosco, te paras a comprar y sigues hasta el parque.',
        pista: 'Un tramo horizontal en la x‑t significa que la posición no cambia: velocidad 0. Estar parado también es un tramo.',
    },
    {
        nombre: 'Vuelta a casa', tipo: 'mru', objetivo: 'x', x0: 80,
        tramos: [{ dur: 6, v: -10 }, { dur: 4, v: 0 }, { dur: 10, v: -3 }],
        historia: 'Sales de casa de tu amiga, en x = 80 m, y vuelves hacia la tuya, que está al otro lado del origen.',
        pista: 'En el primer tramo la gráfica baja de 80 m a 20 m en 6 s: ¿cuántos metros por segundo? ¿Con qué signo?',
    },
    {
        nombre: 'De la velocidad a la posición', tipo: 'mru', objetivo: 'v', x0: 10,
        tramos: [{ dur: 5, v: 6 }, { dur: 5, v: 0 }, { dur: 10, v: -3 }],
        historia: 'Ahora la gráfica del reto es la v‑t.',
        dato: 'El móvil sale de x = 10 m.',
        pista: 'En una v‑t de MRU cada tramo horizontal te da directamente la velocidad. La v‑t no dice dónde empieza el móvil: por eso lo da el enunciado.',
    },
    // ── MRUA · 4.º ESO ──
    {
        nombre: 'Arranca el coche', tipo: 'mrua', objetivo: 'v', x0: 0, v0: 0,
        tramos: [{ dur: 8, a: 1 }, { dur: 8, a: 0 }],
        historia: 'Un coche parado arranca, acelera y después mantiene la velocidad.',
        dato: 'Sale de x = 0.',
        pista: 'La pendiente de la v‑t es la aceleración: ¿cuántos m/s gana el coche en cada segundo del primer tramo?',
    },
    {
        nombre: 'Frena en el semáforo', tipo: 'mrua', objetivo: 'x', x0: 0, v0: 10,
        tramos: [{ dur: 5, a: -2 }, { dur: 15, a: 0 }],
        historia: 'Un coche circula por una calle, ve el semáforo en rojo, frena hasta pararse y espera.',
        pista: 'Activa «Pendiente de x‑t» y lleva el cursor a t = 0 para leer la velocidad inicial. Se para cuando la gráfica se vuelve horizontal.',
    },
    {
        nombre: 'La montaña', tipo: 'mrua', objetivo: 'x', x0: 0, v0: 8,
        tramos: [{ dur: 16, a: -1 }],
        historia: 'La gráfica parece una montaña, pero el movimiento es en línea recta: el móvil avanza cada vez más despacio, se para y vuelve.',
        pista: 'La cima de la gráfica es el instante en que v = 0. Si la velocidad pasa de v₀ a 0 en 8 s, ¿cuánto cambia en cada segundo?',
    },
    {
        nombre: 'Acelera y frena', tipo: 'mrua', objetivo: 'v', x0: 0, v0: 0,
        tramos: [{ dur: 4, a: 2 }, { dur: 6, a: 0 }, { dur: 4, a: -2 }, { dur: 6, a: 0 }],
        historia: 'Un tren sale de una estación, acelera, va a velocidad constante y frena hasta pararse en la siguiente.',
        dato: 'Sale de x = 0.',
        pista: 'Cuenta los tramos: sube, recto, baja y recto en cero. La pendiente de cada tramo es su aceleración.',
    },
    {
        nombre: 'Marcha atrás', tipo: 'mrua', objetivo: 'v', x0: 60, v0: 0,
        tramos: [{ dur: 4, a: -2 }, { dur: 4, a: 0 }, { dur: 4, a: 2 }, { dur: 8, a: 0 }],
        historia: 'Un coche aparcado da marcha atrás acelerando, mantiene la velocidad y frena hasta pararse.',
        dato: 'Sale de x = 60 m.',
        pista: 'La velocidad es negativa todo el rato porque se mueve hacia el origen. En el tercer tramo frena aunque su aceleración sea positiva: ¿por qué?',
    },
];

// Gráficas x‑t que seguir en «Muévelo tú» (MRU a velocidades que se pueden hacer con la mano).
const SEGUIR = [
    null,
    { x0: 0,  tramos: [{ dur: 4, v: 0 }, { dur: 8, v: 5 }, { dur: 8, v: 0 }] },
    { x0: 10, tramos: [{ dur: 8, v: 5 }, { dur: 4, v: 0 }, { dur: 8, v: -5 }] },
    { x0: 0,  tramos: [{ dur: 6, v: 2 }, { dur: 6, v: 6 }, { dur: 8, v: -3 }] },
];
const FRANJA = 3;   // m: margen a cada lado de la gráfica que seguir

const TOL = { x: 1, v: 0.25 };   // margen para dar un reto por superado

function movimientoDeReto(r) {
    return crearMovimiento({ tipo: r.tipo, x0: r.x0, v0: r.v0 || 0, tramos: r.tramos });
}

// Compara el movimiento del alumno con el del reto en la gráfica objetivo.
// Devuelve { ok, msg } con un mensaje que traduce la diferencia a lenguaje de movimiento.
function compararReto(alumno, reto, objetivo) {
    const k = reto.objetivo;
    const tol = TOL[k];
    const fmt = (t) => { const r = Math.round(t * 2) / 2; return i18n.num(r, r % 1 ? 1 : 0); };
    const T = objetivo.T;
    const PASO = 0.05;

    for (let t = 0; t <= T + 1e-9; t += PASO) {
        const tt = Math.min(t, T);
        if (tt > alumno.T + 1e-6) {
            if (alumno.fin === 'borde') return { ok: false, msg: i18n.t('Tu móvil ha llegado al final de la pista en t = {t} s. Revisa el sentido y la rapidez de los tramos.', { t: fmt(alumno.T) }) };
            return { ok: false, msg: i18n.t('Tu movimiento dura {ta} s y el del reto, {tr} s: faltan segundos. ¿Has contado los tramos en los que está parado?', { ta: fmt(alumno.T), tr: fmt(T) }) };
        }
        const a = alumno.at(tt), o = objetivo.at(tt);
        if (Math.abs(a[k] - o[k]) <= tol) continue;

        // Primera diferencia: ¿al principio, en la rapidez, en el sentido o en el momento del cambio?
        // «Desde el principio» o «Hacia t = 7 s»
        const tx = tt < 1.01 ? i18n.t('Desde el principio') : i18n.t('Hacia t = {t} s', { t: fmt(tt) });
        if (tt < 0.06) {
            return { ok: false, msg: k === 'x'
                ? i18n.t('Tu gráfica no empieza en el mismo punto que la del reto: revisa la posición inicial.')
                : i18n.t('Tu gráfica no empieza en el mismo valor que la del reto: revisa la velocidad del principio.') };
        }
        // Mira un poco antes de separarse, donde todavía coincidían
        const tm = Math.max(0, tt - PASO / 2);
        const am = alumno.at(tm), om = objetivo.at(tm);
        if (k === 'x') {
            const va = am.v, vo = om.v;
            if (Math.abs(vo) < 1e-6 && Math.abs(va) > 1e-6)
                return { ok: false, msg: i18n.t('{cuando}, el móvil del reto está parado y el tuyo se mueve.', { cuando: tx }) };
            if (Math.abs(va) < 1e-6 && Math.abs(vo) > 1e-6)
                return { ok: false, msg: i18n.t('{cuando}, tu móvil está parado y el del reto se mueve.', { cuando: tx }) };
            if (Math.sign(va) !== Math.sign(vo))
                return { ok: false, msg: i18n.t('{cuando}, tu móvil va en sentido contrario al del reto: revisa el signo de la velocidad.', { cuando: tx }) };
            if (Math.abs(va) > Math.abs(vo) + 1e-6)
                return { ok: false, msg: vo > 0
                    ? i18n.t('{cuando}, tu gráfica sube más deprisa que la del reto: tu móvil va demasiado rápido.', { cuando: tx })
                    : i18n.t('{cuando}, tu gráfica baja más deprisa que la del reto: tu móvil va demasiado rápido.', { cuando: tx }) };
            if (Math.abs(va) < Math.abs(vo) - 1e-6)
                return { ok: false, msg: vo > 0
                    ? i18n.t('{cuando}, tu gráfica sube más despacio que la del reto: tu móvil va demasiado lento.', { cuando: tx })
                    : i18n.t('{cuando}, tu gráfica baja más despacio que la del reto: tu móvil va demasiado lento.', { cuando: tx }) };
            return { ok: false, msg: i18n.t('{cuando}, las gráficas se separan: revisa cuánto dura cada tramo.', { cuando: tx }) };
        }
        // Gráfica v‑t
        if (reto.tipo === 'mrua') {
            const aa = am.a, ao = om.a;
            if (Math.abs(aa - ao) > 1e-6) {
                return { ok: false, msg: aa > ao
                    ? i18n.t('{cuando}, tu gráfica v‑t es más inclinada hacia arriba que la del reto: tu aceleración es mayor de la necesaria.', { cuando: tx })
                    : i18n.t('{cuando}, tu gráfica v‑t es más inclinada hacia abajo que la del reto: tu aceleración es menor de la necesaria.', { cuando: tx }) };
            }
        }
        // Se compara la rapidez (sin signo) y el sentido: «mayor» con números negativos confunde
        if (Math.abs(o.v) < 1e-6) return { ok: false, msg: i18n.t('{cuando}, el móvil del reto está parado y el tuyo se mueve.', { cuando: tx }) };
        if (Math.abs(a.v) < 1e-6) return { ok: false, msg: i18n.t('{cuando}, tu móvil está parado y el del reto se mueve.', { cuando: tx }) };
        if (Math.sign(a.v) !== Math.sign(o.v)) return { ok: false, msg: i18n.t('{cuando}, tu móvil va en sentido contrario al del reto: revisa el signo de la velocidad.', { cuando: tx }) };
        return { ok: false, msg: Math.abs(a.v) > Math.abs(o.v)
            ? i18n.t('{cuando}, tu móvil va más rápido que el del reto. Revisa el valor y la duración de ese tramo.', { cuando: tx })
            : i18n.t('{cuando}, tu móvil va más despacio que el del reto. Revisa el valor y la duración de ese tramo.', { cuando: tx }) };
    }
    return { ok: true, msg: i18n.t('Tu gráfica coincide con la del reto.') };
}

// Progreso guardado en el navegador (solo en este equipo).
const CLAVE_RETOS = 'sim-cinematica-retos';
function retosSuperados() {
    try { return JSON.parse(localStorage.getItem(CLAVE_RETOS)) || []; } catch (e) { return []; }
}
function marcarSuperado(n) {
    try {
        const s = new Set(retosSuperados());
        s.add(n);
        localStorage.setItem(CLAVE_RETOS, JSON.stringify([...s]));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
}
