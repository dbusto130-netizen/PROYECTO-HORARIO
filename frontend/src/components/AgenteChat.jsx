// components/AgenteChat.jsx

import { useState, useRef, useEffect } from "react";

const API = "http://localhost:3001/api";
const SESION_ID = `sesion_${Date.now()}`;

function getQuickActions(semestre) {
  return [
    { label: "Generar horario",          prompt: `Genera el horario optimizado para el semestre ${semestre}` },
    { label: "⚠ Ver conflictos",         prompt: "Detecta todos los conflictos en el horario actual" },
    { label: "✓ Validar prerrequisitos", prompt: "Valida que los prerrequisitos estén correctos" },
    { label: "↓ Exportar CSV",           prompt: "Exporta el horario en formato CSV" },
    { label: "✉ Notificar directores",   prompt: "Genera el reporte para notificar a los directores" },
  ];
}

function DotsLoader() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "4px 2px", alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#475569",
            display: "inline-block",
            animation: "dotBounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function AgenteChat({ onHorarioGenerado, semestre = '2025-2' }) {
  const [mensajes, setMensajes] = useState([
    {
      rol: "agente",
      texto: "Hola. Soy el agente de horarios de UNIAJC.\nPuedo generar propuestas, detectar conflictos y exportar horarios.\n¿Cómo te ayudo?",
    },
  ]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const QUICK_ACTIONS = getQuickActions(semestre);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  async function enviar(texto) {
    const msg = texto || input.trim();
    if (!msg || cargando) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "38px";
    setMensajes((prev) => [...prev, { rol: "usuario", texto: msg }]);
    setCargando(true);

    try {
      const res = await fetch(`${API}/agente/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: msg, sesion_id: SESION_ID }),
      });
      const data = await res.json();
      setMensajes((prev) => [
        ...prev,
        { rol: "agente", texto: data.respuesta || data.error },
      ]);
      if (msg.toLowerCase().includes("generar") && onHorarioGenerado) {
        onHorarioGenerado();
      }
    } catch {
      setMensajes((prev) => [
        ...prev,
        { rol: "agente", texto: "Error de conexión con el agente.", error: true },
      ]);
    } finally {
      setCargando(false);
    }
  }

  function autoResize(e) {
    const el = e.target;
    el.style.height = "38px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
    setInput(el.value);
  }

  return (
    <>
      <style>{`
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        .qa-btn:hover:not(:disabled) {
          background: #1e3a5f !important;
          border-color: #2563eb !important;
          color: #93c5fd !important;
        }
        .send-btn:hover:not(:disabled) {
          background: #1d4ed8 !important;
        }
        .chat-textarea:focus {
          outline: none;
          border-color: #2563eb !important;
        }
        .chat-textarea::placeholder { color: #334155; }
        .mensajes-scroll::-webkit-scrollbar { width: 4px; }
        .mensajes-scroll::-webkit-scrollbar-track { background: transparent; }
        .mensajes-scroll::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}>

        {/* Acciones rápidas */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #1e293b",
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
            color: "#334155", textTransform: "uppercase", marginBottom: 8,
          }}>
            Acciones rápidas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                className="qa-btn"
                onClick={() => enviar(a.prompt)}
                disabled={cargando}
                style={{
                  padding: "5px 10px",
                  fontSize: 11, fontWeight: 600,
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 5,
                  color: "#64748b",
                  cursor: cargando ? "not-allowed" : "pointer",
                  opacity: cargando ? 0.5 : 1,
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mensajes */}
        <div
          className="mensajes-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {mensajes.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: m.rol === "usuario" ? "flex-end" : "flex-start",
              }}
            >
              <div style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: "0.07em",
                color: m.rol === "usuario" ? "#3b82f6" : "#475569",
                textTransform: "uppercase",
                marginBottom: 4,
              }}>
                {m.rol === "usuario" ? "Tú" : "Agente IA"}
              </div>

              <div style={{
                maxWidth: "92%",
                padding: "10px 14px",
                borderRadius: m.rol === "usuario"
                  ? "12px 12px 4px 12px"
                  : "4px 12px 12px 12px",
                background: m.error
                  ? "#1a0808"
                  : m.rol === "usuario"
                    ? "#172554"
                    : "#111827",
                border: `1px solid ${
                  m.error ? "#7f1d1d"
                  : m.rol === "usuario" ? "#1e3a8a"
                  : "#1e293b"
                }`,
                borderLeft: m.rol === "agente"
                  ? `3px solid ${m.error ? "#ef4444" : "#2563eb"}`
                  : undefined,
              }}>
                <pre style={{
                  margin: 0,
                  fontSize: 12.5,
                  lineHeight: 1.7,
                  color: m.error ? "#fca5a5"
                    : m.rol === "usuario" ? "#bfdbfe"
                    : "#94a3b8",
                  fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {m.texto}
                </pre>
              </div>
            </div>
          ))}

          {cargando && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
                color: "#475569", textTransform: "uppercase", marginBottom: 4,
              }}>
                Agente IA
              </div>
              <div style={{
                padding: "8px 14px",
                background: "#111827",
                border: "1px solid #1e293b",
                borderLeft: "3px solid #2563eb",
                borderRadius: "4px 12px 12px 12px",
              }}>
                <DotsLoader />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 16px",
          borderTop: "1px solid #1e293b",
          background: "#0d1117",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexShrink: 0,
        }}>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={autoResize}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Escribe una consulta... (Enter para enviar)"
            disabled={cargando}
            rows={1}
            style={{
              flex: 1,
              height: 38,
              minHeight: 38,
              maxHeight: 120,
              resize: "none",
              background: "#0a0e17",
              border: "1px solid #1e293b",
              borderRadius: 8,
              padding: "9px 12px",
              color: "#e2e8f0",
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
              transition: "border-color 0.15s",
              opacity: cargando ? 0.6 : 1,
            }}
          />
          <button
            className="send-btn"
            onClick={() => enviar()}
            disabled={!input.trim() || cargando}
            style={{
              height: 38,
              padding: "0 16px",
              background: !input.trim() || cargando ? "#1e293b" : "#2563eb",
              border: "none",
              borderRadius: 8,
              color: !input.trim() || cargando ? "#475569" : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: !input.trim() || cargando ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            Enviar
          </button>
        </div>
      </div>
    </>
  );
}
