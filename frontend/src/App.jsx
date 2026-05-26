import { useEffect, useState, useCallback } from 'react'
import AgenteChat from './components/AgenteChat'

const API = 'http://localhost:3001'
const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']

function Badge({ tipo }) {
  const colores = {
    docente: { bg: '#1e3a5f', color: '#60a5fa', label: 'Docente' },
    aula:    { bg: '#1a3a2a', color: '#4ade80', label: 'Aula' },
    grupo:   { bg: '#3b1f1f', color: '#f87171', label: 'Grupo' },
  }
  const c = colores[tipo] || { bg: '#1e293b', color: '#94a3b8', label: tipo }
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: '2px 8px', borderRadius: '4px',
      fontSize: '11px', fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      fontFamily: 'var(--font-mono)',
    }}>{c.label}</span>
  )
}

function SeveridadDot({ sev }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: sev === 'alta' ? '#ef4444' : '#f59e0b',
      marginRight: 6, flexShrink: 0,
    }} />
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: '#111827',
      border: `1px solid ${accent}33`,
      borderTop: `3px solid ${accent}`,
      borderRadius: '8px',
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function TablaHorario({ horario }) {
  const [vista, setVista] = useState('tabla')
  const [filtro, setFiltro] = useState('')

  const filtrado = horario.filter(item =>
    !filtro ||
    item.materia?.toLowerCase().includes(filtro.toLowerCase()) ||
    item.docente?.toLowerCase().includes(filtro.toLowerCase()) ||
    item.grupo?.toLowerCase().includes(filtro.toLowerCase())
  )

  if (vista === 'grid') {
    const porDia = DIAS_ORDEN.reduce((acc, dia) => {
      acc[dia] = filtrado.filter(i => i.dia === dia).sort((a, b) => a.hora?.localeCompare(b.hora))
      return acc
    }, {})

    return (
      <div>
        <VistaControles vista={vista} setVista={setVista} filtro={filtro} setFiltro={setFiltro} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 16 }}>
          {DIAS_ORDEN.map(dia => (
            <div key={dia}>
              <div style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                color: '#60a5fa', textTransform: 'uppercase',
                padding: '6px 0', borderBottom: '1px solid #1e293b', marginBottom: 8
              }}>{dia}</div>
              {porDia[dia].length === 0
                ? <div style={{ fontSize: 11, color: '#334155', padding: '8px 0' }}>Sin clases</div>
                : porDia[dia].map((item, i) => (
                  <div key={i} style={{
                    background: '#111827', border: '1px solid #1e293b',
                    borderRadius: 6, padding: '10px', marginBottom: 8,
                    borderLeft: '3px solid #2563eb',
                  }}>
                    <div style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                      {item.hora}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3, marginBottom: 4 }}>
                      {item.materia}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{item.docente}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{item.aula} · Gr. {item.grupo}</div>
                  </div>
                ))
              }
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <VistaControles vista={vista} setVista={setVista} filtro={filtro} setFiltro={setFiltro} />
      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Materia', 'Docente', 'Aula', 'Grupo', 'Programa', 'Día', 'Hora'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: 'left',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#475569'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrado.map((item, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid #0f172a',
                background: i % 2 === 0 ? '#0d1117' : '#111827',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#0d1117' : '#111827'}
              >
                <td style={{ padding: '12px 14px', color: '#e2e8f0', fontWeight: 600 }}>{item.materia}</td>
                <td style={{ padding: '12px 14px', color: '#94a3b8' }}>{item.docente}</td>
                <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.aula}</td>
                <td style={{ padding: '12px 14px', color: '#64748b' }}>{item.grupo}</td>
                <td style={{ padding: '12px 14px', color: '#475569', fontSize: 12 }}>{item.programa}</td>
                <td style={{ padding: '12px 14px', color: '#60a5fa', fontWeight: 600 }}>{item.dia}</td>
                <td style={{ padding: '12px 14px', color: '#4ade80', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{item.hora}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrado.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#334155', fontSize: 13 }}>
            Sin resultados para "{filtro}"
          </div>
        )}
      </div>
    </div>
  )
}

