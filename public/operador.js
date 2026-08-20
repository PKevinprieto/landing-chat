console.log("operador.js cargado");

const socket = io();
socket.on("connect", () => {
  console.log("Operador conectado:", socket.id);

  socket.emit("operador:solicitar-conversaciones");
  socket.emit("operador:solicitar-atajos");
});

const messages = document.getElementById("operador-messages");
const form = document.getElementById("operador-form");
const input = document.getElementById("operador-input");
const conversationList = document.getElementById("conversation-list");
const contactName = document.getElementById("operador-contact-name");
const contactStatus = document.getElementById("operador-contact-status");
const captureEditor = document.getElementById("capture-editor");

const captureCanvas = document.getElementById("capture-canvas");

const captureClear = document.getElementById("capture-clear");

const captureCancel = document.getElementById("capture-cancel");

const captureSend = document.getElementById("capture-send");

const captureCtx = captureCanvas.getContext("2d");
const contactModal = document.getElementById("contact-modal");

const contactNameInput = document.getElementById("contact-name-input");

const contactModalClose = document.getElementById("contact-modal-close");

const contactModalCancel = document.getElementById("contact-modal-cancel");

const contactModalSave = document.getElementById("contact-modal-save");
const emojiButton = document.getElementById("emoji-button");

const emojiPicker = document.getElementById("emoji-picker");
emojiButton.addEventListener("click", (event) => {
  event.stopPropagation();

  emojiPicker.classList.toggle("active");
});
emojiPicker.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    const emoji = button.textContent;

    const inicio = input.selectionStart;
    const final = input.selectionEnd;

    const textoActual = input.value;

    input.value =
      textoActual.slice(0, inicio) + emoji + textoActual.slice(final);

    const nuevaPosicion = inicio + emoji.length;

    input.focus();

    input.setSelectionRange(nuevaPosicion, nuevaPosicion);
  });
});
document.addEventListener("click", (event) => {
  if (!emojiPicker.contains(event.target) && event.target !== emojiButton) {
    emojiPicker.classList.remove("active");
  }
});
const replyPreview = document.getElementById("reply-preview");
const operadorLinkButton = document.getElementById("operador-link-button");
const tabConversaciones = document.getElementById("tab-conversaciones");

const tabAtajos = document.getElementById("tab-atajos");

const seccionConversaciones = document.getElementById("seccion-conversaciones");

const seccionAtajos = document.getElementById("seccion-atajos");

const shortcutsList = document.getElementById("shortcuts-list");

const nuevoAtajoBtn = document.getElementById("nuevo-atajo-btn");
tabConversaciones.addEventListener("click", () => {
  tabConversaciones.classList.add("active");
  tabAtajos.classList.remove("active");

  seccionConversaciones.style.display = "block";
  seccionAtajos.style.display = "none";
});

tabAtajos.addEventListener("click", () => {
  tabAtajos.classList.add("active");
  tabConversaciones.classList.remove("active");

  seccionConversaciones.style.display = "none";
  seccionAtajos.style.display = "block";

  socket.emit("operador:solicitar-atajos");
});
socket.on("operador:atajos", (atajos) => {
  console.log("Atajos recibidos:", atajos);
  atajosActuales = atajos;
  shortcutsList.innerHTML = "";

  if (atajos.length === 0) {
    shortcutsList.innerHTML = `
      <div class="shortcuts-empty">
        Todavía no creaste ningún atajo.
      </div>
    `;

    return;
  }

  atajos.forEach((atajo) => {
    const item = document.createElement("div");

    item.classList.add("shortcut-item");

    const tipo =
      atajo.kind === "text" ? "Mensaje de texto" : "Tarjeta de enlace";

    item.innerHTML = `
  <div class="shortcut-item-top">

    <div>
      <div class="shortcut-name">
        ${atajo.name}
      </div>

      <div class="shortcut-type">
        ${atajo.kind === "text" ? "Mensaje de texto" : "Tarjeta de enlace"}
      </div>
    </div>

    <div class="shortcut-item-actions">

      <span class="shortcut-key">
        ${atajo.key}
      </span>

      <button
        type="button"
        class="shortcut-edit-btn"
        title="Editar"
      >
        ✏️
      </button>

      <button
        type="button"
        class="shortcut-delete-btn"
        title="Eliminar"
      >
        🗑️
      </button>

    </div>

  </div>
`;

    const editBtn = item.querySelector(".shortcut-edit-btn");

    const deleteBtn = item.querySelector(".shortcut-delete-btn");

    editBtn.addEventListener("click", () => {
      abrirModalEditarAtajo(atajo);
    });

    deleteBtn.addEventListener("click", () => {
      const confirmar = confirm(`¿Eliminar el atajo "${atajo.name}"?`);

      if (!confirmar) {
        return;
      }

      socket.emit("operador:eliminar-atajo", {
        id: atajo.id,
      });
    });

    shortcutsList.appendChild(item);
  });
});
const shortcutModal = document.getElementById("shortcut-modal");

