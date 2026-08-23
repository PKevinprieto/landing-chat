console.log("cliente.js cargado");

const socket = io();

const form = document.getElementById("message-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const pushPermissionBox = document.getElementById("push-permission-box");
const clienteAvatarImg = document.querySelector(".cliente-avatar img");

const avatarViewer = document.getElementById("avatar-viewer");

const avatarViewerImg = document.getElementById("avatar-viewer-img");

const avatarViewerClose = document.getElementById("avatar-viewer-close");

function abrirAvatar() {
  avatarViewerImg.src = clienteAvatarImg.src;
  avatarViewer.classList.add("active");
}

function cerrarAvatar() {
  avatarViewer.classList.remove("active");
}

clienteAvatarImg.addEventListener("click", abrirAvatar);

avatarViewerClose.addEventListener("click", cerrarAvatar);

avatarViewer.addEventListener("click", (event) => {
  if (event.target === avatarViewer) {
    cerrarAvatar();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && avatarViewer.classList.contains("active")) {
    cerrarAvatar();
  }
});
const enablePushButton = document.getElementById("enable-push-button");
async function revisarEstadoNotificaciones() {
  try {
    if (
      !("Notification" in window) ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      pushPermissionBox.style.display = "none";
      return;
    }

    const permission = Notification.permission;

    console.log("🔔 Estado notificaciones:", permission);

    // Nunca respondió todavía
    if (permission === "default") {
      pushPermissionBox.style.display = "flex";
      return;
    }

    // Las bloqueó
    if (permission === "denied") {
      pushPermissionBox.style.display = "none";

      mostrarAvisoNotificacionesBloqueadas();

      return;
    }

    // A partir de acá permission === granted
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    // Si tiene permiso pero perdió la suscripción,
    // la recreamos automáticamente
    if (!subscription) {
      console.log("⚠️ Permiso concedido pero sin suscripción. Recreando...");

      const response = await fetch("/api/push/public-key");

      const data = await response.json();

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,

        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    // Aunque ya existiera, la volvemos a guardar
    // en PostgreSQL por si la DB fue limpiada.
    const saveResponse = await fetch("/api/push/subscribe", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        visitorId,
        subscription: subscription.toJSON(),
      }),
    });

    if (!saveResponse.ok) {
      throw new Error("No se pudo sincronizar Push con el servidor");
    }

    console.log("✅ Push sincronizado automáticamente");

    pushPermissionBox.style.display = "none";
  } catch (error) {
    console.error("❌ Error revisando Push:", error);

    pushPermissionBox.style.display = "flex";

    enablePushButton.disabled = false;
    enablePushButton.textContent = "Activar notificaciones";
  }
}
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
enablePushButton.addEventListener("click", async () => {
  console.log("🔔 Se tocó Activar notificaciones");

  // Evita tocarlo varias veces mientras trabaja
  enablePushButton.disabled = true;
  enablePushButton.textContent = "Activando...";

  try {
    // 1. Comprobar compatibilidad
    if (!("Notification" in window)) {
      throw new Error("Este navegador no soporta notificaciones");
    }

    if (!("serviceWorker" in navigator)) {
      throw new Error("Este navegador no soporta Service Worker");
    }

    if (!("PushManager" in window)) {
      throw new Error("Este navegador no soporta notificaciones Push");
    }

    // 2. Revisar permiso actual
    let permission = Notification.permission;

    console.log("Permiso actual de notificaciones:", permission);

    // Solo pedir permiso si todavía nunca respondió
    if (permission === "default") {
      permission = await Notification.requestPermission();

      console.log("Resultado del permiso:", permission);
    }

    // Si previamente las bloqueó, el navegador ya no
    // vuelve a mostrar automáticamente la pregunta
    if (permission === "denied") {
      console.warn("🚫 Las notificaciones están bloqueadas");

      enablePushButton.textContent = "Notificaciones bloqueadas";

      alert(
        "Las notificaciones están bloqueadas en este navegador. Tenés que habilitarlas desde la configuración del sitio.",
      );

      return;
    }

    if (permission !== "granted") {
      throw new Error("No se concedió permiso para notificaciones");
    }

    // 3. Esperar Service Worker
    console.log("Esperando Service Worker...");

    const registration = await navigator.serviceWorker.ready;

    console.log("✅ Service Worker listo:", registration.scope);

    // 4. Obtener VAPID pública
    const response = await fetch("/api/push/public-key");

    if (!response.ok) {
      throw new Error("No se pudo obtener la clave Push");
    }

    const data = await response.json();

    if (!data.publicKey) {
      throw new Error("El servidor no devolvió VAPID_PUBLIC_KEY");
    }

    // 5. Revisar si ya existe suscripción
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.log("No existe suscripción. Creando...");

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,

        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      console.log("✅ Nueva PushSubscription creada");
    } else {
      console.log("✅ Ya existía una PushSubscription");
    }

    // 6. Guardarla SIEMPRE en PostgreSQL
    const subscriptionData = subscription.toJSON();

    const saveResponse = await fetch("/api/push/subscribe", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        visitorId,
        subscription: subscriptionData,
      }),
    });

    const saveResult = await saveResponse.json();

    if (!saveResponse.ok) {
      throw new Error(
        saveResult.message || "No se pudo guardar la suscripción",
      );
    }

    console.log("✅ Suscripción Push guardada en servidor");

    // 7. Ocultar cartel
    pushPermissionBox.style.display = "none";
  } catch (error) {
    console.error("❌ Error activando notificaciones:", error);

    enablePushButton.disabled = false;
    enablePushButton.textContent = "Activar notificaciones";

    alert(
      "No se pudieron activar las notificaciones. Revisá los permisos del navegador e intentá nuevamente.",
    );

    return;
  }

  enablePushButton.disabled = false;
  enablePushButton.textContent = "Activar notificaciones";
});
const imageInput = document.getElementById("image-input");
const imageButton = document.getElementById("image-button");
imageButton.addEventListener("click", () => {
  imageInput.click();
});
imageInput.addEventListener("change", async () => {
  const file = imageInput.files[0];

  if (!file) {
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

    console.log("Imagen subida:", result);

    if (!result.ok) {
      return;
    }

    addImage(result.imageUrl, "sent");

    socket.emit("cliente:imagen", {
      visitorId: visitorId,
      imageUrl: result.imageUrl,
    });

    imageInput.value = "";
  } catch (error) {
    console.error("Error subiendo imagen:", error);
  }
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration =
        await navigator.serviceWorker.register("/service-worker.js");

      console.log("✅ Service Worker registrado:", registration.scope);

      // Revisar si ya tiene notificaciones activadas
      await revisarEstadoNotificaciones();
    } catch (error) {
      console.error("❌ Error registrando Service Worker:", error);
    }
  });
}
let historialActual = [];
let audioHabilitado = false;
let audioContext = null;