function VistaControles({ vista, setVista, filtro, setFiltro }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={filtro}
        onChange={e => setFiltro(e.target.value)}
        placeholder="Filtrar por materia, docente o grupo..."
        style={{
          flex: 1, minWidth: 200,
          background: '#0d1117', border: '1px solid #1e293b',
          borderRadius: 6, padding: '8px 12px',
          color: '#e2e8f0', fontSize: 13,
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        {[['tabla', '☰ Lista'], ['grid', '▦ Por día']].map(([key, label]) => (
          <button key={key} onClick={() => setVista(key)} style={{
            padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: '1px solid',
            borderColor: vista === key ? '#2563eb' : '#1e293b',
            background: vista === key ? '#1e3a5f' : '#111827',
            color: vista === key ? '#60a5fa' : '#475569',
            cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>
    </div>
  )
}

function SeccionConflictos({ conflictos }) {
  const altos = conflictos.filter(c => c.severidad === 'alta')
  const medios = conflictos.filter(c => c.severidad === 'media' || !c.severidad)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {conflictos.length === 0 ? (
        <div style={{
          background: '#052e16', border: '1px solid #166534',
          borderRadius: 8, padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <div>
            <div style={{ color: '#4ade80', fontWeight: 700, fontSize: 14 }}>Sin conflictos detectados</div>
            <div style={{ color: '#166534', fontSize: 12, marginTop: 2 }}>El horario cumple todas las restricciones</div>
          </div>
        </div>
      ) : (
        <>
          {altos.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#ef4444', textTransform: 'uppercase', marginBottom: 4 }}>
              Alta severidad ({altos.length})
            </div>
          )}
          {altos.map((c, i) => <TarjetaConflicto key={i} c={c} />)}
          {medios.length > 0 && altos.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#f59e0b', textTransform: 'uppercase', margin: '8px 0 4px' }}>
              Severidad media ({medios.length})
            </div>
          )}
          {medios.map((c, i) => <TarjetaConflicto key={i} c={c} />)}
        </>
      )}
    </div>
  )
}

function TarjetaConflicto({ c }) {
  return (
    <div style={{
      background: '#0d1117',
      border: `1px solid ${c.severidad === 'alta' ? '#7f1d1d' : '#78350f'}`,
      borderLeft: `3px solid ${c.severidad === 'alta' ? '#ef4444' : '#f59e0b'}`,
      borderRadius: 8, padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SeveridadDot sev={c.severidad} />
        <Badge tipo={c.tipo} />
        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>{c.nombre}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 14 }}>
        {c.slot && <span style={{ fontFamily: 'var(--font-mono)', color: '#475569' }}>{c.slot} · </span>}
        {c.materia_a && <span>{c.materia_a} <span style={{ color: '#334155' }}>vs</span> {c.materia_b}</span>}
        {c.detalle && <span>{c.detalle}</span>}
      </div>
    </div>
  )
}

// ─── Toast global ───────────────────────────────────────────
function Toast({ mensaje }) {
  if (!mensaje) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: mensaje.ok ? '#052e16' : '#1a0808',
      border: `1px solid ${mensaje.ok ? '#166534' : '#7f1d1d'}`,
      color: mensaje.ok ? '#4ade80' : '#f87171',
      padding: '12px 20px', borderRadius: 8,
      fontSize: 13, fontWeight: 600,
      boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideIn 0.2s ease',
    }}>
      <span>{mensaje.ok ? '✓' : '✗'}</span>
      {mensaje.texto}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
function App() {
  const [datos, setDatos] = useState({ horario: [], conflictos: [] })
  const [cargando, setCargando] = useState(true)
  const [semestre, setSemestre] = useState('2025-2')
  const [panelActivo, setPanelActivo] = useState('horario')
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null)

  // ── Estado del envío de correo ──
  const [enviando, setEnviando] = useState(false)
  const [toast, setToast] = useState(null)

  const mostrarToast = (ok, texto) => {
    setToast({ ok, texto })
    setTimeout(() => setToast(null), 4000)
  }

  const cargarDatos = useCallback(() => {
    return fetch(`${API}/horario-agente`)
      .then(res => res.json())
      .then(data => {
        setDatos({
          horario: data.horario || [],
          conflictos: data.conflictos || [],
        })
        setUltimaActualizacion(new Date())
        setCargando(false)
      })
      .catch(err => {
        console.error(err)
        setCargando(false)
      })
  }, [])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  // ── Enviar correo ──
  async function enviarCorreo() {
    if (datos.horario.length === 0) {
      mostrarToast(false, 'Genera un horario primero antes de enviar.')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch(`${API}/enviar-horario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semestre }),
      })
      const data = await res.json()
      mostrarToast(res.ok, data.mensaje || data.error)
    } catch {
      mostrarToast(false, 'Error de conexión al enviar el correo.')
    } finally {
      setEnviando(false)
    }
  }

  const conflictosAltos = datos.conflictos.filter(c => c.severidad === 'alta').length
  const conflictosTotales = datos.conflictos.length

  return (
    <>
      <style>{`
        :root { --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0e17; }
        @keyframes pulseRed { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }
        @keyframes slideIn  { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
        .btn-correo:hover:not(:disabled) { background: #064e3b !important; border-color: #059669 !important; }
      `}</style>

      <Toast mensaje={toast} />

      <div style={{
        minHeight: '100vh',
        background: '#0a0e17',
        color: '#e2e8f0',
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      }}>

        {/* ── Header ── */}
        <header style={{
          borderBottom: '1px solid #1e293b',
          background: '#0d1117',
          padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56,
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 28, height: 28, background: '#2563eb',
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>H</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>
                Agente de Horarios
              </div>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.06em', marginTop: 2 }}>
                UNIAJC · FACULTAD DE INGENIERÍA
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {ultimaActualizacion && (
              <span style={{ fontSize: 11, color: '#334155' }}>
                Actualizado {ultimaActualizacion.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {/* Selector semestre */}
            <div style={{
              background: '#0f172a', border: '1px solid #1e293b',
              borderRadius: 6, padding: '4px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 10, color: '#475569' }}>Semestre</span>
              <select
                value={semestre}
                onChange={e => setSemestre(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', color: '#60a5fa',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <option value="2025-1">2025-1</option>
                <option value="2025-2">2025-2</option>
                <option value="2026-1">2026-1</option>
              </select>
            </div>

            {/* Exportar CSV */}
            <a
              href={`${API}/exportar-horario`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#1e3a5f', border: '1px solid #2563eb',
                color: '#60a5fa', padding: '6px 14px',
                borderRadius: 6, textDecoration: 'none',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              }}
            >
              ↓ CSV
            </a>

            {/* ── Botón enviar correo ── */}
            <button
              className="btn-correo"
              onClick={enviarCorreo}
              disabled={enviando}
              style={{
                background: enviando ? '#1e293b' : '#052e16',
                border: `1px solid ${enviando ? '#1e293b' : '#166534'}`,
                color: enviando ? '#475569' : '#4ade80',
                padding: '6px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 700,
                cursor: enviando ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {enviando
                ? <><span style={{ fontSize: 11 }}>⏳</span> Enviando...</>
                : <><span>✉</span> Enviar a director</>
              }
            </button>
          </div>
        </header>

        {/* ── Layout principal ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          minHeight: 'calc(100vh - 56px)',
        }}>

          {/* Sidebar — Agente */}
          <aside style={{
            borderRight: '1px solid #1e293b',
            background: '#0d1117',
            display: 'flex', flexDirection: 'column',
            position: 'sticky', top: 56,
            height: 'calc(100vh - 56px)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #1e293b',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
                animation: 'pulseRed 2s ease-in-out infinite',
                boxShadow: '0 0 6px #4ade80',
              }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em' }}>
                AGENTE IA · GROQ
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <AgenteChat semestre={semestre} onHorarioGenerado={cargarDatos} />
            </div>
          </aside>

          {/* Panel principal */}
          <main style={{ padding: '28px 32px', overflow: 'auto' }}>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
              <StatCard
                label="Clases programadas"
                value={datos.horario.length}
                sub="en el semestre"
                accent="#60a5fa"
              />
              <StatCard
                label="Conflictos totales"
                value={conflictosTotales}
                sub={conflictosAltos > 0 ? `${conflictosAltos} de alta severidad` : 'ninguno crítico'}
                accent={conflictosTotales === 0 ? '#4ade80' : '#ef4444'}
              />
              <StatCard
                label="Docentes asignados"
                value={new Set(datos.horario.map(h => h.docente)).size}
                sub="con carga activa"
                accent="#a78bfa"
              />
              <StatCard
                label="Aulas utilizadas"
                value={new Set(datos.horario.map(h => h.aula)).size}
                sub="en rotación"
                accent="#fb923c"
              />
            </div>

            {/* Pestañas */}
            <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', marginBottom: 20, gap: 2 }}>
              {[
                ['horario',    `Horario (${datos.horario.length})`],
                ['conflictos', `Conflictos${conflictosTotales > 0 ? ` (${conflictosTotales})` : ''}`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPanelActivo(key)}
                  style={{
                    padding: '10px 18px',
                    fontSize: 13, fontWeight: 600,
                    background: 'none', cursor: 'pointer',
                    border: 'none',
                    borderBottom: `2px solid ${panelActivo === key ? '#2563eb' : 'transparent'}`,
                    color: panelActivo === key ? '#60a5fa' : '#475569',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  {label}
                  {key === 'conflictos' && conflictosAltos > 0 && (
                    <span style={{
                      background: '#ef4444', color: '#fff',
                      borderRadius: 10, padding: '1px 6px',
                      fontSize: 10, fontWeight: 800,
                      animation: 'pulseRed 2s ease-in-out infinite',
                    }}>{conflictosAltos}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Contenido */}
            {cargando ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#334155' }}>
                <div style={{ fontSize: 13 }}>Cargando datos...</div>
              </div>
            ) : panelActivo === 'horario' ? (
              datos.horario.length === 0 ? (
                <div style={{
                  padding: '48px', textAlign: 'center',
                  border: '1px dashed #1e293b', borderRadius: 12,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div style={{ color: '#475569', fontSize: 14, marginBottom: 8 }}>No hay horario generado aún</div>
                  <div style={{ color: '#334155', fontSize: 12 }}>
                    Usa el agente de IA a la izquierda para generar un horario optimizado
                  </div>
                </div>
              ) : (
                <TablaHorario horario={datos.horario} />
              )
            ) : (
              <SeccionConflictos conflictos={datos.conflictos} />
            )}
          </main>
        </div>
      </div>
    </>
  )
}

export default App