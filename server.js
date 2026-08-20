require("dotenv").config();

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const session = require("express-session");
const webpush = require("web-push");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const db = require("./database");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },

  filename: (req, file, cb) => {
    const nombreUnico = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);

    cb(null, nombreUnico + extension);
  },
});

const upload = multer({
  storage,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
      httpOnly: true,
    },
  }),
);

const PORT = process.env.PORT || 3000;

const clientesConectados = new Map();
const conversaciones = new Map();
const clientesViendoChat = new Map();

function obtenerConversacionesOrdenadas() {
  return Array.from(conversaciones.values())
    .map((conversacion) => ({
      ...conversacion,
      online: clientesConectados.has(conversacion.visitorId),
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

async function obtenerConversacionesConPush() {
  const lista = obtenerConversacionesOrdenadas();

  const resultado = await db.query(`
    SELECT DISTINCT visitor_id
    FROM push_subscriptions
  `);

  const visitantesConPush = new Set(
    resultado.rows.map((fila) => fila.visitor_id),
  );

  return lista.map((conversacion) => ({
    ...conversacion,
    pushEnabled: visitantesConPush.has(conversacion.visitorId),
  }));
}

async function actualizarConversacionesOperador() {
  try {
    const conversacionesConPush = await obtenerConversacionesConPush();

    io.emit("operador:conversaciones", conversacionesConPush);
  } catch (error) {
    console.error(
      "Error actualizando conversaciones del operador:",
      error.message,
    );
  }
}

async function cargarConversacionesDesdeDB() {
  try {
    const resultadoConversaciones = await db.query(`
      SELECT
        visitor_id,
        updated_at,
        last_seen,
        name
      FROM conversations
      ORDER BY updated_at DESC
    `);

    conversaciones.clear();

    if (resultadoConversaciones.rows.length === 0) {
      console.log("No hay conversaciones guardadas");
      return;
    }

    for (const fila of resultadoConversaciones.rows) {
      const resultadoMensajes = await db.query(
        `
        SELECT
          sender,
          text,
          created_at,
          kind,
          image_url,
          message_uid,
          reply_to_uid,
          link_title,
          link_description,
          link_button_text,
          link_url,
          copy_title,
          copy_description,
          copy_button_text,
          copy_text
        FROM messages
        WHERE visitor_id = $1
        ORDER BY created_at ASC, id ASC
        `,
        [fila.visitor_id],
      );

      const mensajes = resultadoMensajes.rows.map((mensaje) => ({
        id: mensaje.message_uid,
        type: mensaje.sender,
        text: mensaje.text,
        kind: mensaje.kind || "text",
        imageUrl: mensaje.image_url,
        replyToUid: mensaje.reply_to_uid,
        linkTitle: mensaje.link_title,
        linkDescription: mensaje.link_description,
        linkButtonText: mensaje.link_button_text,
        linkUrl: mensaje.link_url,
        copyTitle: mensaje.copy_title,
        copyDescription: mensaje.copy_description,
        copyButtonText: mensaje.copy_button_text,
        copyText: mensaje.copy_text,
        createdAt: Number(mensaje.created_at),
      }));

      conversaciones.set(fila.visitor_id, {
        visitorId: fila.visitor_id,
        mensajes,
        updatedAt: Number(fila.updated_at),
        lastSeen: fila.last_seen == null ? null : Number(fila.last_seen),
        name: fila.name,
      });
    }

    console.log(
      `Conversaciones cargadas desde PostgreSQL: ${conversaciones.size}`,
    );
  } catch (error) {
    console.error("Error cargando conversaciones:", error.message);
    throw error;
  }
}

function protegerOperador(req, res, next) {
  if (req.session?.operadorAutenticado) {
    return next();
  }

  return res.redirect("/login");
}

app.get("/operador", protegerOperador, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "operador.html"));
});

app.get("/operador.html", protegerOperador, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "operador.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const password = req.body.password;

  if (password === process.env.OPERADOR_PASSWORD) {
    req.session.operadorAutenticado = true;
    return res.redirect("/operador");
  }

  return res.redirect("/login?error=1");
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cliente.html"));
});
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/api/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      ok: false,
      message: "No se recibió ninguna imagen",
    });
  }

  const imageUrl = `/uploads/${req.file.filename}`;

  res.json({
    ok: true,
    imageUrl,
  });
});

