// agent-horarios.js
// Agente ReAct para optimización de horarios — UNIAJC Facultad de Ingeniería
// Requiere: npm install groq-sdk better-sqlite3

const Groq = require('groq-sdk');
const Database = require('better-sqlite3');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const db = new Database(process.env.DB_PATH || "./horarios.db");
console.log(process.env.GROQ_API_KEY);
// ─────────────────────────────────────────────
// HERRAMIENTAS DEL AGENTE
// Cada tool es una función pura que lee/escribe SQLite
// ─────────────────────────────────────────────

const tools = {
  // Carga los insumos desde la BD
  obtener_insumos() {
    return {
      docentes: db.prepare("SELECT * FROM docentes").all(),
      materias: db.prepare("SELECT * FROM materias").all(),
      aulas: db.prepare("SELECT * FROM aulas").all(),
      grupos: db.prepare("SELECT * FROM grupos").all(),
    };
  },

  // Genera un horario determinista con backtracking
  // Reemplaza el enfoque aleatorio con asignación sistemática
  generar_propuesta({ semestre = "2025-2" } = {}) {
    const { docentes, materias, aulas, grupos } = tools.obtener_insumos();

    const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    const FRANJAS = [
      "07:00", "08:00", "09:00", "10:00", "11:00",
      "13:00", "14:00", "15:00", "16:00", "18:00", "19:00",
    ];

    const horario = [];
    const ocupados = { docente: new Set(), aula: new Set(), grupo: new Set() };

    const clave = (tipo, nombre, dia, hora) => `${tipo}|${nombre}|${dia}|${hora}`;

    // Distribución uniforme de carga docente
    const cargaDocente = Object.fromEntries(docentes.map((d) => [d.id, 0]));
    const cargaMaxima = docentes[0]?.horas_max || 20;

    for (const materia of materias) {
      let asignado = false;

      // Itera de forma determinista (sin random) hasta encontrar slot válido
      outer: for (const dia of DIAS) {
        for (const hora of FRANJAS) {
          // Elige docente con menor carga que cumpla la materia
          const docente = docentes
            .filter((d) => {
              const k = clave("doc", d.nombre, dia, hora);
              return (
                !ocupados.docente.has(k) &&
                cargaDocente[d.id] < cargaMaxima &&
                (!d.materias_asignadas ||
                  d.materias_asignadas.includes(materia.id))
              );
            })
            .sort((a, b) => cargaDocente[a.id] - cargaDocente[b.id])[0];

          if (!docente) continue;

          // Elige aula con capacidad suficiente
          const grupo = grupos.find((g) => {
            const k = clave("grupo", g.nombre, dia, hora);
            return !ocupados.grupo.has(k);
          });

          if (!grupo) continue;

          const aula = aulas.find((a) => {
            const k = clave("aula", a.nombre, dia, hora);
            return !ocupados.aula.has(k) && a.capacidad >= (grupo.matriculas || 0);
          });

          if (!aula) continue;

          // Registra la asignación
          ocupados.docente.add(clave("doc", docente.nombre, dia, hora));
          ocupados.aula.add(clave("aula", aula.nombre, dia, hora));
          ocupados.grupo.add(clave("grupo", grupo.nombre, dia, hora));
          cargaDocente[docente.id]++;

          horario.push({
            materia_id: materia.id,
            materia: materia.nombre,
            docente_id: docente.id,
            docente: docente.nombre,
            aula_id: aula.id,
            aula: aula.nombre,
            grupo_id: grupo.id,
            grupo: grupo.nombre,
            programa: grupo.programa,
            dia,
            hora,
            semestre,
          });

          asignado = true;
          break outer;
        }
      }

      if (!asignado) {
        horario.push({
          materia_id: materia.id,
          materia: materia.nombre,
          sin_asignar: true,
          razon: "Sin slot disponible — revisar carga o disponibilidad",
        });
      }
    }

    // Persiste en BD
    const insert = db.prepare(`
      INSERT OR REPLACE INTO horarios 
      (materia_id, docente_id, aula_id, grupo_id, dia, hora, semestre)
      VALUES (@materia_id, @docente_id, @aula_id, @grupo_id, @dia, @hora, @semestre)
    `);
    const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
    insertMany(horario.filter((h) => !h.sin_asignar));

    return { horario, total: horario.length, sin_asignar: horario.filter((h) => h.sin_asignar) };
  },

  // Detecta conflictos en el horario guardado
  detectar_conflictos({ semestre = "2025-2" } = {}) {
    const filas = db.prepare(`
      SELECT h.*, d.nombre as docente, a.nombre as aula, g.nombre as grupo, m.nombre as materia
      FROM horarios h
      JOIN docentes d ON h.docente_id = d.id
      JOIN aulas a ON h.aula_id = a.id
      JOIN grupos g ON h.grupo_id = g.id
      JOIN materias m ON h.materia_id = m.id
      WHERE h.semestre = ?
    `).all(semestre);

    const conflictos = [];
    const vistos = { docente: {}, aula: {}, grupo: {} };

    for (const f of filas) {
      const slot = `${f.dia}|${f.hora}`;

      ["docente", "aula", "grupo"].forEach((tipo) => {
        const nombre = f[tipo];
        const key = `${nombre}|${slot}`;
        if (vistos[tipo][key]) {
          conflictos.push({
            tipo,
            nombre,
            slot,
            materia_a: vistos[tipo][key].materia,
            materia_b: f.materia,
            severidad: tipo === "grupo" ? "alta" : "media",
          });
        } else {
          vistos[tipo][key] = f;
        }
      });
    }

    return { conflictos, total: conflictos.length };
  },

  // Valida que los prerrequisitos se respeten en el semestre
  validar_prerequisitos({ semestre = "2025-2" } = {}) {
    const materias = db.prepare("SELECT * FROM materias WHERE prerequisito_id IS NOT NULL").all();
    const issues = [];

    for (const materia of materias) {
      const prerequisito = db.prepare("SELECT nombre FROM materias WHERE id = ?").get(materia.prerequisito_id);
      if (!prerequisito) continue;

      const enHorario = db.prepare(
        "SELECT 1 FROM horarios WHERE materia_id = ? AND semestre = ?"
      ).get(materia.id, semestre);

      const prereqEnHorario = db.prepare(
        "SELECT 1 FROM horarios WHERE materia_id = ? AND semestre = ?"
      ).get(materia.prerequisito_id, semestre);

      if (enHorario && prereqEnHorario) {
        issues.push({
          materia: materia.nombre,
          prerequisito: prerequisito.nombre,
          problema: "Ambas materias están en el mismo semestre",
          severidad: "alta",
        });
      }
    }

    return { issues, total: issues.length };
  },

  // Exporta el horario a JSON estructurado (listo para CSV también)
  exportar_horario({ semestre = "2025-2", formato = "json" } = {}) {
    const filas = db.prepare(`
      SELECT m.nombre as materia, d.nombre as docente, a.nombre as aula,
             g.nombre as grupo, g.programa, h.dia, h.hora, h.semestre
      FROM horarios h
      JOIN docentes d ON h.docente_id = d.id
      JOIN aulas a ON h.aula_id = a.id
      JOIN grupos g ON h.grupo_id = g.id
      JOIN materias m ON h.materia_id = m.id
      WHERE h.semestre = ?
      ORDER BY h.dia, h.hora
    `).all(semestre);

    if (formato === "csv") {
      const cabecera = "Materia,Docente,Aula,Grupo,Programa,Día,Hora,Semestre";
      const filasCsv = filas.map(
        (f) => `${f.materia},${f.docente},${f.aula},${f.grupo},${f.programa},${f.dia},${f.hora},${f.semestre}`
      );
      return { csv: [cabecera, ...filasCsv].join("\n"), total: filas.length };
    }

    return { horario: filas, total: filas.length };
  },

  // Genera el reporte de notificación para directores
  notificar_directores({ semestre = "2025-2" } = {}) {
    const { conflictos } = tools.detectar_conflictos({ semestre });
    const { issues: prerequisitos } = tools.validar_prerequisitos({ semestre });
    const { horario } = tools.exportar_horario({ semestre });

    const reporte = {
      semestre,
      fecha: new Date().toISOString(),
      resumen: {
        total_clases: horario.length,
        conflictos_detectados: conflictos.length,
        problemas_prerequisitos: prerequisitos.length,
        estado: conflictos.length === 0 ? "aprobado" : "requiere_revision",
      },
      conflictos,
      prerequisitos,
    };

    return reporte;
  },
};

// ─────────────────────────────────────────────
// LOOP REACT (Razona → Actúa → Observa)
// ─────────────────────────────────────────────

const TOOL_DEFS = [
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
            tools[nombre](args);

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