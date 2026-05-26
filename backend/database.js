// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(
  path.join(__dirname, 'horarios.db'),
  (err) => {
    if (err) console.error('Error conectando BD:', err.message);
    else console.log('✅ Conectado a horarios.db');
  }
);

module.exports = db;