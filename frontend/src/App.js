import { useEffect, useState } from 'react'

function App() {

  const [datos, setDatos] = useState(null)

  useEffect(() => {

    fetch('http://localhost:3001/conflictos')
      .then(res => res.json())
      .then(data => {
        setDatos(data)
      })
      .catch(error => {
        console.log(error)
      })

  }, [])

  if (!datos) {

    return (

      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f172a',
        color: 'white',
        padding: '40px',
        fontFamily: 'Arial'
      }}>

        <h1>Cargando sistema...</h1>

      </div>

    )

  }

  return (

    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: 'white',
      padding: '40px',
      fontFamily: 'Arial'
    }}>

      <h1 style={{
        fontSize: '42px',
        marginBottom: '20px'
      }}>
        Agente Inteligente de Horarios
      </h1>

      {/* BOTON EXPORTAR */}

      <a
        href="http://localhost:3001/exportar-horario"
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          backgroundColor: '#2563eb',
          color: 'white',
          padding: '15px 25px',
          borderRadius: '10px',
          textDecoration: 'none',
          marginBottom: '40px',
          fontWeight: 'bold'
        }}
      >
        Descargar Horario CSV
      </a>

      <h2 style={{
        marginBottom: '20px'
      }}>
        Horarios Generados
      </h2>

      {
        datos.horario.map((item, index) => (

          <div
            key={index}
            style={{
              backgroundColor: '#1e293b',
              padding: '20px',
              borderRadius: '15px',
              marginBottom: '15px',
              boxShadow: '0 0 10px rgba(0,0,0,0.3)'
            }}
          >

            <p><strong>Materia:</strong> {item.materia}</p>

            <p><strong>Docente:</strong> {item.docente}</p>

            <p><strong>Aula:</strong> {item.aula}</p>

            <p><strong>Hora:</strong> {item.hora}</p>

          </div>

        ))
      }

      <h2 style={{
        marginTop: '40px',
        marginBottom: '20px'
      }}>
        Conflictos Detectados
      </h2>

      {
        datos.conflictos.length === 0
        ? (

          <div style={{
            backgroundColor: '#14532d',
            padding: '20px',
            borderRadius: '15px'
          }}>

            No existen conflictos

          </div>

        )

        : (

          datos.conflictos.map((c, index) => (

            <div
              key={index}
              style={{
                backgroundColor: '#7f1d1d',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '10px'
              }}
            >

              <p><strong>{c.tipo}</strong></p>

              <p>{c.detalle}</p>

            </div>

          ))

        )
      }

    </div>

  )

}

export default App