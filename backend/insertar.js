const db = require('./database')

db.run(`
INSERT INTO docentes(nombre, disponibilidad, carga_max)
VALUES ('Carlos Pérez', 'Lunes', 20)
`)

console.log('Docente insertado')