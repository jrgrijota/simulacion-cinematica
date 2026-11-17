# Gráficas del Movimiento — Simulación Interactiva

Simulación para **Física y Química de la ESO** (2.º, 3.º y 4.º) sobre el movimiento rectilíneo
uniforme (**MRU**) y uniformemente acelerado (**MRUA**). Un móvil (coche o persona) avanza por una
pista recta y, a la vez, se dibujan en vivo sus gráficas **posición–tiempo**, **velocidad–tiempo** y
**aceleración–tiempo**.

## Modos

- **Explorar:** elige MRU o MRUA, ajusta la posición inicial, la velocidad y la aceleración (o un
  ejemplo de la vida diaria) y mira cómo se dibujan las gráficas. Opciones para ver la pendiente de
  la x‑t (velocidad), el área bajo la v‑t (desplazamiento), dejar la gráfica anterior en gris y
  pausar en los momentos clave (cuando el móvil se para o cambia de sentido).
- **Retos:** 10 gráficas que hay que reproducir construyendo el movimiento por tramos. Los cinco
  primeros son de MRU (2.º ESO) y los cinco últimos de MRUA (4.º ESO). Al comprobar, la simulación
  dice dónde y por qué se separan las gráficas; tras dos intentos fallidos se puede ver una
  solución. También hay un modo libre para preparar ejemplos de clase.
- **Muévelo tú:** el alumno arrastra el móvil con el ratón, el dedo o las flechas del teclado y ve
  su propia gráfica x‑t y v‑t. Puede intentar seguir una gráfica dentro de una franja.

## Criterio didáctico

- Las gráficas **no son la trayectoria**: el móvil siempre va en línea recta, se vea como se vea la
  gráfica. Por eso pista y gráficas comparten el eje del tiempo y un cursor común.
- Ejes con escala fija (x de −20 a 100 m, v de −10 a 10 m/s, a de −3 a 3 m/s²) para que las
  gráficas se puedan comparar entre sí.
- En el MRU por tramos la velocidad cambia de golpe; no se dibuja la a‑t porque la aceleración
  sería infinita un instante, y la simulación lo explica.
- Las posiciones y velocidades se calculan con las ecuaciones exactas del MRU y del MRUA, sin
  integración numérica.

## Uso

Abre `index.html` en un navegador. No necesita instalación ni conexión: incluye
[p5.js](https://p5js.org/) en `js/vendor/`. Incluye temas SimulaCiencia, oscuro, claro y alto
contraste (botón del engranaje). Con `?lang=en` en la dirección se muestra en inglés, con
`?lang=ca`, en catalán, con `?lang=eu`, en euskera, y con `?lang=gl`, en gallego.

Teclado (con la simulación seleccionada): barra espaciadora para iniciar o pausar, `R` para
reiniciar y flechas para mover el cursor del tiempo (o el móvil en «Muévelo tú»).

### Parámetros de la URL

Sirven para que el profesorado y las fichas de actividades abran la simulación ya preparada.

| Parámetro | Valores | Ejemplo |
|---|---|---|
| `modo` | `explorar`, `retos`, `mano` | `?modo=retos` |
| `tipo` | `mru`, `mrua` | `?tipo=mrua` |
| `ejemplo` | `paseo`, `corre`, `calle`, `vuelve`, `marcha`, `arranca`, `semaforo`, `sube` | `?ejemplo=semaforo` |
| `x0`, `v`, `a` | números | `?tipo=mrua&x0=0&v=8&a=-1` |
| `para` | `1` | `?tipo=mrua&v=10&a=-2&para=1` |
| `reto` | `1` a `10` o `libre` | `?modo=retos&reto=3` |
| `tramos` | duración:valor, separados por comas | `?modo=retos&reto=libre&tramos=6:5,6:0,8:2.5` |
| `seguir` | `0` a `3` | `?modo=mano&seguir=2` |
| `movil` | `coche`, `persona` | `?movil=persona` |
| `graficas` | letras `x`, `v`, `a` | `?graficas=xv` |
| `marcas`, `pendiente`, `area`, `anterior`, `pausar` | `1` o `0` | `?pendiente=1&area=1` |
| `velocidad` | `0.5`, `1`, `2` | `?velocidad=0.5` |
| `tema` | `simulaciencia`, `oscuro`, `claro`, `contraste` | `?tema=claro` |

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Panel de controles de los tres modos |
| `css/style.css` | Estilos y temas (mismo sistema visual que el resto de simulaciones) |
| `js/movimiento.js` | Modelo del movimiento por tramos (MRU y MRUA) y movimiento grabado a mano |
| `js/retos.js` | Los 10 retos, las gráficas que seguir y la comparación con mensajes de ayuda |
| `js/sketch.js` | Pista, gráficas, controles, tabla de valores, ecuaciones y temas |
| `js/parametros.js` | Lectura de los parámetros de la URL |
| `js/i18n.js`, `js/i18n-en.js`, `js/i18n-ca.js`, `js/i18n-eu.js`, `js/i18n-gl.js` | Idioma de la interfaz (`?lang=en`, `?lang=ca`, `?lang=eu`, `?lang=gl`) y traducciones al inglés, al catalán, al euskera y al gallego |
| `js/sello.js`, `js/estadisticas.js` | Sello de simulaciencia.es y estadísticas anónimas de visitas |

## Licencia

Código bajo licencia MIT (`LICENSE`); textos e imágenes bajo CC BY 4.0 (`LICENSE-CONTENT.md`).
