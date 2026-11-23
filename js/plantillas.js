/* ==========================================================
   plantillas.js · Creador, uso y descarga de plantillas propias
   ========================================================== */

(function () {
  "use strict";

  var CLAVE_PLANTILLAS = "adep-plantillas-v1";
  var CLAVE_FAVORITAS_PREDETERMINADAS = "adep-plantillas-predeterminadas-favoritas-v1";
  var CLAVE_BORRADOR_PLANTILLA = "adep-borrador-plantilla-v1";
  var CLAVE_BORRADOR_DOCUMENTO = "adep-borrador-documento-";
  var LIMITE_BLOQUES = 20;
  var ESPACIADO_PREDETERMINADO = 2;
  var TIPOS = {
    titulo: "Título",
    subtitulo: "Subtítulo",
    seccion: "Encabezado de sección",
    texto: "Texto para completar",
    linea: "Campo con raya",
    doble: "Dos campos en una línea"
  };
  var plantillas = leerPlantillas();
  var bloques = [];
  var bloqueSeleccionadoId = null;
  var plantillaEnEdicion = null;
  var plantillaActual = null;
  var valoresActuales = {};
  var documentoActualId = null;
  var temporizadorVista = 0;
  var firmaBasePlantilla = "";
  var firmaBaseDocumento = "";
  var temporizadorBorradorPlantilla = 0;
  var temporizadorBorradorDocumento = 0;
  var consultaPlantillas = "";
  var favoritasPredeterminadas = leerFavoritasPredeterminadas();

  var listaPlantillas = document.getElementById("lista-plantillas-personalizadas");
  var formularioPlantilla = document.getElementById("formulario-plantilla");
  var formularioDocumento = document.getElementById("formulario-documento-personalizado");
  var vistaMolde = document.getElementById("vista-plantilla-creador");
  var vistaDocumento = document.getElementById("vista-personalizada");

  function leerFavoritasPredeterminadas() {
    try {
      var guardadas = JSON.parse(localStorage.getItem(CLAVE_FAVORITAS_PREDETERMINADAS) || "[]");
      return Array.isArray(guardadas) ? guardadas.filter(function (id) { return typeof id === "string"; }) : [];
    } catch (error) {
      console.error("No se pudieron leer las plantillas predeterminadas favoritas:", error);
      return [];
    }
  }

  function ordenarPlantillasPredeterminadas(contenedor) {
    var hijos = Array.prototype.slice.call(contenedor.children);
    var elementos = hijos.filter(function (elemento) {
      return elemento.hasAttribute("data-favorita-predeterminada");
    });
    var noPlantillas = hijos.filter(function (elemento) {
      return !elemento.hasAttribute("data-favorita-predeterminada");
    });
    elementos.sort(function (a, b) {
      return Number(favoritasPredeterminadas.indexOf(b.getAttribute("data-favorita-predeterminada")) !== -1)
        - Number(favoritasPredeterminadas.indexOf(a.getAttribute("data-favorita-predeterminada")) !== -1);
    });
    var referencia = noPlantillas[0] || null;
    elementos.forEach(function (elemento) { contenedor.insertBefore(elemento, referencia); });
  }

  function actualizarFavoritasPredeterminadas(contenedor) {
    contenedor.querySelectorAll("[data-favorita-predeterminada]").forEach(function (elemento) {
      var favorita = favoritasPredeterminadas.indexOf(elemento.getAttribute("data-favorita-predeterminada")) !== -1;
      var boton = elemento.querySelector("[data-accion-favorito-predeterminado]");
      if (!boton) { return; }
      var titulo = elemento.querySelector(".tarjeta__titulo").textContent;
      boton.setAttribute("aria-pressed", String(favorita));
      var etiqueta = (favorita ? "Quitar " : "Agregar ") + titulo + (favorita ? " de" : " a") + " favoritos";
      boton.setAttribute("aria-label", etiqueta);
      boton.setAttribute("title", etiqueta);
      boton.classList.toggle("boton-favorito-predeterminado--activo", favorita);
      var forma = boton.querySelector("path");
      if (forma) { forma.setAttribute("fill", favorita ? "currentColor" : "none"); }
    });
    ordenarPlantillasPredeterminadas(contenedor);
  }

  function alternarFavoritaPredeterminada(elemento) {
    var id = elemento.getAttribute("data-favorita-predeterminada");
    var indice = favoritasPredeterminadas.indexOf(id);
    var anteriores = favoritasPredeterminadas.slice();
    if (indice === -1) { favoritasPredeterminadas.push(id); }
    else { favoritasPredeterminadas.splice(indice, 1); }
    try {
      localStorage.setItem(CLAVE_FAVORITAS_PREDETERMINADAS, JSON.stringify(favoritasPredeterminadas));
    } catch (error) {
      favoritasPredeterminadas = anteriores;
      console.error("No se pudo guardar la preferencia de plantillas favoritas:", error);
      window.dialogosApp.aviso("No se pudo guardar el favorito", "Comprueba el espacio disponible en el dispositivo e inténtalo de nuevo.");
      return;
    }
    document.querySelectorAll("[data-favorita-predeterminada=\"" + id + "\"]").forEach(function (coincidencia) {
      actualizarFavoritasPredeterminadas(coincidencia.parentElement);
    });
  }

  function nuevoId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function leerPlantillas() {
    try {
      var guardadas = JSON.parse(localStorage.getItem(CLAVE_PLANTILLAS) || "[]");
      return Array.isArray(guardadas) ? guardadas.filter(function (item) {
        return item && typeof item.id === "string" && Array.isArray(item.bloques);
      }) : [];
    } catch (error) {
      console.error("No se pudieron leer las plantillas guardadas:", error);
      return [];
    }
  }

  function guardarPlantillas() {
    try {
      localStorage.setItem(CLAVE_PLANTILLAS, JSON.stringify(plantillas));
      return true;
    } catch (error) {
      console.error("No se pudieron guardar las plantillas:", error);
      window.dialogosApp.aviso("No se pudo guardar", "Comprueba el espacio disponible en el dispositivo e inténtalo de nuevo.");
      return false;
    }
  }

  function agregarTexto(padre, etiqueta, clase, texto) {
    var elemento = document.createElement(etiqueta);
    if (clase) { elemento.className = clase; }
    if (texto) { elemento.textContent = texto; }
    padre.appendChild(elemento);
    return elemento;
  }

  function guardarBloquesDesdeEditor() {
    bloques = Array.prototype.slice.call(document.querySelectorAll(".bloque-plantilla")).map(function (tarjeta) {
      var bloque = {
        id: tarjeta.getAttribute("data-id"),
        tipo: tarjeta.getAttribute("data-tipo"),
        negrita: tarjeta.querySelector('[data-prop="negrita"]').checked,
        cursiva: tarjeta.querySelector('[data-prop="cursiva"]').checked,
        alineacion: tarjeta.getAttribute("data-alineacion") || alineacionPredeterminada(tarjeta.getAttribute("data-tipo")),
        tamano: Number(tarjeta.getAttribute("data-tamano")) || tamanoPredeterminado(tarjeta.getAttribute("data-tipo"))
      };
      bloque.etiqueta = tarjeta.querySelector('[data-prop="etiqueta"]').value.trim();
      if (bloque.tipo === "doble") {
        bloque.etiquetaDerecha = tarjeta.querySelector('[data-prop="etiquetaDerecha"]').value.trim();
      }
      return bloque;
    });
  }

  function capturarEditorPlantilla() {
    guardarBloquesDesdeEditor();
    return {
      nombre: document.getElementById("nombre-plantilla").value,
      papel: document.querySelector('input[name="papel-plantilla"]:checked').value,
      espaciado: Number(document.getElementById("espaciado-plantilla").value),
      margenes: {
        superior: Number(document.getElementById("margen-superior-plantilla").value),
        lateral: Number(document.getElementById("margen-lateral-plantilla").value),
        inferior: Number(document.getElementById("margen-inferior-plantilla").value)
      },
      tamanoTexto: Number(document.getElementById("tamano-texto-plantilla").value),
      logo: {
        tamano: document.getElementById("tamano-logo").value,
        posicion: document.getElementById("posicion-logo").value
      },
      bloques: bloques.map(function (bloque) {
        return {
          id: bloque.id,
          tipo: bloque.tipo,
          etiqueta: bloque.etiqueta,
          etiquetaDerecha: bloque.etiquetaDerecha || "",
          negrita: !!bloque.negrita,
          cursiva: !!bloque.cursiva,
          alineacion: bloque.alineacion,
          tamano: bloque.tamano
        };
      })
    };
  }

  function firmaEditorPlantilla() { return JSON.stringify(capturarEditorPlantilla()); }

  function guardarBorradorPlantilla() {
    if (!document.getElementById("pantalla-crear-plantilla").classList.contains("pantalla--activa")) { return; }
    var borrador = capturarEditorPlantilla();
    try {
      if (JSON.stringify(borrador) === firmaBasePlantilla) {
        localStorage.removeItem(CLAVE_BORRADOR_PLANTILLA);
        return;
      }
      borrador.plantillaId = plantillaEnEdicion;
      localStorage.setItem(CLAVE_BORRADOR_PLANTILLA, JSON.stringify(borrador));
      document.getElementById("estado-borrador").textContent = "Borrador de plantilla guardado en este dispositivo.";
    } catch (error) {
      console.error("No se pudo guardar el borrador de plantilla:", error);
      document.getElementById("estado-borrador").textContent = "No se pudo guardar el borrador de plantilla; revisa el espacio disponible.";
    }
  }

  function programarBorradorPlantilla() {
    window.clearTimeout(temporizadorBorradorPlantilla);
    temporizadorBorradorPlantilla = window.setTimeout(guardarBorradorPlantilla, 300);
  }

  function firmaValoresDocumento() { return JSON.stringify(valoresActuales); }

  function claveBorradorDocumento(plantilla) { return CLAVE_BORRADOR_DOCUMENTO + plantilla.id; }

  function guardarBorradorDocumento() {
    if (!plantillaActual || !document.getElementById("pantalla-editor-personalizada").classList.contains("pantalla--activa")) { return; }
    try {
      if (firmaValoresDocumento() === firmaBaseDocumento && !documentoActualId) {
        localStorage.removeItem(claveBorradorDocumento(plantillaActual));
        return;
      }
      localStorage.setItem(claveBorradorDocumento(plantillaActual), JSON.stringify({
        documentoId: documentoActualId,
        valores: valoresActuales,
        actualizado: new Date().toISOString()
      }));
      document.getElementById("estado-borrador").textContent = "Borrador del documento guardado en este dispositivo.";
    } catch (error) {
      console.error("No se pudo guardar el borrador del documento:", error);
      document.getElementById("estado-borrador").textContent = "No se pudo guardar el borrador del documento; revisa el espacio disponible.";
    }
  }

  function programarBorradorDocumento() {
    window.clearTimeout(temporizadorBorradorDocumento);
    temporizadorBorradorDocumento = window.setTimeout(guardarBorradorDocumento, 250);
  }

  function tamanoPredeterminado(tipo) {
    if (tipo === "titulo") { return 13; }
    if (tipo === "subtitulo") { return 10.5; }
    if (tipo === "seccion") { return 11; }
    return 9.5;
  }

  function alineacionPredeterminada(tipo) {
    return tipo === "titulo" || tipo === "subtitulo" ? "center" : "left";
  }

  function normalizarAlineacion(valor, tipo) {
    return ["left", "center", "right"].indexOf(valor) !== -1 ? valor : alineacionPredeterminada(tipo);
  }

  function normalizarTamano(valor, tipo) {
    var tamano = Number(valor);
    return Number.isFinite(tamano) && tamano >= 6 && tamano <= 24 ? tamano : tamanoPredeterminado(tipo);
  }

  function crearCampoConfiguracion(bloque, propiedad, valor, etiqueta) {
    var envoltura = document.createElement("label");
    envoltura.className = "bloque-plantilla__campo";
    envoltura.appendChild(document.createTextNode(etiqueta));
    var entrada = document.createElement("input");
    entrada.type = "text";
    entrada.maxLength = 100;
    entrada.value = valor;
    entrada.setAttribute("data-prop", propiedad);
    entrada.setAttribute("aria-label", etiqueta);
    envoltura.appendChild(entrada);
    bloque.appendChild(envoltura);
    return entrada;
  }

  function pintarBloques() {
    var contenedor = document.getElementById("lista-bloques-plantilla");
    contenedor.replaceChildren();
    var grupoActual = null;
    function crearGrupo(titulo, clase) {
      grupoActual = agregarTexto(contenedor, "section", "grupo-bloques-plantilla " + clase);
      var cabeceraGrupo = agregarTexto(grupoActual, "div", "grupo-bloques-plantilla__cabecera");
      agregarTexto(cabeceraGrupo, "span", "grupo-bloques-plantilla__etiqueta", titulo);
      var listaGrupo = agregarTexto(grupoActual, "div", "grupo-bloques-plantilla__elementos");
      return listaGrupo;
    }
    if (!bloques.length) {
      agregarTexto(contenedor, "p", "lista-bloques__vacio", "Todavía no hay elementos. Elija un tipo arriba y presione «Agregar» para comenzar.");
    }
    bloques.forEach(function (datos, indice) {
      if (datos.tipo === "seccion") {
        grupoActual = crearGrupo("SECCIÓN", "grupo-bloques-plantilla--seccion");
      } else if (!grupoActual) {
        grupoActual = crearGrupo("CAMPOS GENERALES", "grupo-bloques-plantilla--general");
      }
      var tarjeta = document.createElement("article");
      tarjeta.className = "bloque-plantilla";
      tarjeta.setAttribute("data-id", datos.id);
      tarjeta.setAttribute("data-tipo", datos.tipo);
      tarjeta.setAttribute("data-alineacion", normalizarAlineacion(datos.alineacion, datos.tipo));
      tarjeta.setAttribute("data-tamano", String(normalizarTamano(datos.tamano, datos.tipo)));
      tarjeta.classList.toggle("bloque-plantilla--seleccionado", datos.id === bloqueSeleccionadoId);

      var cabecera = agregarTexto(tarjeta, "div", "bloque-plantilla__cabecera");
      agregarTexto(cabecera, "strong", "", (indice + 1) + ". " + TIPOS[datos.tipo]);

      var acciones = agregarTexto(cabecera, "div", "bloque-plantilla__acciones");
      [
        { icono: "subir", accion: "subir", nombre: "Subir" },
        { icono: "bajar", accion: "bajar", nombre: "Bajar" },
        { icono: "basura", accion: "quitar", nombre: "Quitar" }
      ].forEach(function (opcion) {
        var boton = agregarTexto(acciones, "button", "boton-orden-bloque");
        boton.appendChild(window.adepIconos.crear(opcion.icono));
        boton.type = "button";
        boton.setAttribute("data-accion-bloque", opcion.accion);
        boton.setAttribute("aria-label", opcion.nombre + " " + TIPOS[datos.tipo].toLowerCase());
        boton.disabled = (opcion.accion === "subir" && indice === 0)
          || (opcion.accion === "bajar" && indice === bloques.length - 1);
      });

      if (datos.tipo === "titulo" || datos.tipo === "subtitulo" || datos.tipo === "seccion") {
        crearCampoConfiguracion(tarjeta, "etiqueta", datos.etiqueta, "Texto fijo");
      } else if (datos.tipo === "doble") {
        crearCampoConfiguracion(tarjeta, "etiqueta", datos.etiqueta, "Etiqueta izquierda");
        crearCampoConfiguracion(tarjeta, "etiquetaDerecha", datos.etiquetaDerecha, "Etiqueta derecha");
      } else {
        crearCampoConfiguracion(tarjeta, "etiqueta", datos.etiqueta, "Etiqueta del campo");
      }

      var estilo = agregarTexto(tarjeta, "div", "bloque-plantilla__estilo");
      [
        { propiedad: "negrita", texto: "Negrita", valor: datos.negrita },
        { propiedad: "cursiva", texto: "Cursiva", valor: datos.cursiva }
      ].forEach(function (opcion) {
        var etiqueta = document.createElement("label");
        var casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = !!opcion.valor;
        casilla.setAttribute("data-prop", opcion.propiedad);
        etiqueta.appendChild(casilla);
        etiqueta.appendChild(document.createTextNode(" " + opcion.texto));
        estilo.appendChild(etiqueta);
      });
      grupoActual.appendChild(tarjeta);
    });
    document.getElementById("aviso-limite-bloques").textContent =
      bloques.length >= LIMITE_BLOQUES ? "Llegaste al límite de 20 elementos para esta plantilla." : "";
    document.getElementById("agregar-bloque").disabled = bloques.length >= LIMITE_BLOQUES;
    if (!bloques.some(function (bloque) { return bloque.id === bloqueSeleccionadoId; })) {
      bloqueSeleccionadoId = bloques.length ? bloques[0].id : null;
    }
    actualizarInspectorSeleccionado();
    programarVistaMolde();
  }

  function actualizarInspectorSeleccionado() {
    var bloque = bloques.find(function (item) { return item.id === bloqueSeleccionadoId; });
    var tamano = document.getElementById("tamano-elemento-plantilla");
    var acciones = document.querySelectorAll("[data-alinear], #subir-elemento, #bajar-elemento");
    tamano.disabled = !bloque;
    acciones.forEach(function (accion) { accion.disabled = !bloque; });
    document.getElementById("ayuda-seleccion-elemento").textContent = bloque
      ? "Editando " + TIPOS[bloque.tipo].toLocaleLowerCase("es") + ". Los cambios también se reflejan en el PDF."
      : "Agregue un elemento y selecciónelo para ajustar su tamaño y alineación.";
    if (!bloque) { return; }
    var valorTamano = normalizarTamano(bloque.tamano, bloque.tipo);
    tamano.value = String(valorTamano);
    document.getElementById("valor-tamano-elemento").textContent = formatoTamano(valorTamano);
    var alineacion = normalizarAlineacion(bloque.alineacion, bloque.tipo);
    document.querySelectorAll("[data-alinear]").forEach(function (boton) {
      var elegido = boton.getAttribute("data-alinear") === alineacion;
      boton.classList.toggle("boton-alineacion--activo", elegido);
      boton.setAttribute("aria-pressed", String(elegido));
    });
    var indice = bloques.findIndex(function (item) { return item.id === bloque.id; });
    document.getElementById("subir-elemento").disabled = indice <= 0;
    document.getElementById("bajar-elemento").disabled = indice === bloques.length - 1;
    document.querySelectorAll(".bloque-plantilla").forEach(function (tarjeta) {
      tarjeta.classList.toggle("bloque-plantilla--seleccionado", tarjeta.getAttribute("data-id") === bloque.id);
    });
    actualizarResaltadoVista();
  }

  function actualizarResaltadoVista() {
    vistaMolde.querySelectorAll("[data-bloque-id]").forEach(function (elemento) {
      var seleccionado = elemento.getAttribute("data-bloque-id") === bloqueSeleccionadoId;
      elemento.classList.toggle("documento-personalizado__bloque--seleccionado", seleccionado);
      elemento.setAttribute("aria-pressed", String(seleccionado));
    });
  }

  function seleccionarBloque(id) {
    bloqueSeleccionadoId = id;
    actualizarInspectorSeleccionado();
  }

  function ajustarBloqueSeleccionado(cambios) {
    guardarBloquesDesdeEditor();
    var bloque = bloques.find(function (item) { return item.id === bloqueSeleccionadoId; });
    if (!bloque) { return; }
    if (typeof cambios.tamano === "number") { bloque.tamano = normalizarTamano(cambios.tamano, bloque.tipo); }
    if (cambios.alineacion) { bloque.alineacion = normalizarAlineacion(cambios.alineacion, bloque.tipo); }
    var tarjeta = document.querySelector('.bloque-plantilla[data-id="' + bloque.id + '"]');
    if (tarjeta) {
      tarjeta.setAttribute("data-alineacion", bloque.alineacion);
      tarjeta.setAttribute("data-tamano", String(bloque.tamano));
    }
    actualizarInspectorSeleccionado();
    mostrarVistaMolde();
    programarBorradorPlantilla();
  }

  function moverBloqueSeleccionado(direccion) {
    guardarBloquesDesdeEditor();
    var indice = bloques.findIndex(function (item) { return item.id === bloqueSeleccionadoId; });
    var siguiente = indice + direccion;
    if (indice < 0 || siguiente < 0 || siguiente >= bloques.length) { return; }
    var bloque = bloques.splice(indice, 1)[0];
    bloques.splice(siguiente, 0, bloque);
    pintarBloques();
    seleccionarBloque(bloque.id);
  }

  function formatoTamano(valor) {
    return (Number.isInteger(valor) ? String(valor) : valor.toFixed(1)) + " pt";
  }

  function valoresVacios(plantilla) {
    var valores = {};
    plantilla.bloques.forEach(function (bloque) {
      if (bloque.tipo === "texto" || bloque.tipo === "linea") { valores[bloque.id] = ""; }
      if (bloque.tipo === "doble") {
        valores[bloque.id + "-izquierda"] = "";
        valores[bloque.id + "-derecha"] = "";
      }
    });
    return valores;
  }

  function crearBloqueVisual(bloque, valores, interactivo, escalaTexto) {
    var elemento;
    var clase = "documento-personalizado__bloque";
    if (bloque.negrita) { clase += " documento-personalizado__bloque--negrita"; }
    if (bloque.cursiva) { clase += " documento-personalizado__bloque--cursiva"; }

    if (bloque.tipo === "titulo" || bloque.tipo === "subtitulo" || bloque.tipo === "seccion") {
      elemento = document.createElement(bloque.tipo === "titulo" ? "h2" : "h3");
      elemento.className = clase + " documento-personalizado__" + bloque.tipo;
      elemento.textContent = bloque.etiqueta;
    } else if (bloque.tipo === "doble") {
      elemento = agregarTexto(document.createElement("div"), "div", clase + " documento-personalizado__par");
      [
        { etiqueta: bloque.etiqueta, valor: valores[bloque.id + "-izquierda"] },
        { etiqueta: bloque.etiquetaDerecha, valor: valores[bloque.id + "-derecha"] }
      ].forEach(function (campo) {
        var columna = agregarTexto(elemento, "div", "documento-personalizado__columna");
        agregarTexto(columna, "span", "documento-personalizado__etiqueta", campo.etiqueta);
        agregarTexto(columna, "span", "documento-personalizado__valor", campo.valor || "\u00a0");
      });
    } else {
      elemento = agregarTexto(document.createElement("div"), "div", clase + " documento-personalizado__campo");
      agregarTexto(elemento, "span", "documento-personalizado__etiqueta", bloque.etiqueta);
      agregarTexto(elemento, "span", "documento-personalizado__valor", valores[bloque.id] || "\u00a0");
      if (bloque.tipo === "linea") { elemento.classList.add("documento-personalizado__campo--raya"); }
    }

    elemento.style.fontSize = (normalizarTamano(bloque.tamano, bloque.tipo) * escalaTexto) + "pt";
    var alineacion = normalizarAlineacion(bloque.alineacion, bloque.tipo);
    elemento.style.textAlign = alineacion;
    elemento.setAttribute("data-alineacion", alineacion);
    if (bloque.tipo === "titulo" || bloque.tipo === "subtitulo") {
      elemento.style.justifyContent = alineacion === "left" ? "flex-start"
        : alineacion === "right" ? "flex-end" : "center";
    } else {
      elemento.style.width = alineacion === "left" ? "100%" : "84%";
      elemento.style.alignSelf = alineacion === "right" ? "flex-end"
        : alineacion === "center" ? "center" : "flex-start";
    }
    if (interactivo) {
      elemento.classList.add("documento-personalizado__bloque--seleccionable");
      elemento.setAttribute("data-bloque-id", bloque.id);
      elemento.setAttribute("role", "button");
      elemento.setAttribute("tabindex", "0");
      elemento.setAttribute("aria-label", "Seleccionar " + TIPOS[bloque.tipo].toLocaleLowerCase("es") + ": " + bloque.etiqueta);
    }
    return elemento;
  }

  function crearMediaHoja(plantilla, valores, completa, interactivo, escalaTexto) {
    var mitad = document.createElement("section");
    mitad.className = "documento-personalizado__mitad";
    mitad.classList.add("documento-personalizado__mitad--logo-" + plantilla.logo.tamano);
    if (plantilla.papel === "carta") {
      mitad.classList.add("documento-personalizado__mitad--carta");
    }

    var logo = document.createElement("img");
    logo.className = "documento-personalizado__logo documento-personalizado__logo--" + plantilla.logo.tamano
      + " documento-personalizado__logo--" + plantilla.logo.posicion;
    logo.src = "assets/logo-adep.jpeg";
    logo.alt = "Logotipo de ADEP";
    mitad.appendChild(logo);

    var contenido = agregarTexto(mitad, "div", "documento-personalizado__contenido");
    plantilla.bloques.forEach(function (bloque) {
      contenido.appendChild(crearBloqueVisual(bloque, valores, interactivo, escalaTexto));
    });

    if (plantilla.papel !== "carta") {
      agregarTexto(mitad, "div", "documento-personalizado__borde-final");
    }
    if (completa && plantilla.papel === "media") {
      mitad.classList.add("documento-personalizado__mitad--una");
    }
    return mitad;
  }

  function margenSuperiorPredeterminado(plantilla) {
    if (plantilla.logo && plantilla.logo.posicion === "fondo") {
      return plantilla.papel === "carta" ? 18 : 14;
    }
    if (plantilla.papel === "carta") {
      return plantilla.logo && plantilla.logo.tamano === "grande" ? 38 : 30;
    }
    if (plantilla.logo && plantilla.logo.tamano === "grande") { return 36; }
    if (plantilla.logo && plantilla.logo.tamano === "mediano") { return 28; }
    return 24;
  }

  function margenSuperiorMinimo(plantilla) {
    if (plantilla.logo && plantilla.logo.posicion === "fondo") { return 12; }
    var tamanos = { pequeno: 21, mediano: 28, grande: 36 };
    return tamanos[plantilla.logo && plantilla.logo.tamano] || 28;
  }

  function margenesDe(plantilla) {
    var margenes = plantilla.margenes || {};
    var lateral = Number(margenes.lateral);
    var inferior = Number(margenes.inferior);
    var superior = Number(margenes.superior);
    return {
      superior: Number.isFinite(superior) && superior >= margenSuperiorMinimo(plantilla) && superior <= 55
        ? superior : Math.max(margenSuperiorPredeterminado(plantilla), margenSuperiorMinimo(plantilla)),
      lateral: Number.isFinite(lateral) && lateral >= 5 && lateral <= 30
        ? lateral : plantilla.papel === "carta" ? 15 : 10,
      inferior: Number.isFinite(inferior) && inferior >= 4 && inferior <= 30
        ? inferior : plantilla.papel === "carta" ? 15 : 8
    };
  }

  function configurarControlesDiseno(plantilla) {
    var margenes = margenesDe(plantilla);
    document.getElementById("margen-superior-plantilla").value = String(margenes.superior);
    document.getElementById("margen-lateral-plantilla").value = String(margenes.lateral);
    document.getElementById("margen-inferior-plantilla").value = String(margenes.inferior);
    var tamanoTexto = Number(plantilla.tamanoTexto);
    document.getElementById("tamano-texto-plantilla").value = String(
      Number.isFinite(tamanoTexto) && tamanoTexto >= 8 && tamanoTexto <= 14 ? tamanoTexto : 10
    );
    ajustarMargenSuperiorMinimo();
    actualizarEtiquetasDiseno();
  }

  function ajustarMargenSuperiorMinimo() {
    var plantilla = {
      papel: document.querySelector('input[name="papel-plantilla"]:checked').value,
      logo: {
        tamano: document.getElementById("tamano-logo").value,
        posicion: document.getElementById("posicion-logo").value
      }
    };
    var entrada = document.getElementById("margen-superior-plantilla");
    var minimo = margenSuperiorMinimo(plantilla);
    entrada.min = String(minimo);
    if (Number(entrada.value) < minimo) { entrada.value = String(minimo); }
  }

  function actualizarEtiquetasDiseno() {
    [
      ["margen-superior-plantilla", "valor-margen-superior", " mm"],
      ["margen-lateral-plantilla", "valor-margen-lateral", " mm"],
      ["margen-inferior-plantilla", "valor-margen-inferior", " mm"],
      ["tamano-texto-plantilla", "valor-tamano-texto", " pt"],
      ["espaciado-plantilla", "valor-espaciado-plantilla", " mm"]
    ].forEach(function (datos) {
      document.getElementById(datos[1]).textContent = document.getElementById(datos[0]).value + datos[2];
    });
  }

  function renderizarPagina(plantilla, valores, completa, interactivo) {
    var pagina = document.createElement("div");
    pagina.className = "documento-personalizado";
    var espaciado = Number(plantilla.espaciado);
    if (!Number.isInteger(espaciado) || espaciado < 0 || espaciado > 10) {
      espaciado = ESPACIADO_PREDETERMINADO;
    }
    var margenes = margenesDe(plantilla);
    var tamanoTexto = Number(plantilla.tamanoTexto);
    if (!Number.isFinite(tamanoTexto) || tamanoTexto < 8 || tamanoTexto > 14) { tamanoTexto = 10; }
    var escalaTexto = tamanoTexto / 10;
    pagina.style.setProperty("--documento-espaciado", espaciado + "mm");
    pagina.style.setProperty("--documento-margen-superior", margenes.superior + "mm");
    pagina.style.setProperty("--documento-margen-lateral", margenes.lateral + "mm");
    pagina.style.setProperty("--documento-margen-inferior", margenes.inferior + "mm");
    var alto = plantilla.papel === "carta" || plantilla.papel === "duplicado" || completa ? 279.4 : 139.7;
    pagina.style.height = alto + "mm";
    pagina.appendChild(crearMediaHoja(plantilla, valores, completa, !!interactivo, escalaTexto));
    if (plantilla.papel === "duplicado") {
      pagina.appendChild(crearMediaHoja(plantilla, valores, completa, !!interactivo, escalaTexto));
    }
    return pagina;
  }

  function ajustarVista(contenedor, pagina) {
    if (!contenedor || !pagina) { return; }
    pagina.style.transform = "none";
    pagina.style.transformOrigin = "top left";
    var ancho = pagina.offsetWidth;
    var alto = pagina.offsetHeight;
    var disponible = contenedor.clientWidth;
    if (!ancho || !alto || !disponible) { return; }
    var escala = Math.min(1, disponible / ancho);
    pagina.style.transform = "scale(" + escala + ")";
    contenedor.style.height = (alto * escala) + "px";
  }

  function mostrarVistaMolde() {
    guardarBloquesDesdeEditor();
    var plantilla = leerFormularioPlantilla();
    var pagina = renderizarPagina(plantilla, valoresVacios(plantilla), false, true);
    vistaMolde.replaceChildren(pagina);
    actualizarResaltadoVista();
    requestAnimationFrame(function () {
      ajustarVista(document.getElementById("vista-molde-contenedor"), pagina);
    });
  }

  function programarVistaMolde() {
    window.clearTimeout(temporizadorVista);
    temporizadorVista = window.setTimeout(mostrarVistaMolde, 80);
    programarBorradorPlantilla();
  }

  function leerFormularioPlantilla() {
    return {
      id: plantillaEnEdicion || nuevoId(),
      nombre: document.getElementById("nombre-plantilla").value.trim() || "Mi plantilla",
      papel: document.querySelector('input[name="papel-plantilla"]:checked').value,
      logo: {
        tamano: document.getElementById("tamano-logo").value,
        posicion: document.getElementById("posicion-logo").value
      },
      espaciado: Number(document.getElementById("espaciado-plantilla").value),
      margenes: {
        superior: Number(document.getElementById("margen-superior-plantilla").value),
        lateral: Number(document.getElementById("margen-lateral-plantilla").value),
        inferior: Number(document.getElementById("margen-inferior-plantilla").value)
      },
      tamanoTexto: Number(document.getElementById("tamano-texto-plantilla").value),
      bloques: bloques.slice(),
      favorito: false
    };
  }

  function establecerSelector(id, valor) {
    var entrada = document.getElementById(id);
    if (entrada.value === valor) { return; }
    entrada.value = valor;
    entrada.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function bloqueDeEjemplo(tipo, etiqueta, etiquetaDerecha) {
    return {
      id: nuevoId(),
      tipo: tipo,
      etiqueta: etiqueta,
      etiquetaDerecha: etiquetaDerecha || "",
      negrita: tipo === "titulo",
      cursiva: false,
      alineacion: alineacionPredeterminada(tipo),
      tamano: tamanoPredeterminado(tipo)
    };
  }

  function crearEjemploPlantilla(tipo) {
    var ejemplos = {
      "horas-extras": {
        nombre: "Solicitud de horas extras",
        bloques: [
          ["titulo", "SOLICITUD DE AUTORIZACIÓN DE HORAS EXTRAS"],
          ["subtitulo", "Asociación de Educadores Pensionados · ADEP"],
          ["seccion", "Datos del funcionario"],
          ["linea", "Nombre del funcionario(a)"],
          ["doble", "Área", "Fecha"],
          ["seccion", "Detalle de las horas"],
          ["linea", "Trabajo a realizar"],
          ["linea", "Justificación"],
          ["doble", "Hora de inicio", "Hora de finalización"],
          ["doble", "Total de horas", "Firma del funcionario(a)"],
          ["seccion", "Autorización"],
          ["doble", "Jefatura inmediata", "Autorización de Tesorería"]
        ]
      },
      permiso: {
        nombre: "Solicitud de permiso",
        bloques: [
          ["titulo", "SOLICITUD DE PERMISO"],
          ["subtitulo", "Asociación de Educadores Pensionados · ADEP"],
          ["seccion", "Datos del solicitante"],
          ["linea", "Nombre del funcionario(a)"],
          ["doble", "Área", "Fecha de solicitud"],
          ["seccion", "Permiso solicitado"],
          ["doble", "Fecha de inicio", "Fecha de finalización"],
          ["doble", "Hora de inicio", "Hora de finalización"],
          ["linea", "Motivo del permiso"],
          ["linea", "Observaciones"],
          ["seccion", "Autorización"],
          ["doble", "Firma del funcionario(a)", "Aprobación de jefatura"]
        ]
      },
      solicitud: {
        nombre: "Solicitud general",
        bloques: [
          ["titulo", "SOLICITUD GENERAL"],
          ["subtitulo", "Asociación de Educadores Pensionados · ADEP"],
          ["seccion", "Datos del solicitante"],
          ["linea", "Dirigido a"],
          ["doble", "Nombre del solicitante", "Área"],
          ["seccion", "Detalle"],
          ["linea", "Asunto"],
          ["linea", "Detalle de la solicitud"],
          ["seccion", "Recepción"],
          ["linea", "Fecha"],
          ["doble", "Firma del solicitante", "Recibido por"]
        ]
      }
    };
    var ejemplo = ejemplos[tipo];
    if (!ejemplo) { return null; }
    return {
      nombre: ejemplo.nombre,
      papel: "media",
      espaciado: ESPACIADO_PREDETERMINADO,
      margenes: { superior: 28, lateral: 10, inferior: 8 },
      tamanoTexto: 10,
      logo: { tamano: "mediano", posicion: "izquierda" },
      bloques: ejemplo.bloques.map(function (datos) {
        return bloqueDeEjemplo(datos[0], datos[1], datos[2]);
      })
    };
  }

  function mostrarPantallaPlantilla(id) {
    document.querySelectorAll(".pantalla").forEach(function (pantalla) {
      pantalla.classList.toggle("pantalla--activa", pantalla.id === id);
    });
    window.scrollTo(0, 0);
    var titulo = document.querySelector("#" + id + " h1");
    if (titulo) { titulo.focus({ preventScroll: true }); }
  }

  async function crearPlantillaNueva(plantilla, ejemplo) {
    var borrador = null;
    try { borrador = JSON.parse(localStorage.getItem(CLAVE_BORRADOR_PLANTILLA) || "null"); }
    catch (error) { console.error("No se pudo leer el borrador de plantilla:", error); }
    if ((plantilla || ejemplo) && borrador) {
      var reemplazar = await window.dialogosApp.confirmar(
        "Hay un borrador de plantilla",
        "Si abres esta plantilla, el borrador actual se descartará. ¿Quieres continuar?",
        "Descartar borrador"
      );
      if (!reemplazar) { return; }
      localStorage.removeItem(CLAVE_BORRADOR_PLANTILLA);
      borrador = null;
    } else if (!plantilla && borrador) {
      var recuperar = await window.dialogosApp.confirmar(
        "Hay un borrador de plantilla",
        "Se encontró un diseño guardado automáticamente. ¿Quieres continuar donde lo dejaste?",
        "Continuar borrador"
      );
      if (!recuperar) {
        localStorage.removeItem(CLAVE_BORRADOR_PLANTILLA);
        borrador = null;
      }
    }

    var guardada = plantilla || (borrador && plantillas.find(function (item) { return item.id === borrador.plantillaId; }));
    var datos = borrador || guardada || crearEjemploPlantilla(ejemplo);
    plantillaEnEdicion = guardada ? guardada.id : null;
    bloques = datos ? JSON.parse(JSON.stringify(datos.bloques)) : [];
    document.getElementById("nombre-plantilla").value = datos ? datos.nombre : "";
    document.querySelector('input[name="papel-plantilla"][value="' + (datos ? datos.papel : "media") + '"]').checked = true;
    var espaciado = datos && Number.isInteger(Number(datos.espaciado))
      && Number(datos.espaciado) >= 0 && Number(datos.espaciado) <= 10
      ? Number(datos.espaciado) : ESPACIADO_PREDETERMINADO;
    document.getElementById("espaciado-plantilla").value = String(espaciado);
    document.getElementById("valor-espaciado-plantilla").textContent = espaciado + " mm";
    establecerSelector("tamano-logo", datos ? datos.logo.tamano : "mediano");
    establecerSelector("posicion-logo", datos ? datos.logo.posicion : "izquierda");
    configurarControlesDiseno(datos || {
      papel: "media",
      logo: { tamano: "mediano", posicion: "izquierda" }
    });
    bloqueSeleccionadoId = bloques.length ? bloques[0].id : null;
    document.getElementById("titulo-crear-plantilla").textContent = guardada ? "Editar plantilla" : "Diseñar plantilla";
    document.getElementById("guardar-plantilla").textContent = guardada ? "Guardar cambios" : "Guardar plantilla";
    firmaBasePlantilla = guardada ? firmaPlantillaDe(guardada)
      : borrador
        ? JSON.stringify({
          nombre: "",
          papel: "media",
          espaciado: ESPACIADO_PREDETERMINADO,
          margenes: { superior: 28, lateral: 10, inferior: 8 },
          tamanoTexto: 10,
          logo: { tamano: "mediano", posicion: "izquierda" },
          bloques: []
        })
        : "";
    pintarBloques();
    if (!guardada && !borrador) { firmaBasePlantilla = firmaEditorPlantilla(); }
    mostrarPantallaPlantilla("pantalla-crear-plantilla");
    requestAnimationFrame(mostrarVistaMolde);
  }

  function firmaPlantillaDe(plantilla) {
    return JSON.stringify({
      nombre: plantilla.nombre,
      papel: plantilla.papel,
      espaciado: Number.isInteger(Number(plantilla.espaciado))
        && Number(plantilla.espaciado) >= 0 && Number(plantilla.espaciado) <= 10
        ? Number(plantilla.espaciado) : ESPACIADO_PREDETERMINADO,
      margenes: margenesDe(plantilla),
      tamanoTexto: Number.isFinite(Number(plantilla.tamanoTexto))
        && Number(plantilla.tamanoTexto) >= 8 && Number(plantilla.tamanoTexto) <= 14
        ? Number(plantilla.tamanoTexto) : 10,
      logo: { tamano: plantilla.logo.tamano, posicion: plantilla.logo.posicion },
      bloques: plantilla.bloques.map(function (bloque) {
        return {
          id: bloque.id,
          tipo: bloque.tipo,
          etiqueta: bloque.etiqueta,
          etiquetaDerecha: bloque.etiquetaDerecha || "",
          negrita: !!bloque.negrita,
          cursiva: !!bloque.cursiva,
          alineacion: normalizarAlineacion(bloque.alineacion, bloque.tipo),
          tamano: normalizarTamano(bloque.tamano, bloque.tipo)
        };
      })
    });
  }

  function descripcionPapel(papel) {
    return papel === "carta" ? "Carta · una página"
      : papel === "duplicado" ? "Media hoja · 2 copias en una página"
        : "Media hoja · una página";
  }

  function pintarPlantillas() {
    listaPlantillas.replaceChildren();
    if (!plantillas.length) {
      agregarTexto(listaPlantillas, "p", "lista-documentos__vacio", "Tus plantillas guardadas aparecerán aquí.");
      document.getElementById("estado-plantillas").textContent = "";
      return;
    }
    var filtradas = plantillas.filter(function (plantilla) {
      return !consultaPlantillas || plantilla.nombre.toLocaleLowerCase("es").indexOf(consultaPlantillas) !== -1;
    }).sort(function (a, b) {
      return Number(!!b.favorito) - Number(!!a.favorito) || a.nombre.localeCompare(b.nombre);
    });
    document.getElementById("estado-plantillas").textContent = filtradas.length
      ? "Mostrando " + filtradas.length + " de " + plantillas.length + " plantillas."
      : "No hay plantillas que coincidan con la búsqueda.";
    filtradas.forEach(function (plantilla) {
      var tarjeta = agregarTexto(listaPlantillas, "article", "tarjeta-plantilla");
      agregarTexto(tarjeta, "span", "tarjeta__titulo", plantilla.nombre);
      tarjeta.querySelector(".tarjeta__titulo").prepend(window.adepIconos.crear("papel"));
      agregarTexto(tarjeta, "span", "tarjeta__texto", descripcionPapel(plantilla.papel));
      var acciones = agregarTexto(tarjeta, "div", "tarjeta-plantilla__acciones");
      [
        { clase: "boton boton--principal", texto: "Usar", accion: "usar", icono: "usar" },
        { clase: "boton boton--secundario", texto: "Editar", accion: "editar", icono: "editar" },
        { clase: "boton boton--secundario boton-duplicar-plantilla", texto: "Duplicar", accion: "duplicar", icono: "duplicar" },
        { clase: "boton boton--texto", texto: plantilla.favorito ? "Favorita" : "Favoritos", accion: "favorito", icono: plantilla.favorito ? "estrellaLlena" : "estrella" },
        { clase: "boton boton--texto", texto: "Eliminar", accion: "eliminar", icono: "basura" }
      ].forEach(function (opcion) {
        var boton = agregarTexto(acciones, "button", opcion.clase, opcion.texto);
        boton.prepend(window.adepIconos.crear(opcion.icono));
        boton.type = "button";
        boton.setAttribute("data-accion-plantilla", opcion.accion);
        boton.setAttribute("data-id-plantilla", plantilla.id);
      });
    });
  }

  function agregarBloque(tipo) {
    if (bloques.length >= LIMITE_BLOQUES) {
      document.getElementById("aviso-limite-bloques").textContent =
        "Llegaste al límite de 20 elementos para esta plantilla.";
      return;
    }
    var defecto = tipo === "titulo" ? "Título del documento"
      : tipo === "subtitulo" ? "Subtítulo"
        : tipo === "seccion" ? "Nombre de sección"
        : tipo === "doble" ? "Campo izquierdo" : "Nombre del campo";
    bloques.push({
      id: nuevoId(),
      tipo: tipo,
      etiqueta: defecto,
      etiquetaDerecha: tipo === "doble" ? "Campo derecho" : "",
      negrita: tipo === "titulo",
      cursiva: false,
      alineacion: alineacionPredeterminada(tipo),
      tamano: tamanoPredeterminado(tipo)
    });
    bloqueSeleccionadoId = bloques[bloques.length - 1].id;
    pintarBloques();
    var entrada = document.querySelector("#lista-bloques-plantilla .bloque-plantilla:last-child input[type='text']");
    if (entrada) { entrada.focus(); }
  }

  function abrirEditorDocumento(plantilla, valores, documentoId) {
    plantillaActual = plantilla;
    valoresActuales = valores || valoresVacios(plantilla);
    documentoActualId = documentoId || null;
    firmaBaseDocumento = documentoId ? JSON.stringify(valoresActuales) : JSON.stringify(valoresVacios(plantilla));
    document.getElementById("titulo-documento-personalizado").textContent = plantilla.nombre;
    document.getElementById("nombre-documento-personalizado").textContent = "Datos del documento";
    formularioDocumento.replaceChildren();

    plantilla.bloques.forEach(function (bloque) {
      if (bloque.tipo === "titulo" || bloque.tipo === "subtitulo" || bloque.tipo === "seccion") { return; }
      var campos = bloque.tipo === "doble"
        ? [
          { id: bloque.id + "-izquierda", etiqueta: bloque.etiqueta || "Campo izquierdo" },
          { id: bloque.id + "-derecha", etiqueta: bloque.etiquetaDerecha || "Campo derecho" }
        ]
        : [{ id: bloque.id, etiqueta: bloque.etiqueta || "Campo" }];
      campos.forEach(function (campo) {
        var grupo = agregarTexto(formularioDocumento, "div", "campo-form");
        var etiqueta = agregarTexto(grupo, "label", "", campo.etiqueta);
        var entrada = document.createElement("input");
        entrada.type = "text";
        entrada.maxLength = 500;
        entrada.value = valoresActuales[campo.id] || "";
        entrada.setAttribute("data-valor-plantilla", campo.id);
        entrada.setAttribute("aria-label", campo.etiqueta);
        etiqueta.htmlFor = "valor-" + campo.id;
        entrada.id = "valor-" + campo.id;
        grupo.appendChild(entrada);
      });
    });
    actualizarVistaDocumento();
    document.querySelectorAll(".pantalla").forEach(function (pantalla) {
      pantalla.classList.toggle("pantalla--activa", pantalla.id === "pantalla-editor-personalizada");
    });
    window.scrollTo(0, 0);
    document.getElementById("titulo-documento-personalizado").focus({ preventScroll: true });
    requestAnimationFrame(actualizarVistaDocumento);
  }

  function leerValoresDocumento() {
    valoresActuales = {};
    formularioDocumento.querySelectorAll("[data-valor-plantilla]").forEach(function (entrada) {
      valoresActuales[entrada.getAttribute("data-valor-plantilla")] = entrada.value;
    });
    actualizarVistaDocumento();
    programarBorradorDocumento();
  }
  formularioDocumento.addEventListener("input", leerValoresDocumento);

  function actualizarVistaDocumento() {
    if (!plantillaActual) { return; }
    var pagina = renderizarPagina(plantillaActual, valoresActuales, false);
    vistaDocumento.replaceChildren(pagina);
    requestAnimationFrame(function () {
      ajustarVista(document.getElementById("vista-personalizada-contenedor"), pagina);
    });
  }

  function completarValores(plantilla, valoresGuardados) {
    var valores = valoresVacios(plantilla);
    Object.keys(valoresGuardados || {}).forEach(function (id) {
      if (Object.prototype.hasOwnProperty.call(valores, id)) { valores[id] = valoresGuardados[id]; }
    });
    return valores;
  }

  async function abrirPlantilla(plantilla) {
    if (!plantilla) { return; }
    var valores = valoresVacios(plantilla);
    var idDocumento = null;
    try {
      var borrador = JSON.parse(localStorage.getItem(claveBorradorDocumento(plantilla)) || "null");
      if (borrador && borrador.valores) {
        var recuperar = await window.dialogosApp.confirmar(
          "Hay un borrador de documento",
          "Se encontró un borrador guardado para esta plantilla. ¿Quieres continuar donde lo dejaste?",
          "Continuar borrador"
        );
        if (recuperar) {
          valores = completarValores(plantilla, borrador.valores);
          idDocumento = borrador.documentoId || null;
        } else {
          localStorage.removeItem(claveBorradorDocumento(plantilla));
        }
      }
    } catch (error) {
      console.error("No se pudo leer el borrador del documento:", error);
    }
    abrirEditorDocumento(plantilla, valores, idDocumento);
    firmaBaseDocumento = JSON.stringify(valoresVacios(plantilla));
  }

  function nombreArchivo(nombre) {
    return (nombre || "documento").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ").trim() || "documento";
  }

  function crearPaginaPdf() {
    var pagina = renderizarPagina(plantillaActual, valoresActuales, true);
    pagina.style.position = "fixed";
    pagina.style.left = "-10000px";
    pagina.style.top = "0";
    document.body.appendChild(pagina);
    return pagina;
  }

  async function descargarPdf() {
    var boton = document.getElementById("descargar-documento-personalizado");
    if (!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF) {
      await window.dialogosApp.aviso("No se pudo generar el PDF", "Comprueba que los módulos PDF estén cargados e inténtalo de nuevo.");
      return;
    }
    boton.disabled = true;
    var pagina = crearPaginaPdf();
    try {
      if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
      var canvas = await window.html2canvas(pagina, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        width: pagina.offsetWidth,
        height: pagina.offsetHeight
      });
      var pdf = new window.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "letter", compress: true });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 215.9, 279.4, undefined, "FAST");
      pdf.save(nombreArchivo(plantillaActual.nombre) + ".pdf");
      await window.dialogosApp.aviso("PDF descargado", "El documento se descargó en una sola página tamaño carta.");
    } catch (error) {
      console.error("No se pudo generar el PDF de la plantilla:", error);
      await window.dialogosApp.aviso("No se pudo descargar", "Inténtalo de nuevo. Si el problema continúa, guarda el documento e inténtalo más tarde.");
    } finally {
      pagina.remove();
      boton.disabled = false;
    }
  }

  async function guardarDocumento() {
    leerValoresDocumento();
    var id = documentoActualId || nuevoId();
    var documento = {
      id: id,
      tipo: "personalizada",
      nombre: plantillaActual.nombre,
      nombrePlantilla: plantillaActual.nombre,
      plantillaId: plantillaActual.id,
      plantilla: JSON.parse(JSON.stringify(plantillaActual)),
      valores: JSON.parse(JSON.stringify(valoresActuales)),
      datos: { funcionario: plantillaActual.nombre, area: descripcionPapel(plantillaActual.papel) },
      creado: new Date().toISOString(),
      actualizado: new Date().toISOString()
    };
    try {
      await window.adepDocumentos.guardar(documento);
      documentoActualId = id;
      localStorage.removeItem(claveBorradorDocumento(plantillaActual));
      firmaBaseDocumento = firmaValoresDocumento();
      await window.dialogosApp.aviso("Documento guardado", "Quedó guardado en este dispositivo.");
    } catch (error) {
      await window.dialogosApp.aviso("No se pudo guardar", "Comprueba el espacio disponible en el dispositivo e inténtalo de nuevo.");
    }
  }

  formularioPlantilla.addEventListener("submit", function (evento) {
    evento.preventDefault();
    guardarBloquesDesdeEditor();
    if (!bloques.length) {
      window.dialogosApp.aviso("Agrega elementos", "La plantilla debe tener al menos un título, texto o campo.");
      return;
    }
    var nombre = document.getElementById("nombre-plantilla").value.trim();
    if (!nombre) {
      document.getElementById("nombre-plantilla").focus();
      return;
    }
    var existente = plantillas.find(function (item) { return item.id === plantillaEnEdicion; });
    var plantilla = leerFormularioPlantilla();
    plantilla.nombre = nombre;
    plantilla.favorito = existente ? !!existente.favorito : false;
    plantillas = plantillas.filter(function (item) { return item.id !== plantilla.id; });
    plantillas.push(plantilla);
    if (!guardarPlantillas()) { return; }
    localStorage.removeItem(CLAVE_BORRADOR_PLANTILLA);
    firmaBasePlantilla = firmaEditorPlantilla();
    pintarPlantillas();
    mostrarPantallaPlantilla("pantalla-plantillas");
  });

  var botonMenuCrear = document.getElementById("abrir-menu-crear");
  var menuCrear = document.getElementById("menu-crear-flotante");

  function cerrarMenuCrear(devolverFoco) {
    menuCrear.hidden = true;
    botonMenuCrear.setAttribute("aria-expanded", "false");
    if (devolverFoco) { botonMenuCrear.focus(); }
  }

  botonMenuCrear.addEventListener("click", function () {
    menuCrear.hidden = !menuCrear.hidden;
    botonMenuCrear.setAttribute("aria-expanded", String(!menuCrear.hidden));
  });
  menuCrear.addEventListener("click", function () { cerrarMenuCrear(false); });
  document.addEventListener("click", function (evento) {
    if (!menuCrear.contains(evento.target) && !botonMenuCrear.contains(evento.target)) {
      cerrarMenuCrear(false);
    }
  });
  document.addEventListener("focusin", function (evento) {
    if (!menuCrear.contains(evento.target) && !botonMenuCrear.contains(evento.target)) {
      cerrarMenuCrear(false);
    }
  });
  document.addEventListener("keydown", function (evento) {
    if (evento.key === "Escape" && !menuCrear.hidden) { cerrarMenuCrear(true); }
  });

  ["crear-plantilla", "crear-plantilla-flotante"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () {
      mostrarPantallaPlantilla("pantalla-ejemplos-plantilla");
    });
  });
  document.getElementById("pantalla-ejemplos-plantilla").addEventListener("click", function (evento) {
    var boton = evento.target.closest("[data-plantilla-inicial]");
    if (!boton) { return; }
    var tipo = boton.getAttribute("data-plantilla-inicial");
    crearPlantillaNueva(null, tipo === "blanco" ? null : tipo);
  });
  document.getElementById("agregar-bloque").addEventListener("click", function () {
    agregarBloque(document.getElementById("tipo-bloque").value);
  });
  document.getElementById("tamano-elemento-plantilla").addEventListener("input", function (evento) {
    ajustarBloqueSeleccionado({ tamano: Number(evento.target.value) });
  });
  document.querySelectorAll("[data-alinear]").forEach(function (boton) {
    boton.addEventListener("click", function () {
      ajustarBloqueSeleccionado({ alineacion: boton.getAttribute("data-alinear") });
    });
  });
  document.getElementById("subir-elemento").addEventListener("click", function () {
    moverBloqueSeleccionado(-1);
  });
  document.getElementById("bajar-elemento").addEventListener("click", function () {
    moverBloqueSeleccionado(1);
  });
  vistaMolde.addEventListener("click", function (evento) {
    var elemento = evento.target.closest("[data-bloque-id]");
    if (elemento) { seleccionarBloque(elemento.getAttribute("data-bloque-id")); }
  });
  vistaMolde.addEventListener("keydown", function (evento) {
    var elemento = evento.target.closest("[data-bloque-id]");
    if (elemento && (evento.key === "Enter" || evento.key === " ")) {
      evento.preventDefault();
      seleccionarBloque(elemento.getAttribute("data-bloque-id"));
    }
  });
  document.getElementById("buscar-plantillas").addEventListener("input", function (evento) {
    consultaPlantillas = evento.target.value.trim().toLocaleLowerCase("es");
    pintarPlantillas();
  });
  ["pantalla-plantillas", "pantalla-ejemplos-plantilla"].forEach(function (id) {
    var pantalla = document.getElementById(id);
    pantalla.addEventListener("click", function (evento) {
      var boton = evento.target.closest("[data-accion-favorito-predeterminado]");
      if (!boton) { return; }
      evento.preventDefault();
      alternarFavoritaPredeterminada(boton.closest("[data-favorita-predeterminada]"));
    });
    pantalla.querySelectorAll(".tarjetas").forEach(function (contenedor) {
      if (contenedor.querySelector("[data-favorita-predeterminada]")) {
        actualizarFavoritasPredeterminadas(contenedor);
      }
    });
  });

  ["input", "change"].forEach(function (evento) {
    formularioPlantilla.addEventListener(evento, function (cambio) {
      if (cambio.target.id === "tamano-logo" || cambio.target.id === "posicion-logo"
        || cambio.target.name === "papel-plantilla") {
        ajustarMargenSuperiorMinimo();
      }
      actualizarEtiquetasDiseno();
      programarVistaMolde();
    });
  });
  document.getElementById("lista-bloques-plantilla").addEventListener("input", programarVistaMolde);
  document.getElementById("lista-bloques-plantilla").addEventListener("change", programarVistaMolde);
  document.getElementById("lista-bloques-plantilla").addEventListener("click", function (evento) {
    var boton = evento.target.closest("[data-accion-bloque]");
    if (!boton) {
      var tarjetaSeleccionada = evento.target.closest(".bloque-plantilla");
      if (tarjetaSeleccionada) { seleccionarBloque(tarjetaSeleccionada.getAttribute("data-id")); }
      return;
    }
    guardarBloquesDesdeEditor();
    var tarjeta = boton.closest(".bloque-plantilla");
    var indice = bloques.findIndex(function (bloque) { return bloque.id === tarjeta.getAttribute("data-id"); });
    var accion = boton.getAttribute("data-accion-bloque");
    if (accion === "quitar") {
      if (bloqueSeleccionadoId === tarjeta.getAttribute("data-id")) { bloqueSeleccionadoId = null; }
      bloques.splice(indice, 1);
    }
    if (accion === "subir" && indice > 0) { bloques.splice(indice - 1, 0, bloques.splice(indice, 1)[0]); }
    if (accion === "bajar" && indice < bloques.length - 1) { bloques.splice(indice + 1, 0, bloques.splice(indice, 1)[0]); }
    pintarBloques();
  });

  listaPlantillas.addEventListener("click", async function (evento) {
    var boton = evento.target.closest("[data-accion-plantilla]");
    if (!boton) { return; }
    var plantilla = plantillas.find(function (item) { return item.id === boton.getAttribute("data-id-plantilla"); });
    if (!plantilla) { return; }
    var accion = boton.getAttribute("data-accion-plantilla");
    if (accion === "usar") { await abrirPlantilla(plantilla); }
    if (accion === "editar") { await crearPlantillaNueva(plantilla); }
    if (accion === "duplicar") {
      var copia = JSON.parse(JSON.stringify(plantilla));
      copia.id = nuevoId();
      copia.nombre = plantilla.nombre + " (copia)";
      copia.favorito = false;
      copia.bloques = copia.bloques.map(function (bloque) {
        bloque.id = nuevoId();
        return bloque;
      });
      plantillas.push(copia);
      if (guardarPlantillas()) {
        pintarPlantillas();
        document.getElementById("estado-plantillas").textContent = "Plantilla duplicada: " + copia.nombre + ".";
      }
    }
    if (accion === "favorito") {
      plantilla.favorito = !plantilla.favorito;
      if (guardarPlantillas()) { pintarPlantillas(); }
    }
    if (accion === "eliminar") {
      var confirmar = await window.dialogosApp.confirmar("¿Eliminar plantilla?", "Los documentos que ya guardaste conservarán su copia de este molde.", "Eliminar");
      if (!confirmar) { return; }
      plantillas = plantillas.filter(function (item) { return item.id !== plantilla.id; });
      if (guardarPlantillas()) {
        localStorage.removeItem(claveBorradorDocumento(plantilla));
        pintarPlantillas();
      }
    }
  });

  document.getElementById("guardar-documento-personalizado").addEventListener("click", guardarDocumento);
  document.getElementById("descargar-documento-personalizado").addEventListener("click", descargarPdf);
  document.getElementById("imprimir-documento-personalizado").addEventListener("click", function () {
    document.body.classList.add("imprimiendo-personalizado");
    window.print();
  });
  window.addEventListener("afterprint", function () { document.body.classList.remove("imprimiendo-personalizado"); });
  window.addEventListener("resize", function () {
    ajustarVista(document.getElementById("vista-molde-contenedor"), vistaMolde.firstElementChild);
    ajustarVista(document.getElementById("vista-personalizada-contenedor"), vistaDocumento.firstElementChild);
  });

  function validarImportacion(entrada) {
    if (!Array.isArray(entrada) || entrada.length > 500) {
      throw new Error("La copia contiene una lista de plantillas no válida.");
    }
    entrada.forEach(function (plantilla) {
      if (!plantilla || typeof plantilla.id !== "string" || !plantilla.id
        || typeof plantilla.nombre !== "string" || plantilla.nombre.length > 100
        || !["media", "duplicado", "carta"].includes(plantilla.papel)
        || (Object.prototype.hasOwnProperty.call(plantilla, "espaciado")
          && (!Number.isInteger(plantilla.espaciado) || plantilla.espaciado < 0 || plantilla.espaciado > 10))
        || (Object.prototype.hasOwnProperty.call(plantilla, "tamanoTexto")
          && (!Number.isFinite(plantilla.tamanoTexto) || plantilla.tamanoTexto < 8 || plantilla.tamanoTexto > 14))
        || (Object.prototype.hasOwnProperty.call(plantilla, "margenes")
          && (!plantilla.margenes || !Number.isFinite(plantilla.margenes.superior)
            || plantilla.margenes.superior < margenSuperiorMinimo(plantilla) || plantilla.margenes.superior > 55
            || !Number.isFinite(plantilla.margenes.lateral) || plantilla.margenes.lateral < 5 || plantilla.margenes.lateral > 30
            || !Number.isFinite(plantilla.margenes.inferior) || plantilla.margenes.inferior < 4 || plantilla.margenes.inferior > 30))
        || !plantilla.logo || !["pequeno", "mediano", "grande"].includes(plantilla.logo.tamano)
        || !["izquierda", "derecha", "fondo"].includes(plantilla.logo.posicion)
        || !Array.isArray(plantilla.bloques) || plantilla.bloques.length > LIMITE_BLOQUES) {
        throw new Error("La copia contiene una plantilla con formato no válido.");
      }
      plantilla.bloques.forEach(function (bloque) {
        if (!bloque || typeof bloque.id !== "string" || !bloque.id
          || !Object.prototype.hasOwnProperty.call(TIPOS, bloque.tipo)
          || typeof bloque.etiqueta !== "string"
          || (Object.prototype.hasOwnProperty.call(bloque, "alineacion")
            && !["left", "center", "right"].includes(bloque.alineacion))
          || (Object.prototype.hasOwnProperty.call(bloque, "tamano")
            && (!Number.isFinite(bloque.tamano) || bloque.tamano < 6 || bloque.tamano > 24))
          || (bloque.tipo === "doble" && typeof bloque.etiquetaDerecha !== "string")) {
          throw new Error("La copia contiene un elemento de plantilla con formato no válido.");
        }
      });
    });
  }

  function importarPlantillas(entrada) {
    validarImportacion(entrada);
    var unidas = plantillas.slice();
    entrada.forEach(function (plantilla) {
      unidas = unidas.filter(function (actual) { return actual.id !== plantilla.id; });
      unidas.push(plantilla);
    });
    var anteriores = plantillas;
    plantillas = unidas;
    if (!guardarPlantillas()) {
      plantillas = anteriores;
      return false;
    }
    pintarPlantillas();
    return true;
  }

  function reemplazarPlantillas(entrada) {
    var anteriores = plantillas;
    plantillas = entrada.slice();
    if (!guardarPlantillas()) {
      plantillas = anteriores;
      return false;
    }
    pintarPlantillas();
    return true;
  }

  function hayCambiosPendientes() {
    if (document.getElementById("pantalla-crear-plantilla").classList.contains("pantalla--activa")) {
      return !!firmaBasePlantilla && firmaEditorPlantilla() !== firmaBasePlantilla;
    }
    if (document.getElementById("pantalla-editor-personalizada").classList.contains("pantalla--activa")) {
      return !!firmaBaseDocumento && firmaValoresDocumento() !== firmaBaseDocumento;
    }
    return false;
  }

  async function confirmarSalida(destino) {
    var enCreador = document.getElementById("pantalla-crear-plantilla").classList.contains("pantalla--activa");
    var enDocumento = document.getElementById("pantalla-editor-personalizada").classList.contains("pantalla--activa");
    if ((enCreador && destino === "pantalla-crear-plantilla")
      || (enDocumento && destino === "pantalla-editor-personalizada")
      || !hayCambiosPendientes()) { return true; }
    if (enCreador) { programarBorradorPlantilla(); guardarBorradorPlantilla(); }
    if (enDocumento) { programarBorradorDocumento(); guardarBorradorDocumento(); }
    return window.dialogosApp.confirmar(
      "¿Salir del editor?",
      "Tus cambios se guardaron como borrador en este dispositivo. ¿Quieres salir?",
      "Salir"
    );
  }

  window.adepPlantillas = {
    exportar: function () { return plantillas.slice(); },
    validarImportacion: validarImportacion,
    importar: importarPlantillas,
    reemplazar: reemplazarPlantillas,
    hayCambiosPendientes: hayCambiosPendientes,
    confirmarSalida: confirmarSalida,
    guardarBorradorActual: function () {
      if (document.getElementById("pantalla-crear-plantilla").classList.contains("pantalla--activa")) {
        guardarBorradorPlantilla();
      } else if (document.getElementById("pantalla-editor-personalizada").classList.contains("pantalla--activa")) {
        guardarBorradorDocumento();
      }
    },
    abrirDocumento: function (documento) {
      var plantilla = documento.plantilla || plantillas.find(function (item) { return item.id === documento.plantillaId; });
      if (!plantilla) {
        window.dialogosApp.aviso("Plantilla no disponible", "No se encontró el molde guardado para este documento.");
        return;
      }
      abrirEditorDocumento(plantilla, completarValores(plantilla, documento.valores), documento.id);
    }
  };

  pintarPlantillas();
})();