const shortcutModalClose = document.getElementById("shortcut-modal-close");

const shortcutModalCancel = document.getElementById("shortcut-modal-cancel");

const shortcutModalSave = document.getElementById("shortcut-modal-save");

const shortcutNameInput = document.getElementById("shortcut-name-input");

const shortcutKeySelect = document.getElementById("shortcut-key-select");

const shortcutKindSelect = document.getElementById("shortcut-kind-select");

const shortcutTextFields = document.getElementById("shortcut-text-fields");

const shortcutTextInput = document.getElementById("shortcut-text-input");

const shortcutLinkFields = document.getElementById("shortcut-link-fields");

const shortcutLinkTitle = document.getElementById("shortcut-link-title");

const shortcutLinkDescription = document.getElementById(
  "shortcut-link-description",
);

const shortcutLinkButtonText = document.getElementById(
  "shortcut-link-button-text",
);

const shortcutLinkUrl = document.getElementById("shortcut-link-url");
function abrirModalAtajo() {
  atajoEditandoId = null;
  const modalTitle = document.querySelector(".shortcut-modal-header h3");

  modalTitle.textContent = "Nuevo atajo";
  shortcutNameInput.value = "";
  shortcutKeySelect.value = "F1";
  shortcutKindSelect.value = "text";

  shortcutTextInput.value = "";

  shortcutLinkTitle.value = "";
  shortcutLinkDescription.value = "";
  shortcutLinkButtonText.value = "";
  shortcutLinkUrl.value = "";

  shortcutTextFields.style.display = "block";
  shortcutLinkFields.style.display = "none";

  shortcutModal.classList.add("active");

  setTimeout(() => {
    shortcutNameInput.focus();
  }, 0);
}

function cerrarModalAtajo() {
  shortcutModal.classList.remove("active");
}
nuevoAtajoBtn.addEventListener("click", abrirModalAtajo);

shortcutModalClose.addEventListener("click", cerrarModalAtajo);

shortcutModalCancel.addEventListener("click", cerrarModalAtajo);

shortcutModal.addEventListener("click", (event) => {
  if (event.target === shortcutModal) {
    cerrarModalAtajo();
  }
});
shortcutKindSelect.addEventListener("change", () => {
  const kind = shortcutKindSelect.value;

  if (kind === "text") {
    shortcutTextFields.style.display = "block";
    shortcutLinkFields.style.display = "none";
  } else {
    shortcutTextFields.style.display = "none";
    shortcutLinkFields.style.display = "flex";
  }
});
shortcutModalSave.addEventListener("click", () => {
  const name = shortcutNameInput.value.trim();
  const key = shortcutKeySelect.value;
  const kind = shortcutKindSelect.value;
  const evento = atajoEditandoId
    ? "operador:editar-atajo"
    : "operador:crear-atajo";

  if (!name) {
    shortcutNameInput.focus();
    return;
  }

  if (kind === "text") {
    const text = shortcutTextInput.value.trim();

    if (!text) {
      shortcutTextInput.focus();
      return;
    }

    socket.emit(evento, {
      id: atajoEditandoId,
      name,
      key,
      kind,
      text,
    });
  }

  if (kind === "link") {
    const linkTitle = shortcutLinkTitle.value.trim();

    const linkDescription = shortcutLinkDescription.value.trim();

    const linkButtonText = shortcutLinkButtonText.value.trim();

    let linkUrl = shortcutLinkUrl.value.trim();

    if (!linkTitle || !linkButtonText || !linkUrl) {
      return;
    }

    if (!/^https?:\/\//i.test(linkUrl)) {
      linkUrl = "https://" + linkUrl;
    }

    socket.emit(evento, {
      id: atajoEditandoId,

      name,
      key,
      kind,

      linkTitle,
      linkDescription,
      linkButtonText,
      linkUrl,
    });
  }
  atajoEditandoId = null;
  cerrarModalAtajo();
});
socket.on("operador:error-atajo", (data) => {
  alert(data.message);
});

