self.addEventListener("push", (event) => {
  console.log("Push recibido");

  let data = {
    title: "Casino 24hs",
    body: "Tenés un nuevo mensaje",
    url: "/cliente.html",
  };

  if (event.data) {
    try {
      data = {
        ...data,
        ...event.data.json(),
      };
    } catch (error) {
      console.error("Error leyendo push:", error);
    }
  }

  const options = {
    body: data.body,

    icon: "/images/avatar.png",

    badge: "/images/avatar.png",

    vibrate: [200, 100, 200],

    requireInteraction: true,

    data: {
      url: data.url || "/cliente.html",
    },

    tag: "nuevo-mensaje",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Soporte", options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/cliente.html";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
  );
});
