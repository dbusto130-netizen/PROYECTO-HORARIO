// mailer.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function enviarHorarioCSV(csvBuffer, destinatario, semestre) {
  const fecha = new Date().toLocaleDateString('es-CO');

  const { data, error } = await resend.emails.send({
    from: 'Agente Horarios UNIAJC <onboarding@resend.dev>', // remitente de prueba de Resend
    to: destinatario || process.env.MAIL_DESTINO,
    subject: `Horario Académico ${semestre} — Facultad de Ingeniería UNIAJC`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #1e3a5f; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0;">Horario Académico Generado</h2>
          <p style="color: #93c5fd; margin: 8px 0 0;">Facultad de Ingeniería — UNIAJC</p>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
          <p style="color: #374151;">Se ha generado el horario para el semestre <strong>${semestre}</strong>.</p>
          <p style="color: #374151;">Fecha: <strong>${fecha}</strong></p>
          <p style="color: #6b7280; font-size: 13px;">El archivo CSV adjunto contiene el horario completo.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">Generado automáticamente por el Agente de Horarios UNIAJC.</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `Horario_${semestre}.csv`,
        content: csvBuffer.toString('base64'),
      },
    ],
  });

  if (error) throw new Error(error.message);

  return { ok: true, id: data.id };
}

module.exports = { enviarHorarioCSV };