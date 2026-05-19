// routes/agente.js
// Monta el agente como endpoint REST en tu backend Express existente
// Uso:
// const agenteRouter = require('./routes/agente');
// app.use('/api/agente', agenteRouter);

const express = require('express');
const { runAgente } = require('../agent-horarios');

const router = express.Router();

// ==========================
// Almacén temporal de sesiones
// ==========================
// En producción se recomienda Redis o SQLite
const sesiones = new Map();


// ======================================
// POST /api/agente/chat
// Body:
// {
//   "mensaje": "Genera un horario",
//   "sesion_id": "abc123"
// }
// ======================================

router.post('/chat', async (req, res) => {

  const {
    mensaje,
    sesion_id = 'default'
  } = req.body;

  if (!mensaje || typeof mensaje !== 'string') {

    return res.status(400).json({
      error: "El campo 'mensaje' es requerido."
    });

  }

  const historial =
    sesiones.get(sesion_id) || [];

  try {

    const resultado =
      await runAgente(
        mensaje,
        historial
      );

    const respuesta =
      resultado.respuesta;

    const nuevoHistorial =
      resultado.historial || [];

    // Guarda últimos 20 mensajes
    sesiones.set(
      sesion_id,
      nuevoHistorial.slice(-20)
    );

    return res.json({
      respuesta,
      sesion_id
    });

  } catch (err) {

    console.error(
      '[Agente] Error:',
      err.message
    );

    return res.status(500).json({
      error:
        'Error interno del agente.'
    });

  }

});


// ======================================
// DELETE /api/agente/chat/:sesion_id
// Limpia historial de sesión
// ======================================

router.delete(
  '/chat/:sesion_id',
  (req, res) => {

    sesiones.delete(
      req.params.sesion_id
    );

    res.json({
      ok: true
    });

  }
);


// ======================================
// GET /api/agente/horario
// Ejemplo:
// /api/agente/horario?semestre=2025-2
// ======================================

router.get('/horario', async (req, res) => {

  try {

    const semestre =
      req.query.semestre || '2025-2';

    const resultado =
      await runAgente(
        `Genera y valida el horario completo para el semestre ${semestre}`,
        []
      );

    res.json({
      respuesta: resultado.respuesta,
      semestre
    });

  } catch (err) {

    console.error('ERROR COMPLETO:', err);

    res.status(500).json({
      error: err.message,
      stack: err.stack
    });

  }

});

module.exports = router;