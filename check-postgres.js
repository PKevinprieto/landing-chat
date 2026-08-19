require("dotenv").config();

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

async function comprobarConexion() {
  try {
    await client.connect();

    console.log("✅ Conectado a PostgreSQL");

    const resultado = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS usuario,
        version() AS version
    `);

    console.log("");
    console.log("=== BASE CONECTADA ===");
    console.log("Base:", resultado.rows[0].database);
    console.log("Usuario:", resultado.rows[0].usuario);
    console.log("");

    const tablas = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("=== TABLAS ACTUALES ===");

    if (tablas.rows.length === 0) {
      console.log("No hay tablas.");
    } else {
      tablas.rows.forEach((fila) => {
        console.log("-", fila.table_name);
      });
    }
  } catch (error) {
    console.error("❌ Error conectando a PostgreSQL:");
    console.error(error.message);
  } finally {
    await client.end();
  }
}

comprobarConexion();