const linkModal = document.getElementById("link-modal");

const linkModalClose = document.getElementById("link-modal-close");

const linkModalCancel = document.getElementById("link-modal-cancel");

const linkModalSend = document.getElementById("link-modal-send");

const linkTitleInput = document.getElementById("link-title-input");

const linkDescriptionInput = document.getElementById("link-description-input");

const linkButtonTextInput = document.getElementById("link-button-text-input");

const linkUrlInput = document.getElementById("link-url-input");
function abrirModalEnlace() {
  if (!visitanteSeleccionado) {
    return;
  }

  linkTitleInput.value = "";
  linkDescriptionInput.value = "";
  linkButtonTextInput.value = "";
  linkUrlInput.value = "";

  linkModal.classList.add("active");

  setTimeout(() => {
    linkTitleInput.focus();
  }, 0);
}

function cerrarModalEnlace() {
  linkModal.classList.remove("active");
}
linkModalSend.addEventListener("click", () => {
  if (!visitanteSeleccionado) {
    return;
  }

  const title = linkTitleInput.value.trim();
  const description = linkDescriptionInput.value.trim();
  const buttonText = linkButtonTextInput.value.trim();
  let url = linkUrlInput.value.trim();

  if (!title || !buttonText || !url) {
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }

  const linkData = {
    title,
    description,
    buttonText,
    url,
  };

  addLinkCard(linkData, "sent");

  socket.emit("operador:link", {
    visitorId: visitanteSeleccionado,
    ...linkData,
  });

  cerrarModalEnlace();
});
function addLinkCard(linkData, type) {
  const message = document.createElement("div");

  message.classList.add("message", type, "link-message");

  const card = document.createElement("div");
  card.classList.add("link-card");

  const title = document.createElement("div");
  title.classList.add("link-card-title");
  title.textContent = linkData.title;

  card.appendChild(title);

  if (linkData.description) {
    const description = document.createElement("div");

    description.classList.add("link-card-description");
    description.textContent = linkData.description;

    card.appendChild(description);
  }

  const button = document.createElement("a");

  button.classList.add("link-card-button");
  button.href = linkData.url;
  button.target = "_blank";
  button.rel = "noopener noreferrer";
  button.textContent = linkData.buttonText;

  card.appendChild(button);

  message.appendChild(card);
  messages.appendChild(message);

  messages.scrollTop = messages.scrollHeight;
}
operadorLinkButton.addEventListener("click", abrirModalEnlace);

linkModalClose.addEventListener("click", cerrarModalEnlace);

linkModalCancel.addEventListener("click", cerrarModalEnlace);

linkModal.addEventListener("click", (event) => {
  if (event.target === linkModal) {
    cerrarModalEnlace();
  }
});

const replyPreviewText = document.getElementById("reply-preview-text");

const replyPreviewClose = document.getElementById("reply-preview-close");
const operadorImageInput = document.getElementById("operador-image-input");

const operadorImageButton = document.getElementById("operador-image-button");
operadorImageButton.addEventListener("click", () => {
  if (!visitanteSeleccionado) {
    return;
  }

  operadorImageInput.click();
});
operadorImageInput.addEventListener("change", async () => {
  const file = operadorImageInput.files[0];

  if (!file) {
    return;
  }

  if (!visitanteSeleccionado) {
    operadorImageInput.value = "";
    return;
  }

  const formData = new FormData();

  formData.append("image", file);

  try {
    const response = await fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.ok) {
      return;
    }

    addImage(result.imageUrl, "sent");

    socket.emit("operador:imagen", {
      visitorId: visitanteSeleccionado,
      imageUrl: result.imageUrl,
    });

    operadorImageInput.value = "";
  } catch (error) {
    console.error("Error subiendo imagen:", error);
  }
});
const editarContactoBtn = document.getElementById("editar-contacto-btn");
const operadorHeader = document.querySelector(".operador-header");
let atajosActuales = [];
let atajoEditandoId = null;
let visitanteSeleccionado = null;
let mensajeCitado = null;
let ultimoMensajeTemporal = null;
let conversacionActual = null;
let audioContextOperador = null;
let audioOperadorHabilitado = false;
function habilitarAudioOperador() {
  if (audioOperadorHabilitado) {
    return;
  }

  audioContextOperador = new (
    window.AudioContext || window.webkitAudioContext
  )();

  if (audioContextOperador.state === "suspended") {
    audioContextOperador.resume();
  }

  audioOperadorHabilitado = true;

  console.log("🔊 Audio del operador habilitado");
}
document.addEventListener("click", habilitarAudioOperador, {
  once: true,
});