function habilitarAudio() {
  if (audioHabilitado) {
    return;
  }

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  audioHabilitado = true;

  console.log("🔊 Sonido habilitado");
}

document.addEventListener("click", habilitarAudio, {
  once: true,
});

document.addEventListener("touchstart", habilitarAudio, {
  once: true,
});
// =========================
// VISITOR ID
// =========================

let visitorId = localStorage.getItem("visitorId");

if (!visitorId) {
  visitorId = crypto.randomUUID();
  localStorage.setItem("visitorId", visitorId);
}

console.log("Visitor ID:", visitorId);

// =========================
// SOCKET
// =========================

socket.on("connect", () => {
  console.log("Cliente conectado a Socket.IO:", socket.id);

  socket.emit("cliente:registrar", {
    visitorId: visitorId,
  });
  informarVisibilidadChat();
});
function informarVisibilidadChat() {
  socket.emit("cliente:visibilidad", {
    visitorId: visitorId,
    visible: document.visibilityState === "visible",
  });
}

document.addEventListener("visibilitychange", informarVisibilidadChat);

window.addEventListener("focus", informarVisibilidadChat);

window.addEventListener("blur", informarVisibilidadChat);

// =========================
// ENVIAR MENSAJE
// =========================

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = input.value.trim();

  if (!text) {
    return;
  }

  addMessage(text, "sent");

  socket.emit("cliente:mensaje", {
    visitorId: visitorId,
    text: text,
  });

  input.value = "";
  input.focus();
});

