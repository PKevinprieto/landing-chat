require("dotenv").config();

const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },
});

db.on("error", (error) => {
  console.error("Error inesperado en PostgreSQL:", error);
});

module.exports = db;