document.addEventListener("keydown", habilitarAudioOperador, {
  once: true,
});
const mensajesNoLeidos = new Map();
const visitantesPendientes = new Set();
let intervaloNotificacion = null;
function obtenerAudioContextOperador() {
  if (!audioContextOperador) {
    audioContextOperador = new (
      window.AudioContext || window.webkitAudioContext
    )();
  }

  if (audioContextOperador.state === "suspended") {
    audioContextOperador.resume();
  }

  return audioContextOperador;
}

function sonarNotificacionOperador() {
  if (!audioOperadorHabilitado || !audioContextOperador) {
    console.log("🔇 Audio todavía no habilitado");
    return;
  }

  const oscillator = audioContextOperador.createOscillator();

  const gain = audioContextOperador.createGain();

  oscillator.connect(gain);
  gain.connect(audioContextOperador.destination);

  oscillator.frequency.value = 850;

  gain.gain.setValueAtTime(0.18, audioContextOperador.currentTime);

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContextOperador.currentTime + 0.3,
  );

  oscillator.start();

  oscillator.stop(audioContextOperador.currentTime + 0.3);
}

function hayMensajesNoLeidos() {
  if (visitantesPendientes.size > 0) {
    return true;
  }

  for (const cantidad of mensajesNoLeidos.values()) {
    if (cantidad > 0) {
      return true;
    }
  }

  return false;
}

function iniciarNotificacionRepetida() {
  if (intervaloNotificacion) {
    return;
  }

  sonarNotificacionOperador();

  intervaloNotificacion = setInterval(() => {
    if (!hayMensajesNoLeidos()) {
      detenerNotificacionRepetida();
      return;
    }

    sonarNotificacionOperador();
  }, 1000);
}

function detenerNotificacionRepetida() {
  if (!intervaloNotificacion) {
    return;
  }

  clearInterval(intervaloNotificacion);
  intervaloNotificacion = null;
}
// =========================
// LISTA DE CONVERSACIONES
// =========================

socket.on("operador:conversaciones", (conversaciones) => {
  console.log("Conversaciones recibidas:", conversaciones);
  if (visitanteSeleccionado) {
    const conversacionActual = conversaciones.find(
      (conversacion) => conversacion.visitorId === visitanteSeleccionado,
    );

    if (conversacionActual) {
      actualizarHeaderContacto(conversacionActual);
    }
  }

  conversationList.innerHTML = "";

  conversaciones.forEach((conversacion) => {
    const item = document.createElement("div");

    item.classList.add("conversation");

    if (visitanteSeleccionado === conversacion.visitorId) {
      item.classList.add("active");
    }

    const idCorto = conversacion.visitorId.slice(0, 8);
    const nombreContacto = conversacion.name || `Visitante ${idCorto}`;
    let estadoConexion = "";

    if (conversacion.online) {
      estadoConexion = `
    <span class="online-status">
      <span class="online-dot"></span>
      En línea
    </span>
  `;
    } else if (conversacion.lastSeen) {
      const ultimaConexion = new Date(conversacion.lastSeen).toLocaleTimeString(
        "es-AR",
        {
          hour: "2-digit",
          minute: "2-digit",
        },
      );

      estadoConexion = `
    <span class="offline-status">
      Últ. conexión ${ultimaConexion}
    </span>
  `;
    }

    const ultimoMensaje =
      conversacion.mensajes.length > 0
        ? conversacion.mensajes[conversacion.mensajes.length - 1]
        : null;

    const hora = conversacion.updatedAt
      ? new Date(conversacion.updatedAt).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    const noLeidos = mensajesNoLeidos.get(conversacion.visitorId) || 0;

    item.innerHTML = `
  <div class="conversation-top">
    <strong>${nombreContacto}</strong>
    <span>${hora}</span>
  </div>

  <div class="conversation-status">
    ${estadoConexion}
  </div>

  <div class="conversation-bottom">

    <div class="conversation-preview">
      <div class="conversation-preview">
  ${
    ultimoMensaje
      ? ultimoMensaje.kind === "image"
        ? "📷 Imagen"
        : ultimoMensaje.kind === "link"
          ? `🔗 ${ultimoMensaje.linkTitle || "Enlace"}`
          : ultimoMensaje.text
      : "Sin mensajes todavía"
  }
</div>
    </div>

    ${
      noLeidos > 0
        ? `<span class="unread-badge">${noLeidos > 9 ? "+9" : noLeidos}</span>`
        : ""
    }

  </div>
`;

    item.addEventListener("click", () => {
      visitanteSeleccionado = conversacion.visitorId;
      visitantesPendientes.delete(conversacion.visitorId);
      operadorHeader.style.display = "flex";
      form.style.display = "flex";
      actualizarHeaderContacto(conversacion);
      mensajesNoLeidos.set(conversacion.visitorId, 0);
      if (!hayMensajesNoLeidos()) {
        detenerNotificacionRepetida();
      }

      console.log("Visitante seleccionado:", visitanteSeleccionado);

      mostrarConversacion(conversacion);

      document.querySelectorAll(".conversation").forEach((element) => {
        element.classList.remove("active");
      });

      item.classList.add("active");
      const badge = item.querySelector(".unread-badge");

      if (badge) {
        badge.remove();
      }
      input.focus();
    });

    conversationList.appendChild(item);
  });
});

