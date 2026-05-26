// agent-horarios.js
// Agente ReAct para optimización de horarios — UNIAJC Facultad de Ingeniería
// Requiere: npm install groq-sdk better-sqlite3

// agent-horarios.js
require('dotenv').config();
const Groq = require('groq-sdk');
const db = require('./database'); // ← misma conexión que app.js, NO better-sqlite3

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Wrappers promisificados (sqlite3 es callback-based) ───
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
  );

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this) })
  );
// ─────────────────────────────────────────────
// HERRAMIENTAS DEL AGENTE
// Cada tool es una función pura que lee/escribe SQLite
// ─────────────────────────────────────────────
const tools = {
  async modificar_asignacion({ materia, dia, hora, docente, aula, grupo } = {}) {
    // Busca el registro actual por nombre de materia
    const filas = await dbAll(
      `SELECT h.id, h.materia_id FROM horarios h
      JOIN materias m ON h.materia_id = m.id
      WHERE m.nombre LIKE ?`,
      [`%${materia}%`]
    );

    if (!filas.length) {
      return { error: `No se encontró la materia "${materia}" en el horario` };
    }

    const { id, materia_id } = filas[0];
    const cambios = [];

    // Construye el UPDATE solo con los campos enviados
    if (dia)    cambios.push({ campo: 'dia',        valor: dia });
    if (hora)   cambios.push({ campo: 'hora',       valor: hora });

    if (docente) {
      const doc = await dbAll('SELECT id FROM docentes WHERE nombre LIKE ?', [`%${docente}%`]);
      if (doc.length) cambios.push({ campo: 'docente_id', valor: doc[0].id });
      else return { error: `Docente "${docente}" no encontrado` };
    }

    if (aula) {
      const aul = await dbAll('SELECT id FROM aulas WHERE nombre LIKE ?', [`%${aula}%`]);
      if (aul.length) cambios.push({ campo: 'aula_id', valor: aul[0].id });
      else return { error: `Aula "${aula}" no encontrada` };
    }

    if (grupo) {
      const grp = await dbAll('SELECT id FROM grupos WHERE nombre LIKE ?', [`%${grupo}%`]);
      if (grp.length) cambios.push({ campo: 'grupo_id', valor: grp[0].id });
      else return { error: `Grupo "${grupo}" no encontrado` };
    }

    if (!cambios.length) {
      return { error: 'No se especificaron cambios válidos' };
    }

    const setClause = cambios.map(c => `${c.campo} = ?`).join(', ');
    const valores   = cambios.map(c => c.valor);

    await dbRun(`UPDATE horarios SET ${setClause} WHERE id = ?`, [...valores, id]);

    return { ok: true, mensaje: `Asignación de "${materia}" actualizada`, cambios: cambios.map(c => c.campo) };
  },

  async obtener_insumos() {
    const [docentes, materias, aulas, grupos] = await Promise.all([
      dbAll('SELECT * FROM docentes'),
      dbAll('SELECT * FROM materias'),
      dbAll('SELECT * FROM aulas'),
      dbAll('SELECT * FROM grupos'),
    ]);
    return { docentes, materias, aulas, grupos };
  },

  async generar_propuesta({ semestre = '2025-2' } = {}) {
    const { docentes, materias, aulas, grupos } = await tools.obtener_insumos();

    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const FRANJAS = ['07:00', '08:00', '09:00', '10:00', '11:00',
                    '13:00', '14:00', '15:00', '16:00', '18:00', '19:00'];

    const horario = [];
    const ocupados = { docente: new Set(), aula: new Set(), grupo: new Set() };
    const clave = (tipo, nombre, dia, hora) => `${tipo}|${nombre}|${dia}|${hora}`;
    const cargaDocente = Object.fromEntries(docentes.map(d => [d.id, 0]));

    await dbRun(`CREATE TABLE IF NOT EXISTS horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      materia_id INTEGER, docente_id INTEGER,
      aula_id INTEGER, grupo_id INTEGER,
      dia TEXT, hora TEXT, semestre TEXT,
      UNIQUE(materia_id, semestre)
    )`);

    await dbRun('DELETE FROM horarios WHERE semestre = ?', [semestre]);

    // Distribuye materias en orden rotando días
    // Materia 0 → Lunes, Materia 1 → Martes, Materia 2 → Miércoles, etc.
    for (let i = 0; i < materias.length; i++) {
      const materia = materias[i];
      let asignado = false;

      // Empieza desde el día que le toca según su índice, rota si no hay slot
      const diasRotados = [
        ...DIAS.slice(i % DIAS.length),
        ...DIAS.slice(0, i % DIAS.length)
      ];

      outer: for (const dia of diasRotados) {
        // Rota también la hora de inicio para distribuir en el día
        const horaInicio = Math.floor(i / DIAS.length) % FRANJAS.length;
        const franjasRotadas = [
          ...FRANJAS.slice(horaInicio),
          ...FRANJAS.slice(0, horaInicio)
        ];

        for (const hora of franjasRotadas) {
          const docente = docentes
            .filter(d =>
              !ocupados.docente.has(clave('doc', d.nombre, dia, hora)) &&
              cargaDocente[d.id] < (d.carga_max || 20)
            )
            .sort((a, b) => cargaDocente[a.id] - cargaDocente[b.id])[0];

          if (!docente) continue;

          const grupo = grupos.find(g =>
            !ocupados.grupo.has(clave('grupo', g.nombre, dia, hora))
          );
          if (!grupo) continue;

          const aula = aulas.find(a =>
            !ocupados.aula.has(clave('aula', a.nombre, dia, hora))
          );
          if (!aula) continue;

          ocupados.docente.add(clave('doc', docente.nombre, dia, hora));
          ocupados.aula.add(clave('aula', aula.nombre, dia, hora));
          ocupados.grupo.add(clave('grupo', grupo.nombre, dia, hora));
          cargaDocente[docente.id]++;

          const item = {
            materia_id: materia.id, materia: materia.nombre,
            docente_id: docente.id, docente: docente.nombre,
            aula_id: aula.id,       aula: aula.nombre,
            grupo_id: grupo.id,     grupo: grupo.nombre,
            programa: grupo.programa, dia, hora, semestre,
          };

          await dbRun(
            `INSERT OR REPLACE INTO horarios
            (materia_id, docente_id, aula_id, grupo_id, dia, hora, semestre)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.materia_id, item.docente_id, item.aula_id,
            item.grupo_id, item.dia, item.hora, item.semestre]
          );

          horario.push(item);
          asignado = true;
          break outer;
        }
      }

      if (!asignado) {
        horario.push({ materia: materia.nombre, sin_asignar: true });
      }
    }

    return {
      horario,
      total: horario.length,
      sin_asignar: horario.filter(h => h.sin_asignar),
    };
  },

  async detectar_conflictos({ semestre = '2025-2' } = {}) {
    const filas = await dbAll(`
      SELECT h.dia, h.hora,
             d.nombre as docente, a.nombre as aula,
             g.nombre as grupo,  m.nombre as materia
      FROM horarios h
      JOIN docentes d ON h.docente_id = d.id
      JOIN aulas    a ON h.aula_id    = a.id
      JOIN grupos   g ON h.grupo_id   = g.id
      JOIN materias m ON h.materia_id = m.id
      WHERE h.semestre = ?
    `, [semestre]);

    const conflictos = [];
    const vistos = { docente: {}, aula: {}, grupo: {} };

    for (const f of filas) {
      const slot = `${f.dia}|${f.hora}`;
      for (const tipo of ['docente', 'aula', 'grupo']) {
        const key = `${f[tipo]}|${slot}`;
        if (vistos[tipo][key]) {
          conflictos.push({
            tipo, nombre: f[tipo], slot,
            materia_a: vistos[tipo][key].materia,
            materia_b: f.materia,
            severidad: tipo === 'grupo' ? 'alta' : 'media',
          });
        } else {
          vistos[tipo][key] = f;
        }
      }
    }

    return { conflictos, total: conflictos.length };
  },

  async exportar_horario({ semestre = '2025-2' } = {}) {
    const filas = await dbAll(`
      SELECT m.nombre as materia, d.nombre as docente,
             a.nombre as aula,   g.nombre as grupo,
             g.programa, h.dia, h.hora
      FROM horarios h
      JOIN docentes d ON h.docente_id = d.id
      JOIN aulas    a ON h.aula_id    = a.id
      JOIN grupos   g ON h.grupo_id   = g.id
      JOIN materias m ON h.materia_id = m.id
      WHERE h.semestre = ?
      ORDER BY h.dia, h.hora
    `, [semestre]);

    return { horario: filas, total: filas.length };
  },
  async enviar_correo({ semestre = '2025-2', destinatario } = {}) {
    const { enviarHorarioCSV } = require('./mailer');
    const { Parser } = require('json2csv');

    const filas = await dbAll(`
      SELECT m.nombre as materia, d.nombre as docente,
            a.nombre as aula,   g.nombre as grupo,
            g.programa, h.dia,  h.hora
      FROM horarios h
      JOIN docentes d ON h.docente_id = d.id
      JOIN aulas    a ON h.aula_id    = a.id
      JOIN grupos   g ON h.grupo_id   = g.id
      JOIN materias m ON h.materia_id = m.id
      WHERE h.semestre = ?
      ORDER BY h.dia, h.hora
    `, [semestre]);

    if (!filas.length) {
      return { error: 'No hay horario generado. Genera uno primero.' };
    }

    const parser = new Parser({
      fields: ['materia','docente','aula','grupo','programa','dia','hora'],
    });
    const csv = parser.parse(filas);

    return await enviarHorarioCSV(
      Buffer.from(csv, 'utf-8'),
      destinatario || process.env.MAIL_DESTINO,
      semestre
    );
  },

  async notificar_directores({ semestre = '2025-2' } = {}) {
    const [{ conflictos }, { horario }] = await Promise.all([
      tools.detectar_conflictos({ semestre }),
      tools.exportar_horario({ semestre }),
    ]);
    return {
      semestre,
      fecha: new Date().toISOString(),
      resumen: {
        total_clases: horario.length,
        conflictos_detectados: conflictos.length,
        estado: conflictos.length === 0 ? 'aprobado' : 'requiere_revision',
      },
      conflictos,
    };
  },
};

// ─────────────────────────────────────────────
// LOOP REACT (Razona → Actúa → Observa)
// ─────────────────────────────────────────────

const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "enviar_correo",
      description: "Envía el horario generado como archivo CSV al correo del director o destinatario indicado.",
      parameters: {
        type: "object",
        properties: {
          semestre:     { type: "string", description: "Semestre del horario a enviar" },
          destinatario: { type: "string", description: "Correo destino, ej: director@uniajc.edu.co" },
        },
      },
    },
  },
  {
  type: "function",
  function: {
    name: "modificar_asignacion",
    description: "Modifica una asignación específica del horario: cambia día, hora, docente, aula o grupo de una materia.",
    parameters: {
      type: "object",
      properties: {
        materia: { type: "string", description: "Nombre o parte del nombre de la materia a modificar" },
        dia:     { type: "string", description: "Nuevo día (Lunes, Martes, Miércoles, Jueves, Viernes)" },
        hora:    { type: "string", description: "Nueva hora (07:00, 08:00, etc.)" },
        docente: { type: "string", description: "Nombre del nuevo docente" },
        aula:    { type: "string", description: "Nombre del nuevo aula" },
        grupo:   { type: "string", description: "Nombre del nuevo grupo" },
      },
      required: ["materia"],
    },
  },
},
  {
    type: "function",
    function: {
      name: "obtener_insumos",
      description: "Obtiene todos los docentes, materias, aulas y grupos desde la base de datos.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "generar_propuesta",
      description: "Genera un horario académico optimizado y sin conflictos usando backtracking determinista. Lo guarda en la BD.",
      parameters: {
        type: "object",
        properties: {
          semestre: { type: "string", description: "Identificador del semestre, ej: '2025-2'" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "detectar_conflictos",
      description: "Analiza el horario guardado y retorna todos los conflictos de docente, aula o grupo.",
      parameters: {
        type: "object",
        properties: {
          semestre: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "validar_prerequisitos",
      description: "Verifica que ninguna materia y su prerequisito estén en el mismo semestre.",
      parameters: {
        type: "object",
        properties: {
          semestre: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "exportar_horario",
      description: "Exporta el horario en formato JSON o CSV.",
      parameters: {
        type: "object",
        properties: {
          semestre: { type: "string" },
          formato: { type: "string", enum: ["json", "csv"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notificar_directores",
      description: "Genera el reporte completo de estado del horario para notificar a los directores de programa.",
      parameters: {
        type: "object",
        properties: {
          semestre: { type: "string" },
        },
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres un agente experto en optimización de horarios académicos de la Facultad de Ingeniería de UNIAJC.

Tu objetivo es ayudar a generar, validar y exportar horarios libres de conflictos.

Tienes acceso a herramientas que te permiten leer la base de datos, generar propuestas optimizadas, detectar conflictos y notificar a directores.

Cuando el usuario pida generar un horario:
1. Llama a obtener_insumos para ver qué datos hay
2. Llama a generar_propuesta para crear el horario
3. Llama a detectar_conflictos para verificarlo
4. Reporta los resultados con claridad

Responde siempre en español. Sé conciso y directo. Si hay conflictos, explica cuáles son y sugiere cómo resolverlos.`;

// Función principal — recibe el mensaje del usuario y devuelve la respuesta
async function runAgente(
  mensajeUsuario,
  historial = []
) {

  const messages = [
    ...historial,
    {
      role: "user",
      content: mensajeUsuario
    }
  ];

  let iteraciones = 0;
  const MAX_ITER = 6;

  while (iteraciones < MAX_ITER) {

    iteraciones++;

    const response =
      await groq.chat.completions.create({
        model:
          "llama-3.3-70b-versatile",

        messages: [
          {
            role: "system",
            content:
              SYSTEM_PROMPT
          },
          ...messages
        ],

        tools: TOOL_DEFS,
        tool_choice: "auto",
        max_tokens: 2048
      });

    const msg =
      response.choices[0].message;

    messages.push(msg);

    if (
      !msg.tool_calls ||
      msg.tool_calls.length === 0
    ) {

      return {
        respuesta: msg.content,
        historial: messages
      };

    }

    for (const call of msg.tool_calls) {
      //agregar-> resultado = await tools[nombre](args);  // ← agrega await

      const nombre =
        call.function.name;

      const args =
        JSON.parse(
          call.function.arguments ||
          "{}"
        );

      let resultado;

      try {

        if (tools[nombre]) {

          resultado =
            await tools[nombre](args);

        } else {

          resultado = {
            error:
              `Herramienta '${nombre}' no encontrada`
          };

        }

      } catch (err) {

        resultado = {
          error: err.message
        };

      }

      messages.push({
        role: "tool",
        tool_call_id:
          call.id,
        content:
          JSON.stringify(resultado)
      });

    }

  }

  return {
    respuesta:
      "Alcancé el límite de iteraciones.",
    historial: messages
  };

}


// EXPORT FINAL
module.exports = {
  runAgente
};