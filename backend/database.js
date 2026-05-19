const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('./horarios.db', (err) => {

  if (err) {
    console.log('Error conectando SQLite')
  } else {
    console.log('SQLite conectado correctamente')
  }

})

module.exports = db