// =========================
// MENSAJE NUEVO DEL CLIENTE
// =========================

socket.on("operador:mensaje-cliente", (data) => {
  console.log("Mensaje recibido en operador:", data);

  if (data.visitorId !== visitanteSeleccionado) {
    const cantidadActual = mensajesNoLeidos.get(data.visitorId) || 0;

    mensajesNoLeidos.set(data.visitorId, cantidadActual + 1);

    iniciarNotificacionRepetida();

    return;
  }

  // Si estamos viendo esta conversación,
  // mostramos el mensaje directamente
  addMessage(data.text, "received", data);
});
socket.on("operador:imagen-cliente", (data) => {
  console.log("Imagen recibida en operador:", data);

  if (data.visitorId !== visitanteSeleccionado) {
    const cantidadActual = mensajesNoLeidos.get(data.visitorId) || 0;

    mensajesNoLeidos.set(data.visitorId, cantidadActual + 1);

    iniciarNotificacionRepetida();

    return;
  }

  addImage(data.imageUrl, "received");
});
socket.on("operador:mensaje-confirmado", (data) => {
  ultimoMensajeTemporal = null;

  if (data.visitorId !== visitanteSeleccionado) {
    return;
  }

  const mensajeElement = messages.lastElementChild;

  if (!mensajeElement) {
    return;
  }

  mensajeElement.dataset.messageId = data.id;

  const replyButton = document.createElement("button");

  replyButton.type = "button";
  replyButton.classList.add("reply-message-btn");
  replyButton.textContent = "↩";
  replyButton.title = "Responder";

  const messageData = {
    ...data,
  };

  replyButton.addEventListener("click", (event) => {
    event.stopPropagation();

    seleccionarMensajeParaResponder(messageData);
  });

  mensajeElement.appendChild(replyButton);
});
socket.on("operador:cliente-entro", (data) => {
  console.log("👤 Un cliente entró:", data.visitorId);

  visitantesPendientes.add(data.visitorId);

  iniciarNotificacionRepetida();
});

// =========================
// ENVIAR MENSAJE
// =========================

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();

  if (!text) {
    return;
  }

  if (!visitanteSeleccionado) {
    console.log("No hay ninguna conversación seleccionada");
    return;
  }
  const replyToUid = mensajeCitado?.id || null;

  const mensajeCitadoActual = mensajeCitado;

  ultimoMensajeTemporal = {
    type: "operador",
    kind: "text",
    text: text,
    replyToUid: replyToUid,
    replyTo: mensajeCitadoActual,
  };

  addMessage(text, "sent", ultimoMensajeTemporal);

  socket.emit("operador:mensaje", {
    visitorId: visitanteSeleccionado,
    text: text,
    replyToUid: replyToUid,
  });

  input.value = "";
  input.focus();

  mensajeCitado = null;
  replyPreview.style.display = "none";
  replyPreviewText.textContent = "";
});