async function obtenerAtajos() {
  try {
    const resultado = await db.query(`
      SELECT
        id,
        name,
        shortcut_key,
        kind,
        text,
        link_title,
        link_description,
        link_button_text,
        link_url,
        copy_title,
        copy_description,
        copy_button_text,
        copy_text,
        created_at,
        updated_at
      FROM shortcuts
      ORDER BY shortcut_key ASC
    `);

    return resultado.rows.map((fila) => ({
      id: Number(fila.id),
      name: fila.name,
      key: fila.shortcut_key,
      kind: fila.kind,
      text: fila.text,
      linkTitle: fila.link_title,
      linkDescription: fila.link_description,
      linkButtonText: fila.link_button_text,
      linkUrl: fila.link_url,
      copyTitle: fila.copy_title,
      copyDescription: fila.copy_description,
      copyButtonText: fila.copy_button_text,
      copyText: fila.copy_text,
      createdAt: Number(fila.created_at),
      updatedAt: Number(fila.updated_at),
    }));
  } catch (error) {
    console.error("Error cargando atajos:", error.message);
    return [];
  }
}
app.get("/api/push/public-key", (req, res) => {
  res.json({
    publicKey: process.env.VAPID_PUBLIC_KEY,
  });
});
app.post("/api/push/subscribe", async (req, res) => {
  try {
    const { visitorId, subscription } = req.body;

    if (
      !visitorId ||
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res.status(400).json({
        ok: false,
        message: "Suscripción inválida",
      });
    }

    const ahora = Date.now();

    await db.query(
      `
      INSERT INTO push_subscriptions (
        visitor_id,
        endpoint,
        p256dh,
        auth,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)

      ON CONFLICT (endpoint)
      DO UPDATE SET
        visitor_id = EXCLUDED.visitor_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        updated_at = EXCLUDED.updated_at
      `,
      [
        visitorId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        ahora,
        ahora,
      ],
    );

    console.log("🔔 Push guardado:", visitorId);

    return res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Error guardando Push:", error);

    return res.status(500).json({
      ok: false,
      message: "No se pudo guardar la suscripción",
    });
  }
});

async function enviarPushAVisitante(visitorId, texto) {
  const resultado = await db.query(
    `
    SELECT
      id,
      endpoint,
      p256dh,
      auth
    FROM push_subscriptions
    WHERE visitor_id = $1
    `,
    [visitorId],
  );

  if (resultado.rows.length === 0) {
    return;
  }

  const payload = JSON.stringify({
    title: "Casino 24hs",
    body: texto,
    url: "/cliente.html",
  });

  for (const fila of resultado.rows) {
    const subscription = {
      endpoint: fila.endpoint,
      keys: {
        p256dh: fila.p256dh,
        auth: fila.auth,
      },
    };

    try {
      await webpush.sendNotification(subscription, payload);

      console.log("🔔 Push enviado a:", visitorId);
    } catch (error) {
      console.error("Error enviando push:", error.statusCode || error.message);

      // La suscripción ya no existe o dejó de ser válida
      if (error.statusCode === 404 || error.statusCode === 410) {
        await db.query(
          `
          DELETE FROM push_subscriptions
          WHERE id = $1
          `,
          [fila.id],
        );

        console.log("🗑️ Suscripción Push inválida eliminada");
      }
    }
  }
}

