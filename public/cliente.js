console.log("cliente.js cargado");

const socket = io();

const form = document.getElementById("message-form");
const input = document.getElementById("message-input");
const messages = document.getElementById("messages");
const pushPermissionBox = document.getElementById("push-permission-box");

const enablePushButton = document.getElementById("enable-push-button");
async function revisarEstadoNotificaciones() {
  if (!("Notification" in window)) {
    pushPermissionBox.style.display = "none";
    return;
  }

  if (!("serviceWorker" in navigator)) {
    pushPermissionBox.style.display = "none";
    return;
  }

  if (Notification.permission !== "granted") {
    pushPermissionBox.style.display = "flex";
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Ya tiene permiso + suscripción activa
      pushPermissionBox.style.display = "none";

      console.log("🔔 Notificaciones ya estaban activadas");

      return;
    }

    // Tiene permiso, pero perdió la suscripción.
    // Mostramos el cartel para poder crearla otra vez.
    pushPermissionBox.style.display = "flex";
  } catch (error) {
    console.error("Error comprobando notificaciones:", error);

    pushPermissionBox.style.display = "flex";
  }
}
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
enablePushButton.addEventListener("click", async () => {
  console.log("🔔 SE TOCÓ EL BOTÓN ACTIVAR");
  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("El usuario no permitió notificaciones");

      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const response = await fetch("/api/push/public-key");

    const data = await response.json();

    const publicKey = data.publicKey;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,

        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    console.log("✅ PushSubscription creada:", subscription);
    const subscriptionData = subscription.toJSON();

    const saveResponse = await fetch("/api/push/subscribe", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        visitorId: visitorId,
        subscription: subscriptionData,
      }),
    });

    const saveResult = await saveResponse.json();

    if (!saveResponse.ok) {
      throw new Error(
        saveResult.message || "No se pudo guardar la suscripción",
      );
    }

    console.log("✅ Suscripción guardada en servidor");
    pushPermissionBox.style.display = "none";
  } catch (error) {
    console.error("❌ Error activando notificaciones:", error);
  }
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
  if (data.auto) {
    reproducirSonidoNotificacion();
  }
});
socket.on("cliente:imagen-operador", (data) => {
  console.log("Imagen recibida del operador:", data);

  addImage(data.imageUrl, "received");
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