function actualizarHeaderContacto(conversacion) {
  const idCorto = conversacion.visitorId.slice(0, 8);

  contactName.textContent = conversacion.name || `Visitante ${idCorto}`;

  if (conversacion.online) {
    contactStatus.textContent = "En línea";
    contactStatus.className = "contact-status online";
  } else if (conversacion.lastSeen) {
    const ultimaConexion = new Date(conversacion.lastSeen).toLocaleTimeString(
      "es-AR",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    contactStatus.textContent = `Última conexión ${ultimaConexion}`;

    contactStatus.className = "contact-status offline";
  } else {
    contactStatus.textContent = "Desconectado";
    contactStatus.className = "contact-status offline";
  }
}

// =========================
// MOSTRAR CONVERSACIÓN
// =========================

function mostrarConversacion(conversacion) {
  conversacionActual = conversacion;

  messages.innerHTML = "";

  conversacion.mensajes.forEach((mensaje) => {
    const type = mensaje.type === "cliente" ? "received" : "sent";

    if (mensaje.kind === "image") {
      addImage(mensaje.imageUrl, type);
      return;
    }
    if (mensaje.kind === "link") {
      addLinkCard(
        {
          title: mensaje.linkTitle,
          description: mensaje.linkDescription,
          buttonText: mensaje.linkButtonText,
          url: mensaje.linkUrl,
        },
        type,
      );

      return;
    }
    let replyTo = null;

    if (mensaje.replyToUid) {
      replyTo = conversacion.mensajes.find((m) => m.id === mensaje.replyToUid);
    }

    addMessage(mensaje.text, type, {
      ...mensaje,
      replyTo: replyTo,
    });
  });
}
function buscarMensajePorId(messageId) {
  if (!conversacionActual) {
    return null;
  }

  return conversacionActual.mensajes.find(
    (mensaje) => mensaje.id === messageId,
  );
}

// =========================
// CREAR MENSAJE
// =========================

function addMessage(text, type, messageData = null) {
  const message = document.createElement("div");

  message.classList.add("message", type);

  if (messageData?.id) {
    message.dataset.messageId = messageData.id;
  }

  // Si este mensaje responde a otro
  if (messageData?.replyToUid) {
    const mensajeRespondido =
      messageData.replyTo || buscarMensajePorId(messageData.replyToUid);

    if (mensajeRespondido) {
      const replyBox = document.createElement("div");
      replyBox.classList.add("quoted-message");

      const replyAuthor = document.createElement("div");
      replyAuthor.classList.add("quoted-message-author");

      if (mensajeRespondido.type === "cliente") {
        replyAuthor.textContent =
          conversacionActual?.name ||
          `Visitante ${visitanteSeleccionado.slice(0, 8)}`;
      } else {
        replyAuthor.textContent = "Vos";
      }

      const replyContent = document.createElement("div");
      replyContent.classList.add("quoted-message-content");

      if (mensajeRespondido.kind === "image") {
        replyContent.textContent = "📷 Imagen";
      } else {
        replyContent.textContent = mensajeRespondido.text;
      }

      replyBox.appendChild(replyAuthor);
      replyBox.appendChild(replyContent);

      message.appendChild(replyBox);
    }
  }

  const content = document.createElement("div");

  content.classList.add("message-content");
  content.textContent = text;

  message.appendChild(content);

  if (messageData?.id) {
    const replyButton = document.createElement("button");

    replyButton.type = "button";
    replyButton.classList.add("reply-message-btn");
    replyButton.textContent = "↩";
    replyButton.title = "Responder";

    replyButton.addEventListener("click", (event) => {
      event.stopPropagation();

      seleccionarMensajeParaResponder(messageData);
    });

    message.appendChild(replyButton);
  }

  messages.appendChild(message);

  messages.scrollTop = messages.scrollHeight;
}
editarContactoBtn.addEventListener("click", () => {
  if (!visitanteSeleccionado) {
    return;
  }

  const nombreActual = contactName.textContent.trim();

  contactNameInput.value = nombreActual.startsWith("Visitante ")
    ? ""
    : nombreActual;

  contactModal.classList.add("active");

  setTimeout(() => {
    contactNameInput.focus();
    contactNameInput.select();
  }, 0);
});
function cerrarModalContacto() {
  contactModal.classList.remove("active");
  contactNameInput.value = "";
}

function guardarNombreContacto() {
  if (!visitanteSeleccionado) {
    return;
  }

  const nombreLimpio = contactNameInput.value.trim();

  if (!nombreLimpio) {
    contactNameInput.focus();
    return;
  }

  socket.emit("operador:editar-contacto", {
    visitorId: visitanteSeleccionado,
    name: nombreLimpio,
  });

  contactName.textContent = nombreLimpio;

  cerrarModalContacto();
}
contactModalClose.addEventListener("click", cerrarModalContacto);

contactModalCancel.addEventListener("click", cerrarModalContacto);

contactModalSave.addEventListener("click", guardarNombreContacto);

contactModal.addEventListener("click", (event) => {
  if (event.target === contactModal) {
    cerrarModalContacto();
  }
});

contactNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    guardarNombreContacto();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }
  if (contactModal.classList.contains("active")) {
    cerrarModalContacto();
    return;
  }

  if (imageViewer.classList.contains("active")) {
    cerrarImagen();
    return;
  }

  cerrarConversacion();
});

