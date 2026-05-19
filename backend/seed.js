const db = require('./database');

// Convertimos db.run en promesa
function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function seed() {
  try {
    // =========================
    // LIMPIAR TABLAS
    // =========================
    await run('DELETE FROM docentes');
    await run('DELETE FROM materias');
    await run('DELETE FROM aulas');
    await run('DELETE FROM grupos');

    // =========================
    // INSERTAR DOCENTES
    // =========================
    await run(`
      INSERT INTO docentes(nombre, disponibilidad, carga_max)
      VALUES
      ('Carlos Pérez', 'Lunes-Miércoles', 20),
      ('Ana Gómez', 'Martes-Jueves', 18)
    `);

    // =========================
    // INSERTAR MATERIAS
    // =========================
    await run(`
      INSERT INTO materias(nombre, creditos, prerequisitos)
      VALUES
      ('Programación', 4, 'Ninguno'),
      ('Bases de Datos', 3, 'Programación')
    `);

    // =========================
    // INSERTAR AULAS
    // =========================
    await run(`
      INSERT INTO aulas(nombre, capacidad, tipo)
      VALUES
      ('Sala 101', 30, 'Teórica'),
      ('Laboratorio 202', 25, 'Laboratorio')
    `);

    // =========================
    // INSERTAR GRUPOS
    // =========================
    await run(`
      INSERT INTO grupos(nombre, programa)
      VALUES
      ('Grupo A', 'Ingeniería Sistemas'),
      ('Grupo B', 'Ingeniería Industrial')
    `);

    console.log('✅ Datos insertados correctamente');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al insertar datos:', error);
    process.exit(1);
  }
}

seed();