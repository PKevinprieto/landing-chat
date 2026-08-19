require("dotenv").config();

const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function resetearBase() {
  try {
    await client.connect();

    console.log("✅ Conectado a PostgreSQL");

    const resultado = await client.query(`
      SELECT
        current_database() AS database,
        current_user AS usuario
    `);

    console.log("Base:", resultado.rows[0].database);
    console.log("Usuario:", resultado.rows[0].usuario);

    console.log("");
    console.log("⚠️ Borrando esquema public...");

    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
    `);

    console.log("✅ Base vaciada");

    console.log("Creando tablas nuevas...");

    await client.query(`
      CREATE TABLE conversations (
        visitor_id TEXT PRIMARY KEY,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        last_seen BIGINT,
        name TEXT
      );
    `);

    await client.query(`
      CREATE TABLE messages (
        id BIGSERIAL PRIMARY KEY,

        visitor_id TEXT NOT NULL,

        sender TEXT NOT NULL,
        text TEXT NOT NULL,

        created_at BIGINT NOT NULL,

        kind TEXT,
        image_url TEXT,

        message_uid TEXT,
        reply_to_uid TEXT,

        link_title TEXT,
        link_description TEXT,
        link_button_text TEXT,
        link_url TEXT,

        CONSTRAINT fk_messages_conversation
          FOREIGN KEY (visitor_id)
          REFERENCES conversations(visitor_id)
          ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX idx_messages_message_uid
      ON messages(message_uid)
      WHERE message_uid IS NOT NULL;
    `);

    await client.query(`
      CREATE INDEX idx_messages_visitor_id
      ON messages(visitor_id);
    `);

    await client.query(`
      CREATE INDEX idx_messages_created_at
      ON messages(created_at);
    `);

    await client.query(`
      CREATE TABLE shortcuts (
        id BIGSERIAL PRIMARY KEY,

        name TEXT NOT NULL,

        shortcut_key TEXT NOT NULL UNIQUE,

        kind TEXT NOT NULL,

        text TEXT,

        link_title TEXT,
        link_description TEXT,
        link_button_text TEXT,
        link_url TEXT,

        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);

    console.log("✅ Tablas creadas");

    const tablas = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("");
    console.log("=== TABLAS NUEVAS ===");

    tablas.rows.forEach((fila) => {
      console.log("-", fila.table_name);
    });
  } catch (error) {
    console.error("❌ Error reseteando PostgreSQL:");
    console.error(error);
  } finally {
    await client.end();
  }
}

resetearBase();