io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  obtenerConversacionesConPush()
    .then((conversacionesConPush) => {
      socket.emit("operador:conversaciones", conversacionesConPush);
    })
    .catch((error) => {
      console.error(
        "Error enviando conversaciones al conectar:",
        error.message,
      );
    });

  socket.on("operador:solicitar-atajos", async () => {
    const atajos = await obtenerAtajos();
    socket.emit("operador:atajos", atajos);
  });

  socket.on("cliente:registrar", async (data) => {
    try {
      const visitorId = data.visitorId;
      const ahora = Date.now();
      const esVisitanteNuevo = !conversaciones.has(visitorId);

      clientesConectados.set(visitorId, socket.id);

      const conversacionActual = conversaciones.get(visitorId);

      if (conversacionActual) {
        conversacionActual.lastSeen = ahora;
      }

      await db.query(
        `
        INSERT INTO conversations (
          visitor_id,
          created_at,
          updated_at,
          last_seen
        )
        VALUES ($1, $2, $3, $4)

        ON CONFLICT(visitor_id)
        DO UPDATE SET
          updated_at = EXCLUDED.updated_at,
          last_seen = EXCLUDED.last_seen
        `,
        [visitorId, ahora, ahora, ahora],
      );

      if (!conversaciones.has(visitorId)) {
        conversaciones.set(visitorId, {
          visitorId,
          mensajes: [],
          updatedAt: ahora,
          lastSeen: ahora,
          name: null,
        });
      }
      if (esVisitanteNuevo) {
        const messageUid = crypto.randomUUID();

        const textoBienvenida =
          "Holaa, como estas?👋✨ Decime un nombre o apodo asi te creo tu usuario😀";

        const mensajeBienvenida = {
          id: messageUid,
          type: "operador",
          kind: "text",
          text: textoBienvenida,
          replyToUid: null,
          createdAt: ahora,
        };

        const conversacion = conversaciones.get(visitorId);

        conversacion.mensajes.push(mensajeBienvenida);
        conversacion.updatedAt = ahora;

        try {
          await db.query(
            `
      INSERT INTO messages (
        visitor_id,
        sender,
        text,
        created_at,
        kind,
        message_uid,
        reply_to_uid
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
            [
              visitorId,
              "operador",
              textoBienvenida,
              ahora,
              "text",
              messageUid,
              null,
            ],
          );

          await db.query(
            `
      UPDATE conversations
      SET updated_at = $1
      WHERE visitor_id = $2
      `,
            [ahora, visitorId],
          );

          socket.emit("cliente:mensaje-operador", {
            id: messageUid,
            type: "operador",
            kind: "text",
            text: textoBienvenida,
            replyToUid: null,
            createdAt: ahora,
            auto: true,
          });

          await actualizarConversacionesOperador();
        } catch (error) {
          console.error(
            "Error guardando mensaje de bienvenida:",
            error.message,
          );
        }
      }

      const resultadoMensajes = await db.query(
        `
        SELECT
          sender,
          text,
          created_at,
          kind,
          image_url,
          message_uid,
          reply_to_uid,
          link_title,
          link_description,
          link_button_text,
          link_url,
          copy_title,
          copy_description,
          copy_button_text,
          copy_text
        FROM messages
        WHERE visitor_id = $1
        ORDER BY created_at ASC, id ASC
        `,
        [visitorId],
      );

      const historial = resultadoMensajes.rows.map((mensaje) => ({
        id: mensaje.message_uid,
        sender: mensaje.sender,
        text: mensaje.text,
        kind: mensaje.kind || "text",
        imageUrl: mensaje.image_url,
        replyToUid: mensaje.reply_to_uid,
        linkTitle: mensaje.link_title,
        linkDescription: mensaje.link_description,
        linkButtonText: mensaje.link_button_text,
        linkUrl: mensaje.link_url,
        copyTitle: mensaje.copy_title,
        copyDescription: mensaje.copy_description,
        copyButtonText: mensaje.copy_button_text,
        copyText: mensaje.copy_text,
        createdAt: Number(mensaje.created_at),
      }));

      socket.emit("cliente:historial", historial);
      io.emit("operador:conversaciones", obtenerConversacionesOrdenadas());

      console.log("Cliente registrado");
      console.log("Visitor ID:", visitorId);
      io.emit("operador:cliente-entro", {
        visitorId,
        timestamp: Date.now(),
      });
      console.log("Socket ID:", socket.id);
      console.log("Clientes conectados:", clientesConectados.size);
    } catch (error) {
      console.error("Error registrando cliente:", error.message);
    }
  });
  socket.on("cliente:visibilidad", (data) => {
    clientesViendoChat.set(data.visitorId, data.visible === true);

    console.log("Visibilidad cliente:", data.visitorId, data.visible);
  });
  socket.on("cliente:mensaje", async (data) => {
    try {
      console.log("Mensaje recibido del cliente");
      console.log("Visitor ID:", data.visitorId);
      console.log("Mensaje:", data.text);

      if (!conversaciones.has(data.visitorId)) {
        const ahoraConversacion = Date.now();

        conversaciones.set(data.visitorId, {
          visitorId: data.visitorId,
          mensajes: [],
          updatedAt: ahoraConversacion,
          lastSeen: ahoraConversacion,
          name: null,
        });

        await db.query(
          `
          INSERT INTO conversations (
            visitor_id,
            created_at,
            updated_at,
            last_seen
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT(visitor_id) DO NOTHING
          `,
          [
            data.visitorId,
            ahoraConversacion,
            ahoraConversacion,
            ahoraConversacion,
          ],
        );
      }

      const conversacion = conversaciones.get(data.visitorId);
      const messageUid = crypto.randomUUID();
      const ahora = Date.now();

      conversacion.mensajes.push({
        id: messageUid,
        type: "cliente",
        kind: "text",
        text: data.text,
        replyToUid: data.replyToUid || null,
        createdAt: ahora,
      });

      conversacion.updatedAt = ahora;

      await db.query(
        `
        INSERT INTO messages (
          visitor_id,
          sender,
          text,
          created_at,
          kind,
          message_uid,
          reply_to_uid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          data.visitorId,
          "cliente",
          data.text,
          ahora,
          "text",
          messageUid,
          data.replyToUid || null,
        ],
      );

      await db.query(
        `
        UPDATE conversations
        SET updated_at = $1
        WHERE visitor_id = $2
        `,
        [ahora, data.visitorId],
      );

      io.emit("operador:mensaje-cliente", {
        id: messageUid,
        visitorId: data.visitorId,
        type: "cliente",
        kind: "text",
        text: data.text,
        replyToUid: data.replyToUid || null,
        createdAt: ahora,
      });

      socket.emit("cliente:mensaje-confirmado", {
        id: messageUid,
        sender: "cliente",
        kind: "text",
        text: data.text,
        replyToUid: data.replyToUid || null,
        createdAt: ahora,
      });

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando mensaje del cliente:", error.message);
    }
  });

  socket.on("cliente:imagen", async (data) => {
    try {
      console.log("Imagen recibida del cliente");
      console.log("Visitor ID:", data.visitorId);
      console.log("Imagen:", data.imageUrl);

      const conversacion = conversaciones.get(data.visitorId);

      if (!conversacion) {
        return;
      }

      const ahora = Date.now();

      conversacion.mensajes.push({
        type: "cliente",
        kind: "image",
        imageUrl: data.imageUrl,
        createdAt: ahora,
      });

      conversacion.updatedAt = ahora;

      await db.query(
        `
        INSERT INTO messages (
          visitor_id,
          sender,
          text,
          created_at,
          kind,
          image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [data.visitorId, "cliente", "[imagen]", ahora, "image", data.imageUrl],
      );

      await db.query(
        `
        UPDATE conversations
        SET updated_at = $1
        WHERE visitor_id = $2
        `,
        [ahora, data.visitorId],
      );

      io.emit("operador:imagen-cliente", {
        visitorId: data.visitorId,
        imageUrl: data.imageUrl,
      });

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando imagen del cliente:", error.message);
    }
  });

  socket.on("operador:link", async (data) => {
    try {
      const conversacion = conversaciones.get(data.visitorId);

      if (!conversacion) {
        return;
      }

      const ahora = Date.now();
      const messageUid = crypto.randomUUID();

      const mensajeLink = {
        id: messageUid,
        type: "operador",
        kind: "link",
        text: "[enlace]",
        linkTitle: data.title,
        linkDescription: data.description || "",
        linkButtonText: data.buttonText,
        linkUrl: data.url,
        createdAt: ahora,
      };

      conversacion.mensajes.push(mensajeLink);
      conversacion.updatedAt = ahora;

      await db.query(
        `
        INSERT INTO messages (
          visitor_id,
          sender,
          text,
          created_at,
          kind,
          message_uid,
          link_title,
          link_description,
          link_button_text,
          link_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          data.visitorId,
          "operador",
          "[enlace]",
          ahora,
          "link",
          messageUid,
          data.title,
          data.description || "",
          data.buttonText,
          data.url,
        ],
      );

      await db.query(
        `
        UPDATE conversations
        SET updated_at = $1
        WHERE visitor_id = $2
        `,
        [ahora, data.visitorId],
      );

      const socketIdCliente = clientesConectados.get(data.visitorId);

      if (socketIdCliente) {
        io.to(socketIdCliente).emit("cliente:link-operador", {
          id: messageUid,
          kind: "link",
          title: data.title,
          description: data.description || "",
          buttonText: data.buttonText,
          url: data.url,
          createdAt: ahora,
        });
      }

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando enlace:", error.message);
    }
  });

  socket.on("operador:copy", async (data) => {
    try {
      const conversacion = conversaciones.get(data.visitorId);

      if (!conversacion) {
        return;
      }

      const ahora = Date.now();
      const messageUid = crypto.randomUUID();

      const mensajeCopy = {
        id: messageUid,
        type: "operador",
        kind: "copy",
        text: "[copiar]",
        copyTitle: data.title,
        copyDescription: data.description || "",
        copyButtonText: data.buttonText,
        copyText: data.copyText,
        createdAt: ahora,
      };

      conversacion.mensajes.push(mensajeCopy);
      conversacion.updatedAt = ahora;
      console.log("COPY RECIBIDO EN SERVER:", data);
      await db.query(
        `
      INSERT INTO messages (
        visitor_id,
        sender,
        text,
        created_at,
        kind,
        message_uid,
        copy_title,
        copy_description,
        copy_button_text,
        copy_text
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      `,
        [
          data.visitorId,
          "operador",
          "[copiar]",
          ahora,
          "copy",
          messageUid,
          data.title,
          data.description || "",
          data.buttonText,
          data.copyText,
        ],
      );

      await db.query(
        `
      UPDATE conversations
      SET updated_at = $1
      WHERE visitor_id = $2
      `,
        [ahora, data.visitorId],
      );

      const socketIdCliente = clientesConectados.get(data.visitorId);

      if (socketIdCliente) {
        io.to(socketIdCliente).emit("cliente:copy-operador", {
          id: messageUid,
          kind: "copy",
          title: data.title,
          description: data.description || "",
          buttonText: data.buttonText,
          copyText: data.copyText,
          createdAt: ahora,
        });
      }

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando tarjeta copy:", error.message);
    }
  });

  socket.on("operador:imagen", async (data) => {
    try {
      console.log("Imagen recibida del operador");
      console.log("Visitor ID:", data.visitorId);
      console.log("Imagen:", data.imageUrl);

      const conversacion = conversaciones.get(data.visitorId);

      if (!conversacion) {
        return;
      }

      const ahora = Date.now();

      conversacion.mensajes.push({
        type: "operador",
        kind: "image",
        imageUrl: data.imageUrl,
        createdAt: ahora,
      });

      conversacion.updatedAt = ahora;

      await db.query(
        `
        INSERT INTO messages (
          visitor_id,
          sender,
          text,
          created_at,
          kind,
          image_url
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [data.visitorId, "operador", "[imagen]", ahora, "image", data.imageUrl],
      );

      await db.query(
        `
        UPDATE conversations
        SET updated_at = $1
        WHERE visitor_id = $2
        `,
        [ahora, data.visitorId],
      );

      const socketIdCliente = clientesConectados.get(data.visitorId);

      if (socketIdCliente) {
        io.to(socketIdCliente).emit("cliente:imagen-operador", {
          imageUrl: data.imageUrl,
        });
      }

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando imagen del operador:", error.message);
    }
  });

  socket.on("operador:mensaje", async (data) => {
    try {
      console.log("Mensaje recibido del operador");
      console.log("Visitor ID:", data.visitorId);
      console.log("Mensaje:", data.text);

      const conversacion = conversaciones.get(data.visitorId);

      if (!conversacion) {
        console.log("No se encontró la conversación");
        return;
      }

      const ahora = Date.now();
      const messageUid = crypto.randomUUID();

      conversacion.mensajes.push({
        id: messageUid,
        type: "operador",
        kind: "text",
        text: data.text,
        replyToUid: data.replyToUid || null,
        createdAt: ahora,
      });

      conversacion.updatedAt = ahora;

      console.log("UID nuevo:", messageUid);
      console.log("Responde a UID:", data.replyToUid);

      await db.query(
        `
        INSERT INTO messages (
          visitor_id,
          sender,
          text,
          created_at,
          kind,
          message_uid,
          reply_to_uid
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          data.visitorId,
          "operador",
          data.text,
          ahora,
          "text",
          messageUid,
          data.replyToUid || null,
        ],
      );

      console.log("Mensaje guardado en PostgreSQL");

      const comprobacion = await db.query(
        `
        SELECT
          message_uid,
          reply_to_uid,
          text
        FROM messages
        WHERE message_uid = $1
        `,
        [messageUid],
      );

      console.log("GUARDADO EN POSTGRESQL:", comprobacion.rows[0]);

      await db.query(
        `
        UPDATE conversations
        SET updated_at = $1
        WHERE visitor_id = $2
        `,
        [ahora, data.visitorId],
      );
      const clienteEstaViendoChat =
        clientesViendoChat.get(data.visitorId) === true;

      if (!clienteEstaViendoChat) {
        await enviarPushAVisitante(data.visitorId, data.text);
      }
      const socketIdCliente = clientesConectados.get(data.visitorId);

      if (socketIdCliente) {
        io.to(socketIdCliente).emit("cliente:mensaje-operador", {
          id: messageUid,
          type: "operador",
          kind: "text",
          text: data.text,
          replyToUid: data.replyToUid || null,
          createdAt: ahora,
        });
      }

      socket.emit("operador:mensaje-confirmado", {
        id: messageUid,
        visitorId: data.visitorId,
        type: "operador",
        kind: "text",
        text: data.text,
        replyToUid: data.replyToUid || null,
        createdAt: ahora,
      });

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando mensaje del operador:", error.message);
    }
  });

  socket.on("operador:editar-contacto", async (data) => {
    try {
      const { visitorId, name } = data;

      const conversacion = conversaciones.get(visitorId);

      if (!conversacion) {
        return;
      }

      conversacion.name = name;

      await db.query(
        `
        UPDATE conversations
        SET name = $1
        WHERE visitor_id = $2
        `,
        [name, visitorId],
      );

      await actualizarConversacionesOperador();
    } catch (error) {
      console.error("Error guardando nombre del contacto:", error.message);
    }
  });

  socket.on("operador:crear-atajo", async (data) => {
    const ahora = Date.now();

    const name = String(data.name || "").trim();
    const shortcutKey = String(data.key || "")
      .trim()
      .toUpperCase();
    const kind = data.kind;

    if (!name || !shortcutKey || !kind) {
      return;
    }

    if (kind !== "text" && kind !== "link" && kind !== "copy") {
      return;
    }

    try {
      await db.query(
        `
  INSERT INTO shortcuts (
    name,
    shortcut_key,
    kind,

    text,

    link_title,
    link_description,
    link_button_text,
    link_url,

    copy_title,
    copy_description,
    copy_button_text,
    copy_text,

    created_at,
    updated_at
  )
  VALUES (
    $1, $2, $3, $4,
    $5, $6, $7, $8,
    $9, $10, $11, $12,
    $13, $14
  )
  `,
        [
          name,
          shortcutKey,
          kind,

          kind === "text" ? String(data.text || "").trim() : null,

          kind === "link" ? String(data.linkTitle || "").trim() : null,

          kind === "link" ? String(data.linkDescription || "").trim() : null,

          kind === "link" ? String(data.linkButtonText || "").trim() : null,

          kind === "link" ? String(data.linkUrl || "").trim() : null,

          kind === "copy" ? String(data.copyTitle || "").trim() : null,

          kind === "copy" ? String(data.copyDescription || "").trim() : null,

          kind === "copy" ? String(data.copyButtonText || "").trim() : null,

          kind === "copy" ? String(data.copyText || "").trim() : null,

          ahora,
          ahora,
        ],
      );

      const atajos = await obtenerAtajos();
      io.emit("operador:atajos", atajos);
    } catch (error) {
      if (error.code === "23505") {
        socket.emit("operador:error-atajo", {
          message: `Ya existe un atajo para ${shortcutKey}`,
        });
        return;
      }

      console.error("Error creando atajo:", error.message);
    }
  });

  socket.on("operador:eliminar-atajo", async (data) => {
    try {
      await db.query(
        `
        DELETE FROM shortcuts
        WHERE id = $1
        `,
        [data.id],
      );

      const atajos = await obtenerAtajos();
      io.emit("operador:atajos", atajos);
    } catch (error) {
      console.error("Error eliminando atajo:", error.message);
    }
  });

  socket.on("operador:editar-atajo", async (data) => {
    const ahora = Date.now();

    const name = String(data.name || "").trim();
    const shortcutKey = String(data.key || "")
      .trim()
      .toUpperCase();
    const kind = data.kind;

    if (!data.id || !name || !shortcutKey || !kind) {
      return;
    }

    try {
      await db.query(
        `
  UPDATE shortcuts
  SET
    name = $1,
    shortcut_key = $2,
    kind = $3,

    text = $4,

    link_title = $5,
    link_description = $6,
    link_button_text = $7,
    link_url = $8,

    copy_title = $9,
    copy_description = $10,
    copy_button_text = $11,
    copy_text = $12,

    updated_at = $13
  WHERE id = $14
  `,
        [
          name,
          shortcutKey,
          kind,

          kind === "text" ? String(data.text || "").trim() : null,

          kind === "link" ? String(data.linkTitle || "").trim() : null,

          kind === "link" ? String(data.linkDescription || "").trim() : null,

          kind === "link" ? String(data.linkButtonText || "").trim() : null,

          kind === "link" ? String(data.linkUrl || "").trim() : null,

          kind === "copy" ? String(data.copyTitle || "").trim() : null,

          kind === "copy" ? String(data.copyDescription || "").trim() : null,

          kind === "copy" ? String(data.copyButtonText || "").trim() : null,

          kind === "copy" ? String(data.copyText || "").trim() : null,

          ahora,
          data.id,
        ],
      );

      const atajos = await obtenerAtajos();
      io.emit("operador:atajos", atajos);
    } catch (error) {
      if (error.code === "23505") {
        socket.emit("operador:error-atajo", {
          message: `Ya existe un atajo para ${shortcutKey}`,
        });
        return;
      }

      console.error("Error editando atajo:", error.message);
    }
  });

  socket.on("disconnect", async () => {
    console.log("Usuario desconectado:", socket.id);

    for (const [visitorId, socketId] of clientesConectados.entries()) {
      if (socketId !== socket.id) {
        continue;
      }

      clientesConectados.delete(visitorId);

      const ahora = Date.now();
      const conversacion = conversaciones.get(visitorId);

      if (conversacion) {
        conversacion.lastSeen = ahora;
      }

      try {
        await db.query(
          `
          UPDATE conversations
          SET last_seen = $1
          WHERE visitor_id = $2
          `,
          [ahora, visitorId],
        );
      } catch (error) {
        console.error("Error actualizando última conexión:", error.message);
      }

      console.log("Cliente desconectado:", visitorId);

      await actualizarConversacionesOperador();

      break;
    }

    console.log("Clientes conectados:", clientesConectados.size);
  });
});

async function iniciarServidor() {
  try {
    await db.query("SELECT 1");
    console.log("Base de datos PostgreSQL conectada");

    await cargarConversacionesDesdeDB();

    server.listen(PORT, () => {
      console.log(`Servidor funcionando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error.message);
    process.exit(1);
  }
}

iniciarServidor();