function cerrarConversacion() {
  // Si no hay conversación abierta, no hacer nada
  if (!visitanteSeleccionado) {
    return;
  }

  visitanteSeleccionado = null;

  // Quitar selección visual
  document.querySelectorAll(".conversation").forEach((element) => {
    element.classList.remove("active");
  });
  operadorHeader.style.display = "none";
  form.style.display = "none";
  messages.innerHTML = `
    <div class="empty-chat">
      <h3>Elegí una conversación</h3>
      <p>Seleccioná un contacto para iniciar el chat.</p>
    </div>
  `;
}
function addImage(imageUrl, type) {
  const message = document.createElement("div");

  message.classList.add("message", type, "image-message");

  const image = document.createElement("img");

  image.src = imageUrl;
  image.alt = "Imagen";
  image.addEventListener("click", () => {
    abrirImagen(imageUrl);
  });
  message.appendChild(image);
  messages.appendChild(message);

  messages.scrollTop = messages.scrollHeight;
}
const imageViewer = document.getElementById("image-viewer");
const imageViewerImg = document.getElementById("image-viewer-img");
const imageViewerClose = document.getElementById("image-viewer-close");

function abrirImagen(imageUrl) {
  imageViewerImg.src = imageUrl;
  imageViewer.classList.add("active");
}

function cerrarImagen() {
  imageViewer.classList.remove("active");
  imageViewerImg.src = "";
}

imageViewerClose.addEventListener("click", cerrarImagen);

imageViewer.addEventListener("click", (event) => {
  if (event.target === imageViewer) {
    cerrarImagen();
  }
});
document.addEventListener("paste", (event) => {
  if (!visitanteSeleccionado) {
    return;
  }

  const items = event.clipboardData?.items;

  if (!items) {
    return;
  }

  for (const item of items) {
    if (!item.type.startsWith("image/")) {
      continue;
    }

    const file = item.getAsFile();

    if (!file) {
      continue;
    }

    abrirEditorCaptura(file);

    break;
  }
});
let captureImage = null;
let dibujando = false;
function abrirEditorCaptura(file) {
  const image = new Image();

  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    captureImage = image;

    captureCanvas.width = image.width;
    captureCanvas.height = image.height;

    captureCtx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);

    captureCtx.drawImage(
      image,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height,
    );

    captureEditor.classList.add("active");

    URL.revokeObjectURL(objectUrl);
  };

  image.src = objectUrl;
}
captureCanvas.addEventListener("pointerdown", (event) => {
  dibujando = true;

  const punto = obtenerPosicionCanvas(event);

  captureCtx.beginPath();

  captureCtx.moveTo(punto.x, punto.y);
});

captureCanvas.addEventListener("pointermove", (event) => {
  if (!dibujando) {
    return;
  }

  const punto = obtenerPosicionCanvas(event);

  captureCtx.lineTo(punto.x, punto.y);

  captureCtx.strokeStyle = "red";
  captureCtx.lineWidth = 5;
  captureCtx.lineCap = "round";
  captureCtx.lineJoin = "round";

  captureCtx.stroke();
});

captureCanvas.addEventListener("pointerup", () => {
  dibujando = false;
});

