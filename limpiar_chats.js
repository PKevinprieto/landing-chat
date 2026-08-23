require("dotenv").config();

const db = require("./database");

async function limpiarChats() {
  try {
    await db.query("DELETE FROM messages;");
    await db.query("DELETE FROM push_subscriptions;");
    await db.query("DELETE FROM conversations;");

    console.log("✅ Conversaciones de prueba eliminadas correctamente");
  } catch (error) {
    console.error("❌ Error limpiando conversaciones:", error);
  } finally {
    await db.end();
  }
}

limpiarChats();