// =========================
// RECIBIR MENSAJE OPERADOR
// =========================
socket.on("cliente:historial", (historial) => {
  console.log("Historial recibido:", historial);

  historialActual = historial;

  messages.innerHTML = "";

  historial.forEach((mensaje) => {
    const type = mensaje.sender === "cliente" ? "sent" : "received";

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
    if (mensaje.kind === "copy") {
      console.log("COPY DESDE HISTORIAL:", mensaje);
      addCopyCard(
        {
          title: mensaje.copyTitle,
          description: mensaje.copyDescription,
          buttonText: mensaje.copyButtonText,
          copyText: mensaje.copyText,
        },
        type,
      );

      return;
    }

    addMessage(mensaje.text, type, mensaje);
  });
});
socket.on("cliente:mensaje-operador", (data) => {
  console.log("Mensaje recibido del operador:", data);

  historialActual.push({
    id: data.id,
    sender: "operador",
    text: data.text,
    kind: data.kind || "text",
    replyToUid: data.replyToUid || null,
    createdAt: data.createdAt,
  });

  addMessage(data.text, "received", {
    id: data.id,
    sender: "operador",
    text: data.text,
    kind: data.kind || "text",
    replyToUid: data.replyToUid || null,
    createdAt: data.createdAt,
  });
  reproducirSonidoNotificacion();
});
socket.on("cliente:imagen-operador", (data) => {
  console.log("Imagen recibida del operador:", data);

  addImage(data.imageUrl, "received");
  reproducirSonidoNotificacion();
});
socket.on("cliente:copy-operador", (data) => {
  console.log("Tarjeta copy recibida:", data);

  historialActual.push({
    id: data.id,
    sender: "operador",
    kind: "copy",
    text: "[copiar]",
    copyTitle: data.title,
    copyDescription: data.description,
    copyButtonText: data.buttonText,
    copyText: data.copyText,
    createdAt: data.createdAt,
  });

  addCopyCard(
    {
      title: data.title,
      description: data.description,
      buttonText: data.buttonText,
      copyText: data.copyText,
    },
    "received",
  );
  reproducirSonidoNotificacion();
});
socket.on("cliente:link-operador", (data) => {
  console.log("Enlace recibido del operador:", data);

  historialActual.push({
    id: data.id,
    sender: "operador",
    kind: "link",
    text: "[enlace]",
    linkTitle: data.title,
    linkDescription: data.description,
    linkButtonText: data.buttonText,
    linkUrl: data.url,
    createdAt: data.createdAt,
  });

  addLinkCard(
    {
      title: data.title,
      description: data.description,
      buttonText: data.buttonText,
      url: data.url,
    },
    "received",
  );
  reproducirSonidoNotificacion();
});
socket.on("cliente:mensaje-confirmado", (data) => {
  historialActual.push({
    id: data.id,
    sender: data.sender,
    kind: data.kind,
    text: data.text,
    replyToUid: data.replyToUid,
    createdAt: data.createdAt,
  });
});
// =========================
// MOSTRAR MENSAJE
// =========================

