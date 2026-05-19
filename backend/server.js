require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database');
const { Parser } = require('json2csv');

const app = express();
const agenteRouter = require('./routes/agente');

app.use(cors());
app.use(express.json());
app.use("/api/agente", agenteRouter);


// =========================
// CREAR TABLAS
// =========================

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS docentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      disponibilidad TEXT,
      carga_max INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS materias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      creditos INTEGER,
      prerequisitos TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS aulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      capacidad INTEGER,
      tipo TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT,
      programa TEXT
    )
  `);
});

// =========================
// RUTA PRINCIPAL
// =========================

app.get('/', (req, res) => {
  res.send('Servidor funcionando correctamente 🚀');
});

// =========================
// UTILIDAD PROMISIFICADA
// =========================

function all(query) {
  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// =========================
// API DOCENTES
// =========================

app.get('/docentes', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM docentes');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// =========================
// API MATERIAS
// =========================

app.get('/materias', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM materias');
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =========================
// API AULAS
// =========================

app.get('/aulas', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM aulas');
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =========================
// API GRUPOS
// =========================

app.get('/grupos', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM grupos');
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =========================
// FUNCION GENERAR HORARIO
// =========================

function generarHorario(docentes, materias, aulas, grupos) {

  let horario = [];

  const dias = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes'
  ];

  const horas = [
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '18:00',
    '19:00'
  ];

  const ocupados = new Set();

  materias.forEach((materia, index) => {

    let asignado = false;
    let intentos = 0;

    while (!asignado && intentos < 100) {

      const docente =
        docentes[Math.floor(Math.random() * docentes.length)];

      const aula =
        aulas[Math.floor(Math.random() * aulas.length)];

      const grupo =
        grupos[Math.floor(Math.random() * grupos.length)];

      const dia =
        dias[Math.floor(Math.random() * dias.length)];

      const hora =
        horas[Math.floor(Math.random() * horas.length)];

      const claveDocente =
        `DOC-${docente.nombre}-${dia}-${hora}`;

      const claveAula =
        `AULA-${aula.nombre}-${dia}-${hora}`;

      const claveGrupo =
        `GRUPO-${grupo.nombre}-${grupo.programa}-${dia}-${hora}`;

      const existeConflicto =
        ocupados.has(claveDocente) ||
        ocupados.has(claveAula) ||
        ocupados.has(claveGrupo);

      if (!existeConflicto) {

        ocupados.add(claveDocente);
        ocupados.add(claveAula);
        ocupados.add(claveGrupo);

        horario.push({
          materia: materia.nombre,
          docente: docente.nombre,
          aula: aula.nombre,
          grupo: grupo.nombre,
          programa: grupo.programa,
          dia,
          hora
        });

        asignado = true;
      }

      intentos++;
    }
  });

  return horario;
}

// =========================
// DETECTAR CONFLICTOS
// =========================

function detectarConflictos(horario) {
  let conflictos = [];

  for (let i = 0; i < horario.length; i++) {
    for (let j = i + 1; j < horario.length; j++) {
      let a = horario[i];
      let b = horario[j];

      if (a.docente === b.docente && a.hora === b.hora) {
        conflictos.push({
          tipo: 'Conflicto Docente',
          detalle: `${a.docente} tiene dos clases a las ${a.hora}`
        });
      }

      if (a.aula === b.aula && a.hora === b.hora) {
        conflictos.push({
          tipo: 'Conflicto Aula',
          detalle: `${a.aula} está ocupada a las ${a.hora}`
        });
      }
    }
  }

  return conflictos;
}

// =========================
// API GENERAR HORARIO
// =========================

app.get('/generar-horario', async (req, res) => {
  try {
    const docentes = await all('SELECT * FROM docentes');
    const materias = await all('SELECT * FROM materias');
    const aulas = await all('SELECT * FROM aulas');

    const horario = generarHorario(docentes, materias, aulas, grupos);

    res.json(horario);
  } catch (err) {
    res.status(500).json(err);
  }
});

// =========================
// API CONFLICTOS
// =========================

app.get('/conflictos', async (req, res) => {

  try {

    const docentes =
      await all('SELECT * FROM docentes');

    const materias =
      await all('SELECT * FROM materias');

    const aulas =
      await all('SELECT * FROM aulas');

    const grupos =
      await all('SELECT * FROM grupos');

    const horario = generarHorario(
      docentes,
      materias,
      aulas,
      grupos
    );

    const conflictos =
      detectarConflictos(horario);

    res.json({
      horario,
      conflictos
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

// =========================
// EXPORTAR CSV
// =========================

app.get('/exportar-horario', async (req, res) => {
  try {
    const docentes = await all('SELECT * FROM docentes');
    const materias = await all('SELECT * FROM materias');
    const aulas = await all('SELECT * FROM aulas');
    const grupos = await all('SELECT * FROM grupos');

    const horario = generarHorario(docentes, materias, aulas, grupos

    );

    const data = horario.map(item => ({
      MATERIA: item.materia,
      DOCENTE: item.docente,
      AULA: item.aula,
      GRUPO: item.grupo,
      PROGRAMA: item.programa,
      DIA: item.dia,
      HORARIO: item.hora
    }));

    const parser = new Parser({
      fields: ['MATERIA', 'DOCENTE', 'AULA', 'GRUPO', 'PROGRAMA', 'DIA', 'HORARIO']
    });

    const csv = parser.parse(data);

    res.header('Content-Type', 'text/csv');
    res.attachment('Horario_Academico.csv');

    res.send(csv);
  } catch (err) {
    res.status(500).json(err);
  }
});



// =========================
// SERVIDOR
// =========================

app.listen(3001, () => {
  console.log('🚀 Servidor ejecutándose en puerto 3001');
});