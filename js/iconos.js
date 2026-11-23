/* ==========================================================
   iconos.js · Iconos SVG reutilizables de la interfaz
   ========================================================== */

(function () {
  "use strict";

  var FORMAS = {
    abrir: [["path", { d: "M14 3h7v7M10 14 21 3" }], ["path", { d: "M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" }]],
    bajar: [["path", { d: "M12 4v15m0 0 6-6m-6 6-6-6" }]],
    calendarioAnterior: [["path", { d: "m14 18-6-6 6-6" }]],
    calendarioSiguiente: [["path", { d: "m10 18 6-6-6-6" }]],
    duplicar: [["rect", { x: "8", y: "8", width: "13", height: "13", rx: "2" }], ["path", { d: "M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" }]],
    editar: [["path", { d: "m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" }]],
    estrella: [["path", { d: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" }]],
    estrellaLlena: [["path", { d: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z", fill: "currentColor" }]],
    papel: [["path", { d: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" }]],
    subir: [["path", { d: "M12 20V5m0 0 6 6m-6-6-6 6" }]],
    basura: [["path", { d: "M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" }]],
    usar: [["path", { d: "M4 12h15m0 0-6-6m6 6-6 6" }]]
  };

  function crear(nombre, clase) {
    var formas = FORMAS[nombre];
    if (!formas) { throw new Error("Icono no definido: " + nombre); }
    var icono = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icono.setAttribute("class", "icono-ui" + (clase ? " " + clase : ""));
    icono.setAttribute("viewBox", "0 0 24 24");
    icono.setAttribute("aria-hidden", "true");
    icono.setAttribute("focusable", "false");
    formas.forEach(function (forma) {
      var elemento = document.createElementNS("http://www.w3.org/2000/svg", forma[0]);
      Object.keys(forma[1]).forEach(function (atributo) {
        elemento.setAttribute(atributo, forma[1][atributo]);
      });
      icono.appendChild(elemento);
    });
    return icono;
  }

  window.adepIconos = { crear: crear };
})();