function addMessage(text, type, messageData = null) {
  const message = document.createElement("div");

  message.classList.add("message", type);

  // Si responde a otro mensaje
  if (messageData?.replyToUid) {
    const mensajeRespondido = historialActual.find(
      (mensaje) => mensaje.id === messageData.replyToUid,
    );

    if (mensajeRespondido) {
      const replyBox = document.createElement("div");

      replyBox.classList.add("quoted-message");

      const replyAuthor = document.createElement("div");
      replyAuthor.classList.add("quoted-message-author");

      replyAuthor.textContent =
        mensajeRespondido.sender === "cliente" ? "Vos" : "Operador";

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
  renderTextWithLinks(content, text);

  message.appendChild(content);

  messages.appendChild(message);

  messages.scrollTop = messages.scrollHeight;
}
function addImage(imageUrl, type) {
  const message = document.createElement("div");

  message.classList.add("message", type, "image-message");

  const image = document.createElement("img");

  image.src = imageUrl;
  image.alt = "Imagen enviada";
  image.addEventListener("click", () => {
    abrirImagen(imageUrl);
  });
  message.appendChild(image);
  messages.appendChild(message);

  messages.scrollTop = messages.scrollHeight;
}
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

function addCopyCard(copyData, type) {
  const message = document.createElement("div");

  message.classList.add("message", type, "copy-message");

  const card = document.createElement("div");
  card.classList.add("copy-card");

  const title = document.createElement("div");
  title.classList.add("copy-card-title");
  title.textContent = copyData.title;

  card.appendChild(title);

  if (copyData.description) {
    const description = document.createElement("div");

    description.classList.add("copy-card-description");
    description.textContent = copyData.description;

    card.appendChild(description);
  }

  const copyValue = document.createElement("div");
  copyValue.classList.add("copy-card-value");
  copyValue.textContent = copyData.copyText;

  card.appendChild(copyValue);

  const button = document.createElement("button");

  button.type = "button";
  button.classList.add("copy-card-button");
  button.textContent = copyData.buttonText;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyData.copyText);

      const textoOriginal = button.textContent;

      button.textContent = "✓ Copiado";

      setTimeout(() => {
        button.textContent = textoOriginal;
      }, 1500);
    } catch (error) {
      console.error("Error copiando texto:", error);
    }
  });

  card.appendChild(button);

  message.appendChild(card);
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
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageViewer.classList.contains("active")) {
    cerrarImagen();
  }
});
function renderTextWithLinks(container, text) {
  const urlRegex =
    /((?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;

  const parts = text.split(urlRegex);

  parts.forEach((part) => {
    if (!part) {
      return;
    }

    urlRegex.lastIndex = 0;
    const esLink = urlRegex.test(part);
    urlRegex.lastIndex = 0;

    if (!esLink) {
      container.appendChild(document.createTextNode(part));
      return;
    }

    // Sacar signos comunes del final del enlace
    const match = part.match(/^(.*?)([.,!?;:]*)$/);

    const urlText = match[1];
    const puntuacion = match[2];

    const link = document.createElement("a");

    let href = urlText;

    if (!/^https?:\/\//i.test(href)) {
      href = "https://" + href;
    }

    link.href = href;
    link.textContent = urlText;

    link.target = "_blank";
    link.rel = "noopener noreferrer";

    container.appendChild(link);

    if (puntuacion) {
      container.appendChild(document.createTextNode(puntuacion));
    }
  });
}
function reproducirSonidoNotificacion() {
  if (!audioHabilitado || !audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.frequency.value = 880;

  gain.gain.setValueAtTime(0.15, audioContext.currentTime);

  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

  oscillator.start();

  oscillator.stop(audioContext.currentTime + 0.3);
}
input.addEventListener(
  "focus",
  () => {
    habilitarAudio();
  },
  { once: true },
);
function mostrarAvisoNotificacionesBloqueadas() {
  if (document.getElementById("push-blocked-notice")) {
    return;
  }

  const aviso = document.createElement("div");

  aviso.id = "push-blocked-notice";
  aviso.className = "push-blocked-notice";

  aviso.innerHTML = `
    <span>
      🔕 Las notificaciones están bloqueadas en tu navegador
    </span>

    <button type="button">
      Entendido
    </button>
  `;

  const boton = aviso.querySelector("button");

  boton.addEventListener("click", () => {
    aviso.remove();
  });

  document.body.appendChild(aviso);
}