captureCanvas.addEventListener("pointerleave", () => {
  dibujando = false;
});
function obtenerPosicionCanvas(event) {
  const rect = captureCanvas.getBoundingClientRect();

  const escalaX = captureCanvas.width / rect.width;

  const escalaY = captureCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * escalaX,

    y: (event.clientY - rect.top) * escalaY,
  };
}
captureClear.addEventListener("click", () => {
  if (!captureImage) {
    return;
  }

  captureCtx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);

  captureCtx.drawImage(
    captureImage,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height,
  );
});
function cerrarEditorCaptura() {
  captureEditor.classList.remove("active");

  captureImage = null;

  captureCtx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
}
captureCancel.addEventListener("click", () => {
  cerrarEditorCaptura();
});
captureSend.addEventListener("click", () => {
  if (!visitanteSeleccionado) {
    return;
  }

  captureCanvas.toBlob(async (blob) => {
    if (!blob) {
      return;
    }

    const formData = new FormData();

    formData.append("image", blob, `captura-${Date.now()}.png`);

    try {
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!result.ok) {
        return;
      }

      addImage(result.imageUrl, "sent");

      socket.emit("operador:imagen", {
        visitorId: visitanteSeleccionado,

        imageUrl: result.imageUrl,
      });

      cerrarEditorCaptura();
    } catch (error) {
      console.error("Error enviando captura:", error);
    }
  }, "image/png");
});
function seleccionarMensajeParaResponder(messageData) {
  mensajeCitado = messageData;

  replyPreview.style.display = "flex";

  if (messageData.kind === "image") {
    replyPreviewText.textContent = "📷 Imagen";
  } else {
    replyPreviewText.textContent = messageData.text;
  }

  input.focus();
}
replyPreviewClose.addEventListener("click", () => {
  mensajeCitado = null;

  replyPreview.style.display = "none";
  replyPreviewText.textContent = "";
});
document.addEventListener("keydown", (event) => {
  const tecla = event.key.toUpperCase();

  if (!/^F([1-9]|1[0-2])$/.test(tecla)) {
    return;
  }

  if (!visitanteSeleccionado) {
    return;
  }

  const atajo = atajosActuales.find(
    (atajo) => atajo.key.toUpperCase() === tecla,
  );

  if (!atajo) {
    return;
  }

  event.preventDefault();

  ejecutarAtajo(atajo);
});
function ejecutarAtajo(atajo) {
  if (!visitanteSeleccionado) {
    return;
  }

  // =========================
  // ATAJO DE TEXTO
  // =========================

  if (atajo.kind === "text") {
    if (!atajo.text) {
      return;
    }

    addMessage(atajo.text, "sent", {
      id: null,
      type: "operador",
      kind: "text",
      text: atajo.text,
      replyToUid: null,
    });

    socket.emit("operador:mensaje", {
      visitorId: visitanteSeleccionado,
      text: atajo.text,
      replyToUid: null,
    });

    return;
  }

  // =========================
  // ATAJO DE LINK
  // =========================

  if (atajo.kind === "link") {
    if (!atajo.linkUrl) {
      return;
    }

    const linkData = {
      title: atajo.linkTitle,
      description: atajo.linkDescription,
      buttonText: atajo.linkButtonText,
      url: atajo.linkUrl,
    };

    addLinkCard(linkData, "sent");

    socket.emit("operador:link", {
      visitorId: visitanteSeleccionado,
      ...linkData,
    });
  }
}
function abrirModalEditarAtajo(atajo) {
  atajoEditandoId = atajo.id;

  shortcutNameInput.value = atajo.name;
  shortcutKeySelect.value = atajo.key;
  shortcutKindSelect.value = atajo.kind;

  if (atajo.kind === "text") {
    shortcutTextFields.style.display = "block";
    shortcutLinkFields.style.display = "none";

    shortcutTextInput.value = atajo.text || "";

    shortcutLinkTitle.value = "";
    shortcutLinkDescription.value = "";
    shortcutLinkButtonText.value = "";
    shortcutLinkUrl.value = "";
  }

  if (atajo.kind === "link") {
    shortcutTextFields.style.display = "none";
    shortcutLinkFields.style.display = "flex";

    shortcutTextInput.value = "";

    shortcutLinkTitle.value = atajo.linkTitle || "";

    shortcutLinkDescription.value = atajo.linkDescription || "";

    shortcutLinkButtonText.value = atajo.linkButtonText || "";

    shortcutLinkUrl.value = atajo.linkUrl || "";
  }

  const modalTitle = document.querySelector(".shortcut-modal-header h3");

  modalTitle.textContent = "Editar atajo";

  shortcutModal.classList.add("active");

  setTimeout(() => {
    shortcutNameInput.focus();
    shortcutNameInput.select();
  }, 0);
}
