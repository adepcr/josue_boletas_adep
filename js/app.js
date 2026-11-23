/* ==========================================================
   app.js · Navegación entre pantallas
   Cada botón con data-ir="id-de-pantalla" lleva a esa pantalla.
   ========================================================== */

(function () {
  "use strict";

  var CLASE_ACTIVA = "pantalla--activa";
  var CLAVE_DOCUMENTOS = "adep-documentos-v1";
  var CLAVE_BORRADOR_BOLETA = "adep-borrador-boleta-v1";
  var NOMBRE_BASE = "adep-documentos";
  var documentoActualId = null;
  var documentosActuales = [];
  var baseDatos = null;
  var promesaCargaDocumentos = null;
  var firmaBaseBoleta = "";
  var temporizadorBorradorBoleta = 0;
  var filtroDocumentos = { consulta: "", tipo: "todos" };

  function abrirBaseDatos() {
    if (baseDatos) { return Promise.resolve(baseDatos); }
    return new Promise(function (resolver, rechazar) {
      if (!window.indexedDB) { rechazar(new Error("IndexedDB no está disponible.")); return; }
      var solicitud = window.indexedDB.open(NOMBRE_BASE, 1);
      solicitud.onupgradeneeded = function () {
        solicitud.result.createObjectStore("documentos", { keyPath: "id" });
      };
      solicitud.onsuccess = function () { baseDatos = solicitud.result; resolver(baseDatos); };
      solicitud.onerror = function () { rechazar(solicitud.error); };
    });
  }

  function listarEnBase() {
    return abrirBaseDatos().then(function (db) {
      return new Promise(function (resolver, rechazar) {
        var solicitud = db.transaction("documentos", "readonly").objectStore("documentos").getAll();
        solicitud.onsuccess = function () { resolver(solicitud.result || []); };
        solicitud.onerror = function () { rechazar(solicitud.error); };
      });
    });
  }

  function guardarEnBase(documento) {
    return abrirBaseDatos().then(function (db) {
      return new Promise(function (resolver, rechazar) {
        var transaccion = db.transaction("documentos", "readwrite");
        transaccion.objectStore("documentos").put(documento);
        transaccion.oncomplete = resolver;
        transaccion.onerror = function () { rechazar(transaccion.error); };
        transaccion.onabort = function () { rechazar(transaccion.error); };
      });
    });
  }

  function eliminarDeBase(id) {
    return abrirBaseDatos().then(function (db) {
      return new Promise(function (resolver, rechazar) {
        var transaccion = db.transaction("documentos", "readwrite");
        transaccion.objectStore("documentos").delete(id);
        transaccion.oncomplete = resolver;
        transaccion.onerror = function () { rechazar(transaccion.error); };
      });
    });
  }

  function cargarDocumentos() {
    return listarEnBase().then(function (documentos) {
      var anteriores = [];
      try { anteriores = JSON.parse(localStorage.getItem(CLAVE_DOCUMENTOS) || "[]"); } catch (error) { anteriores = []; }
      if (!documentos.length && Array.isArray(anteriores) && anteriores.length) {
        return Promise.all(anteriores.map(guardarEnBase)).then(function () {
          localStorage.removeItem(CLAVE_DOCUMENTOS);
          return anteriores;
        });
      }
      return documentos;
    }).catch(function () {
      try {
        var anteriores = JSON.parse(localStorage.getItem(CLAVE_DOCUMENTOS) || "[]");
        return Array.isArray(anteriores) ? anteriores : [];
      } catch (error) { return []; }
    }).then(function (documentos) {
      documentosActuales = documentos;
      pintarDocumentos();
    });
  }

  function leerDocumentos() {
    return documentosActuales;
  }

  function textoFecha(valor) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "Sin fecha";
  }

  function crearElemento(etiqueta, clase, texto) {
    var elemento = document.createElement(etiqueta);
    if (clase) { elemento.className = clase; }
    if (texto) { elemento.textContent = texto; }
    return elemento;
  }

  function pintarDocumentos() {
    var lista = document.getElementById("lista-documentos");
    if (!lista) { return; }
    lista.textContent = "";

    var todos = leerDocumentos().slice().sort(function (a, b) {
      return (b.actualizado || b.creado).localeCompare(a.actualizado || a.creado);
    });
    var consulta = filtroDocumentos.consulta.toLocaleLowerCase("es");
    var documentos = todos.filter(function (documento) {
      if (filtroDocumentos.tipo !== "todos" && documento.tipo !== filtroDocumentos.tipo) { return false; }
      var datos = documento.datos || {};
      var texto = [
        documento.nombre, documento.nombrePlantilla, datos.funcionario, datos.area,
        datos.trabajo, textoFecha(datos.fecha)
      ].filter(Boolean).join(" ").toLocaleLowerCase("es");
      return !consulta || texto.indexOf(consulta) !== -1;
    });

    var estado = document.getElementById("estado-documentos");
    if (estado) { estado.textContent = todos.length ? "Mostrando " + documentos.length + " de " + todos.length + " documentos." : ""; }
    if (!todos.length) {
      lista.appendChild(crearElemento("p", "lista-documentos__vacio", "Todavía no hay documentos guardados."));
      return;
    }
    if (!documentos.length) {
      lista.appendChild(crearElemento("p", "lista-documentos__vacio", "No hay documentos que coincidan con la búsqueda."));
      return;
    }

    documentos.forEach(function (documento) {
      var articulo = crearElemento("article", "documento-guardado");
      var imagen = crearElemento("img", "documento-guardado__preview");
      imagen.src = documento.miniatura || "assets/logo-adep.jpeg";
      imagen.alt = documento.miniatura ? "Vista previa de la boleta guardada" : "Logotipo de ADEP";
      articulo.appendChild(imagen);
      var informacion = crearElemento("div", "documento-guardado__info");
      var titulo = documento.nombre || documento.datos.funcionario || "Boleta para horas extras";
      var detalle = documento.tipo === "personalizada"
        ? "Plantilla: " + (documento.nombrePlantilla || "Personalizada")
        : [documento.datos.area, textoFecha(documento.datos.fecha)].filter(Boolean).join(" · ");
      var fechaGuardado = new Date(documento.actualizado || documento.creado).toLocaleString("es-CR");

      informacion.appendChild(crearElemento("h3", "documento-guardado__titulo", titulo));
      informacion.appendChild(crearElemento("p", "documento-guardado__detalle", detalle));
      if (documento.datos && documento.datos.trabajo) {
        informacion.appendChild(crearElemento("p", "documento-guardado__trabajo", documento.datos.trabajo));
      }
      informacion.appendChild(crearElemento("p", "documento-guardado__fecha", "Guardado: " + fechaGuardado));

      var acciones = crearElemento("div", "documento-guardado__acciones");
      var abrir = crearElemento("button", "boton boton--secundario", "Abrir");
      abrir.prepend(window.adepIconos.crear("abrir"));
      abrir.type = "button";
      abrir.setAttribute("data-abrir-documento", documento.id);
      var eliminar = crearElemento("button", "boton boton--texto", "Eliminar");
      eliminar.prepend(window.adepIconos.crear("basura"));
      eliminar.type = "button";
      eliminar.setAttribute("data-eliminar-documento", documento.id);
      acciones.appendChild(abrir);
      acciones.appendChild(eliminar);
      articulo.appendChild(informacion);
      articulo.appendChild(acciones);
      lista.appendChild(articulo);
    });
  }

  function capturarDatosBoleta() {
    return {
      funcionario: document.getElementById("in-funcionario").value,
      area: document.getElementById("in-area").value,
      trabajo: document.getElementById("in-trabajo").value,
      justificacion: document.getElementById("in-justificacion").value,
      fecha: document.getElementById("in-fecha").value,
      inicio: document.getElementById("in-inicio").value,
      fin: document.getElementById("in-fin").value,
      horaInicioManual: document.getElementById("hora-manual-inicio").value,
      horaFinManual: document.getElementById("hora-manual-fin").value,
      textoTamano: document.querySelector('input[name="texto-tamano"]:checked').value,
      negrita: document.getElementById("opcion-negrita").checked
    };
  }

  function firmaBoleta() { return JSON.stringify(capturarDatosBoleta()); }

  function guardarBorradorBoleta() {
    var datos = capturarDatosBoleta();
    try {
      if (JSON.stringify(datos) === firmaBaseBoleta) {
        localStorage.removeItem(CLAVE_BORRADOR_BOLETA);
        return;
      }
      localStorage.setItem(CLAVE_BORRADOR_BOLETA, JSON.stringify({
        documentoId: documentoActualId,
        datos: datos,
        actualizado: new Date().toISOString()
      }));
      document.getElementById("estado-borrador").textContent = "Borrador de horas guardado en este dispositivo.";
    } catch (error) {
      console.error("No se pudo guardar el borrador de horas:", error);
      document.getElementById("estado-borrador").textContent = "No se pudo guardar el borrador de horas; revisa el espacio disponible.";
    }
  }

  function programarBorradorBoleta() {
    window.clearTimeout(temporizadorBorradorBoleta);
    temporizadorBorradorBoleta = window.setTimeout(guardarBorradorBoleta, 250);
  }

  function restaurarDatosBoleta(datos) {
    ["funcionario", "area", "trabajo", "justificacion", "fecha", "inicio", "fin"].forEach(function (campo) {
      var entrada = document.getElementById("in-" + campo);
      if (entrada) { entrada.value = datos[campo] || ""; }
    });
    actualizarBotonSelector("in-area", datos.area || "");
    actualizarBotonSelector("in-fecha", datos.fecha ? textoFecha(datos.fecha) : "");
    actualizarBotonSelector("in-inicio", datos.inicio || "", datos.inicio || "");
    actualizarBotonSelector("in-fin", datos.fin || "", datos.fin || "");
    document.getElementById("hora-manual-inicio").value = datos.horaInicioManual || datos.inicio || "";
    document.getElementById("hora-manual-fin").value = datos.horaFinManual || datos.fin || "";
    var nivel = document.querySelector('input[name="texto-tamano"][value="' + (datos.textoTamano || "normal") + '"]')
      || document.querySelector('input[name="texto-tamano"][value="normal"]');
    nivel.checked = true;
    document.getElementById("opcion-negrita").checked = !!datos.negrita;
    aplicarEstiloTexto();
    emitirActualizacion();
  }

  function hayCambiosBoleta() {
    return document.getElementById("pantalla-editor").classList.contains(CLASE_ACTIVA)
      && !!firmaBaseBoleta && firmaBoleta() !== firmaBaseBoleta;
  }

  async function confirmarSalidaBoleta() {
    if (!hayCambiosBoleta()) { return true; }
    guardarBorradorBoleta();
    return window.dialogosApp.confirmar(
      "¿Salir del documento?",
      "Tus cambios se guardaron como borrador en este dispositivo. ¿Quieres salir del editor?",
      "Salir"
    );
  }

  async function prepararNuevoDocumento() {
    var borrador = null;
    try { borrador = JSON.parse(localStorage.getItem(CLAVE_BORRADOR_BOLETA) || "null"); }
    catch (error) { console.error("No se pudo leer el borrador de horas:", error); }
    restablecerFormulario();
    if (borrador && borrador.datos && typeof borrador.datos === "object") {
      var recuperar = await window.dialogosApp.confirmar(
        "Hay un borrador de horas",
        "Se encontró un borrador guardado automáticamente. ¿Quieres continuar donde lo dejaste?",
        "Continuar borrador"
      );
      if (recuperar) {
        documentoActualId = borrador.documentoId || null;
        restaurarDatosBoleta(borrador.datos);
        guardarBorradorBoleta();
      } else {
        localStorage.removeItem(CLAVE_BORRADOR_BOLETA);
      }
    }
    firmaBaseBoleta = JSON.stringify({
      funcionario: "", area: "", trabajo: "", justificacion: "", fecha: "", inicio: "", fin: "",
      horaInicioManual: "", horaFinManual: "",
      textoTamano: "normal", negrita: false
    });
  }

  function descargarArchivo(nombre, contenido) {
    var enlace = document.createElement("a");
    var url = URL.createObjectURL(new Blob([contenido], { type: "application/json" }));
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function validarDocumentoImportado(documento) {
    if (!documento || typeof documento !== "object" || typeof documento.id !== "string"
      || !documento.id || (documento.tipo !== "horas-extras" && documento.tipo !== "personalizada")
      || !documento.datos || typeof documento.datos !== "object") {
      throw new Error("El respaldo contiene un documento con formato no válido.");
    }
    if (documento.tipo === "personalizada"
      && (!documento.plantilla || !Array.isArray(documento.plantilla.bloques) || !documento.valores)) {
      throw new Error("El respaldo contiene un documento personalizado incompleto.");
    }
    if (documento.tipo === "personalizada") {
      window.adepPlantillas.validarImportacion([documento.plantilla]);
    }
  }

  async function importarRespaldo(archivo) {
    if (!archivo) { return; }
    if (archivo.size > 15 * 1024 * 1024) {
      await window.dialogosApp.aviso("Respaldo demasiado grande", "El archivo debe ser menor de 15 MB.");
      return;
    }
    var texto = await new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onload = function () { resolver(String(lector.result || "")); };
      lector.onerror = function () { rechazar(lector.error || new Error("No se pudo leer el archivo.")); };
      lector.readAsText(archivo);
    });
    var respaldo;
    try { respaldo = JSON.parse(texto); }
    catch (error) { throw new Error("El archivo no contiene un JSON válido."); }
    if (!respaldo || respaldo.version !== 1 || !Array.isArray(respaldo.documentos)
      || !Array.isArray(respaldo.plantillas) || respaldo.documentos.length > 1000
      || respaldo.plantillas.length > 500) {
      throw new Error("El archivo no tiene el formato de copia de seguridad de ADEP.");
    }
    respaldo.documentos.forEach(validarDocumentoImportado);
    window.adepPlantillas.validarImportacion(respaldo.plantillas);
    var confirmar = await window.dialogosApp.confirmar(
      "¿Importar copia de seguridad?",
      "Se combinarán " + respaldo.documentos.length + " documentos y " + respaldo.plantillas.length
        + " plantillas con lo que ya existe. Los registros con el mismo identificador se actualizarán.",
      "Importar"
    );
    if (!confirmar) { return; }
    var plantillasAnteriores = window.adepPlantillas.exportar();
    if (!window.adepPlantillas.importar(respaldo.plantillas)) {
      throw new Error("No se pudieron guardar las plantillas importadas. Los documentos no se modificaron.");
    }
    try {
      await window.adepDocumentos.importar(respaldo.documentos);
    } catch (error) {
      if (!window.adepPlantillas.reemplazar(plantillasAnteriores)) {
        throw new Error("Falló la importación de documentos y no se pudieron restaurar las plantillas anteriores.");
      }
      throw error;
    }
    document.getElementById("estado-documentos").textContent =
      "Copia restaurada: " + respaldo.documentos.length + " documentos y "
      + respaldo.plantillas.length + " plantillas.";
  }

  async function exportarRespaldo() {
    try {
      var respaldo = {
        version: 1,
        aplicacion: "ADEP",
        exportado: new Date().toISOString(),
        documentos: await window.adepDocumentos.exportar(),
        plantillas: window.adepPlantillas.exportar()
      };
      descargarArchivo("respaldo-adep-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(respaldo, null, 2));
      document.getElementById("estado-documentos").textContent = "Copia de seguridad descargada en este dispositivo.";
    } catch (error) {
      console.error("No se pudo exportar la copia de seguridad:", error);
      await window.dialogosApp.aviso("No se pudo crear la copia", "Inténtalo de nuevo. Si el problema continúa, revisa el espacio disponible.");
    }
  }

  function emitirActualizacion() {
    document.getElementById("formulario-boleta").dispatchEvent(new Event("input", { bubbles: true }));
  }

  function restablecerFormulario() {
    documentoActualId = null;
    localStorage.removeItem(CLAVE_BORRADOR_BOLETA);
    ["in-funcionario", "in-area", "in-trabajo", "in-justificacion", "in-fecha", "in-inicio", "in-fin"]
      .forEach(function (id) { document.getElementById(id).value = ""; });
    document.querySelectorAll("#formulario-boleta .selector").forEach(function (selector) {
      var boton = selector.querySelector(".selector__boton");
      boton.textContent = boton.getAttribute("data-vacio");
      boton.classList.add("selector__boton--vacio");
    });
    document.querySelectorAll("[data-hora-manual]").forEach(function (entrada) {
      entrada.value = "";
      entrada.setAttribute("aria-invalid", "false");
      var aviso = document.getElementById(entrada.getAttribute("aria-describedby"));
      if (aviso) { aviso.hidden = true; }
    });
    document.querySelector('input[name="texto-tamano"][value="normal"]').checked = true;
    document.getElementById("opcion-negrita").checked = false;
    aplicarEstiloTexto();
    emitirActualizacion();
    firmaBaseBoleta = firmaBoleta();
  }

  function actualizarBotonSelector(id, texto, valorManual) {
    var entrada = document.getElementById(id);
    var boton = entrada.parentElement.querySelector(".selector__boton");
    boton.textContent = texto || boton.getAttribute("data-vacio");
    boton.classList.toggle("selector__boton--vacio", !texto);
    var manual = entrada.parentElement.querySelector("[data-hora-manual]");
    if (manual) {
      manual.value = valorManual || "";
      manual.setAttribute("aria-invalid", "false");
      var aviso = document.getElementById(manual.getAttribute("aria-describedby"));
      if (aviso) { aviso.hidden = true; }
    }
  }

  function aplicarEstiloTexto() {
    var hoja = document.getElementById("boleta");
    var tamano = document.querySelector('input[name="texto-tamano"]:checked').value;
    ["muy-pequeno", "normal", "grande", "muy-grande"].forEach(function (nivel) {
      hoja.classList.toggle("datos--" + nivel, nivel === tamano);
    });
    hoja.classList.toggle("datos--negrita", document.getElementById("opcion-negrita").checked);
    emitirActualizacion();
  }

  function abrirDocumento(id) {
    var documento = leerDocumentos().find(function (item) { return item.id === id; });
    if (!documento) { return; }
    if (documento.tipo === "personalizada") {
      if (window.adepPlantillas) { window.adepPlantillas.abrirDocumento(documento); }
      return;
    }
    documentoActualId = documento.id;
    Object.keys(documento.datos).forEach(function (campo) {
      var entrada = document.getElementById("in-" + campo);
      if (entrada) { entrada.value = documento.datos[campo] || ""; }
    });
    actualizarBotonSelector("in-area", documento.datos.area);
    actualizarBotonSelector("in-fecha", textoFecha(documento.datos.fecha) === "Sin fecha" ? "" : textoFecha(documento.datos.fecha));
    var horaInicio = documento.datos.inicio || "";
    var horaFin = documento.datos.fin || "";
    actualizarBotonSelector("in-inicio", formatearHora(horaInicio), horaInicio);
    actualizarBotonSelector("in-fin", formatearHora(horaFin), horaFin);
    var tamano = documento.datos.textoTamano || (documento.datos.textoGrande ? "grande" : "normal");
    var opcionTamano = document.querySelector('input[name="texto-tamano"][value="' + tamano + '"]')
      || document.querySelector('input[name="texto-tamano"][value="normal"]');
    opcionTamano.checked = true;
    document.getElementById("opcion-negrita").checked = !!documento.datos.negrita;
    aplicarEstiloTexto();
    firmaBaseBoleta = firmaBoleta();
    mostrarPantalla("pantalla-editor");
    window.requestAnimationFrame(emitirActualizacion);
  }

  window.adepDocumentos = {
    exportar: function () {
      return (promesaCargaDocumentos || Promise.resolve()).then(function () { return documentosActuales.slice(); });
    },
    importar: function (documentos) {
      var unidos = documentosActuales.slice();
      documentos.forEach(function (documento) {
        unidos = unidos.filter(function (actual) { return actual.id !== documento.id; });
        unidos.push(documento);
      });
      return abrirBaseDatos().then(function (db) {
        return new Promise(function (resolver, rechazar) {
          var transaccion = db.transaction("documentos", "readwrite");
          var almacen = transaccion.objectStore("documentos");
          unidos.forEach(function (documento) { almacen.put(documento); });
          transaccion.oncomplete = function () {
            documentosActuales = unidos;
            localStorage.removeItem(CLAVE_DOCUMENTOS);
            pintarDocumentos();
            resolver(documentos.length);
          };
          transaccion.onerror = function () { rechazar(transaccion.error); };
          transaccion.onabort = function () { rechazar(transaccion.error || new Error("Se canceló la importación.")); };
        });
      }).catch(function (error) {
        try {
          localStorage.setItem(CLAVE_DOCUMENTOS, JSON.stringify(unidos));
          documentosActuales = unidos;
          pintarDocumentos();
          return documentos.length;
        } catch (errorLocal) {
          console.error("No se pudieron importar los documentos:", error, errorLocal);
          throw errorLocal;
        }
      });
    },
    guardar: function (documento) {
      var documentos = documentosActuales.filter(function (item) { return item.id !== documento.id; });
      documentos.push(documento);
      return guardarEnBase(documento).then(function () {
        documentosActuales = documentos;
        localStorage.removeItem(CLAVE_DOCUMENTOS);
        pintarDocumentos();
      }).catch(function (error) {
        try {
          localStorage.setItem(CLAVE_DOCUMENTOS, JSON.stringify(documentos));
          documentosActuales = documentos;
          pintarDocumentos();
        } catch (errorLocal) {
          console.error("No se pudo guardar el documento:", error, errorLocal);
          throw errorLocal;
        }
      });
    }
  };

  function formatearHora(valor) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(valor || "");
    if (!m) { return ""; }
    return ("0" + parseInt(m[1], 10)).slice(-2) + ":" + m[2];
  }

  function formatoFechaBoleta(valor) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1].slice(2) : "";
  }

  function crearMiniatura(datos) {
    if (!window.html2canvas) { return Promise.resolve(""); }
    var original = document.getElementById("boleta");
    var copia = original.cloneNode(true);
    copia.removeAttribute("id");
    copia.querySelectorAll("[id]").forEach(function (elemento) { elemento.removeAttribute("id"); });
    copia.style.transform = "none";
    copia.style.boxShadow = "none";
    copia.style.position = "fixed";
    copia.style.left = "-10000px";
    copia.style.top = "0";
    var tamano = datos.textoTamano || (datos.textoGrande ? "grande" : "normal");
    ["muy-pequeno", "normal", "grande", "muy-grande"].forEach(function (nivel) {
      copia.classList.toggle("datos--" + nivel, nivel === tamano);
    });
    copia.classList.toggle("datos--negrita", !!datos.negrita);
    copia.querySelectorAll(".b-foto-ref").forEach(function (foto) { foto.remove(); });

    var salidas = [
      [".f1 .b-campo__texto", datos.funcionario],
      [".f2 .b-campo__texto", datos.area],
      [".f3 .b-campo__texto", datos.trabajo],
      [".f4 .b-campo__texto", datos.justificacion],
      [".f5 .b-campo__texto", formatoFechaBoleta(datos.fecha)],
      [".f6 .b-linea--inicio .b-campo__texto", formatearHora(datos.inicio)],
      [".f6 .b-linea--fin .b-campo__texto", formatearHora(datos.fin)]
    ];
    salidas.forEach(function (salida) {
      var elemento = copia.querySelector(salida[0]);
      if (elemento) { elemento.textContent = salida[1] || ""; }
    });
    document.body.appendChild(copia);

    return window.html2canvas(copia, {
      scale: 1,
      backgroundColor: "#ffffff",
      logging: false,
      width: copia.offsetWidth,
      height: copia.offsetHeight
    }).then(function (canvas) {
      copia.remove();
      return canvas.toDataURL("image/jpeg", 0.88);
    }).catch(function (error) {
      copia.remove();
      console.error("No se pudo crear la vista previa:", error);
      return "";
    });
  }

  async function guardarDocumento() {
    var botonGuardar = document.getElementById("btn-guardar");
    var entradasHora = Array.prototype.slice.call(document.querySelectorAll("[data-hora-manual]"));
    var horaInvalida = entradasHora.find(function (entrada) {
      var idOculto = entrada.id === "hora-manual-inicio" ? "in-inicio" : "in-fin";
      return entrada.value.trim() && !/^\d{2}:\d{2}$/.test(document.getElementById(idOculto).value);
    });
    if (horaInvalida) {
      horaInvalida.setAttribute("aria-invalid", "true");
      document.getElementById(horaInvalida.getAttribute("aria-describedby")).hidden = false;
      horaInvalida.focus();
      window.dialogosApp.aviso("Revisa la hora", "Escribe cuatro dígitos en formato de 24 horas, por ejemplo 1630 para las 16:30.");
      return;
    }

    botonGuardar.disabled = true;
    botonGuardar.textContent = "Guardando...";
    var ahora = new Date().toISOString();
    var datos = capturarDatosBoleta();
    datos.funcionario = datos.funcionario.trim();
    datos.trabajo = datos.trabajo.trim();
    datos.justificacion = datos.justificacion.trim();
    delete datos.horaInicioManual;
    delete datos.horaFinManual;
    var documento = documentosActuales.find(function (item) { return item.id === documentoActualId; });

    if (documento) {
      documento.datos = datos;
      documento.actualizado = ahora;
    } else {
      documento = {
        id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
        tipo: "horas-extras",
        datos: datos,
        creado: ahora,
        actualizado: ahora
      };
    }

    try {
      documento.miniatura = await crearMiniatura(datos) || documento.miniatura || "";
      if (navigator.storage && navigator.storage.persist) {
        try { await navigator.storage.persist(); } catch (error) { /* El navegador puede rechazar la persistencia. */ }
      }
      await guardarEnBase(documento);
      documentosActuales = documentosActuales.filter(function (item) { return item.id !== documento.id; });
      documentosActuales.push(documento);
      localStorage.removeItem(CLAVE_DOCUMENTOS);
    } catch (error) {
      try {
        var respaldo = documentosActuales.filter(function (item) { return item.id !== documento.id; });
        respaldo.push(documento);
        localStorage.setItem(CLAVE_DOCUMENTOS, JSON.stringify(respaldo));
        documentosActuales = respaldo;
      } catch (errorLocal) {
        window.dialogosApp.aviso("No se pudo guardar", "Comprueba el espacio disponible en el dispositivo e inténtalo de nuevo.");
        botonGuardar.disabled = false;
        botonGuardar.textContent = "Guardar";
        return;
      }
    }

    documentoActualId = documento.id;
    localStorage.removeItem(CLAVE_BORRADOR_BOLETA);
    firmaBaseBoleta = firmaBoleta();
    pintarDocumentos();
    botonGuardar.disabled = false;
    botonGuardar.textContent = "Guardar";
    mostrarPantalla("pantalla-inicio");
    window.dialogosApp.aviso("Documento guardado", "La boleta quedó guardada en este dispositivo.");
  }

  // Muestra la pantalla con el id indicado y oculta las demás
  function mostrarPantalla(id) {
    var destino = document.getElementById(id);
    if (!destino) {
      console.error("No existe la pantalla: " + id);
      return;
    }
    document.querySelectorAll(".pantalla").forEach(function (p) {
      p.classList.remove(CLASE_ACTIVA);
    });
    destino.classList.add(CLASE_ACTIVA);
    var titulo = destino.querySelector("h1");
    if (titulo) { titulo.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }

  // Un solo "oyente" para todos los botones de navegación
  document.querySelectorAll('input[name="texto-tamano"]').forEach(function (opcion) {
    opcion.addEventListener("change", aplicarEstiloTexto);
  });
  document.getElementById("opcion-negrita").addEventListener("change", aplicarEstiloTexto);

  document.getElementById("formulario-boleta").addEventListener("input", programarBorradorBoleta);
  document.getElementById("formulario-boleta").addEventListener("change", programarBorradorBoleta);
  document.getElementById("buscar-documentos").addEventListener("input", function (evento) {
    filtroDocumentos.consulta = evento.target.value.trim();
    pintarDocumentos();
  });
  document.getElementById("filtro-documentos").addEventListener("change", function (evento) {
    filtroDocumentos.tipo = evento.target.value;
    pintarDocumentos();
  });
  document.getElementById("exportar-respaldo").addEventListener("click", exportarRespaldo);
  document.getElementById("importar-respaldo").addEventListener("click", function () {
    document.getElementById("archivo-respaldo").click();
  });
  document.getElementById("archivo-respaldo").addEventListener("change", function (evento) {
    importarRespaldo(evento.target.files[0]).catch(async function (error) {
      console.error("No se pudo importar la copia de seguridad:", error);
      await window.dialogosApp.aviso("No se pudo importar", error.message || "Comprueba que el archivo sea una copia válida de ADEP.");
    }).finally(function () { evento.target.value = ""; });
  });

  firmaBaseBoleta = firmaBoleta();
  window.addEventListener("beforeunload", function (evento) {
    var cambiosPlantilla = window.adepPlantillas && window.adepPlantillas.hayCambiosPendientes();
    if (!hayCambiosBoleta() && !cambiosPlantilla) { return; }
    if (hayCambiosBoleta()) { guardarBorradorBoleta(); }
    if (window.adepPlantillas) { window.adepPlantillas.guardarBorradorActual(); }
    evento.preventDefault();
    evento.returnValue = "";
  });

  document.addEventListener("click", async function (evento) {
    var boton = evento.target.closest("[data-ir]");
    if (boton) {
      if (document.getElementById("pantalla-editor").classList.contains(CLASE_ACTIVA)
        && boton.getAttribute("data-ir") !== "pantalla-editor" && !(await confirmarSalidaBoleta())) { return; }
      if (window.adepPlantillas && !(await window.adepPlantillas.confirmarSalida(boton.getAttribute("data-ir")))) { return; }
      if (boton.hasAttribute("data-plantilla")) { await prepararNuevoDocumento(); }
      mostrarPantalla(boton.getAttribute("data-ir"));
      return;
    }

    var guardar = evento.target.closest("#btn-guardar");
    if (guardar) {
      guardarDocumento();
      return;
    }

    var abrir = evento.target.closest("[data-abrir-documento]");
    if (abrir) {
      abrirDocumento(abrir.getAttribute("data-abrir-documento"));
      return;
    }

    var eliminar = evento.target.closest("[data-eliminar-documento]");
    if (eliminar) {
      var confirmar = await window.dialogosApp.confirmar("¿Eliminar documento?", "Este documento se quitará de este dispositivo. Esta acción no se puede deshacer.", "Eliminar");
      if (!confirmar) { return; }
      var id = eliminar.getAttribute("data-eliminar-documento");
      eliminarDeBase(id).then(function () {
        documentosActuales = documentosActuales.filter(function (documento) { return documento.id !== id; });
        pintarDocumentos();
      }).catch(function () {
        documentosActuales = documentosActuales.filter(function (documento) { return documento.id !== id; });
        try { localStorage.setItem(CLAVE_DOCUMENTOS, JSON.stringify(documentosActuales)); } catch (error) { /* El registro ya no se muestra en esta sesión. */ }
        pintarDocumentos();
      });
    }
  });

  promesaCargaDocumentos = cargarDocumentos();
})();
