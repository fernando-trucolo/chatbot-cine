// Importar librerías
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const app = express();
const puerto = 3000;

app.use(cors());
app.use(express.json());

// Conexión a MySQL
const conexion = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'cinebot'
});

conexion.connect(error => {
  if (error) {
    console.log('❌ Error al conectar a la base de datos:', error);
  } else {
    console.log('✅ Conectado a la base de datos cinebot');
  }
});

// ===== FUNCIONES AUXILIARES PARA MEJOR COMPRENSIÓN =====

// Normaliza el texto eliminando acentos y caracteres especiales
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?!¡.,;:]/g, '');
}

// Detecta si el mensaje contiene alguna palabra clave
function contieneAlguna(mensaje, palabrasClave) {
  const mensajeNorm = normalizar(mensaje);
  return palabrasClave.some(palabra => mensajeNorm.includes(normalizar(palabra)));
}

// Calcula similitud básica entre dos textos (útil para nombres de películas)
function similitud(texto1, texto2) {
  const t1 = normalizar(texto1);
  const t2 = normalizar(texto2);
  
  // Coincidencia exacta
  if (t1 === t2) return 1;
  
  // Contiene el texto completo
  if (t1.includes(t2) || t2.includes(t1)) return 0.8;
  
  // Coincidencia de palabras
  const palabras1 = t1.split(' ');
  const palabras2 = t2.split(' ');
  const coincidencias = palabras1.filter(p => palabras2.includes(p)).length;
  
  return coincidencias / Math.max(palabras1.length, palabras2.length);
}

// Identifica la intención del usuario
function identificarIntencion(mensaje) {
  const saludos = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hey', 'saludos', 'que tal'];
  const peliculas = ['pelicula', 'peliculas', 'cartelera', 'que hay', 'que tienen', 'que estrenan', 'funciones', 'que puedo ver'];
  const horarios = ['hora', 'horario', 'cuando', 'que hora', 'a que hora', 'funciones'];
  const precios = ['precio', 'precios', 'costo', 'costos', 'cuanto', 'vale', 'valor', 'entrada', 'entradas', 'boleto', 'boletos'];
  const reservar = ['reservar', 'reserva', 'comprar', 'apartar', 'agendar', 'quiero ver', 'me gustaria ver'];
  const despedidas = ['gracias', 'muchas gracias', 'adios', 'chau', 'bye', 'hasta luego', 'nos vemos', 'me despido'];

  if (contieneAlguna(mensaje, saludos)) return 'saludo';
  if (contieneAlguna(mensaje, despedidas)) return 'despedida';
  if (contieneAlguna(mensaje, reservar)) return 'reservar';
  if (contieneAlguna(mensaje, precios)) return 'precios';
  if (contieneAlguna(mensaje, horarios)) return 'horarios';
  if (contieneAlguna(mensaje, peliculas)) return 'peliculas';

  return 'desconocido';
}

// ===== RUTA PRINCIPAL DEL CHATBOT =====
app.post('/api/chat', (req, res) => {
  const mensaje = req.body.mensaje;
  
  // 🧾 GUARDAR RESERVA - Verificar PRIMERO antes de identificar intención
  // Formato: nombre, correo, id_funcion, cantidad
  if (mensaje.includes('@') && mensaje.includes(',')) {
    const partes = mensaje.split(',').map(p => p.trim());
    
    // Si tiene 4 partes, es una reserva
    if (partes.length === 4) {
      const nombre = partes[0];
      const correo = partes[1];
      const idFuncion = parseInt(partes[2]);
      const cantidad = parseInt(partes[3]);

      // Validar que parece una reserva (tiene números en posiciones 3 y 4)
      if (!isNaN(idFuncion) && !isNaN(cantidad)) {
        // Validar datos
        if (!correo.includes('@')) {
          return res.json({ respuesta: '⚠️ El correo no es válido.' });
        }

        if (cantidad < 1) {
          return res.json({ respuesta: '⚠️ La cantidad debe ser al menos 1.' });
        }

        // Obtener precio de la función
        conexion.query(
          'SELECT p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula WHERE f.id = ?',
          [idFuncion],
          (error, resultado) => {
            if (error || resultado.length === 0) {
              return res.json({ respuesta: '❌ No se encontró la función especificada. Use "reservar" para ver funciones disponibles.' });
            }

            const funcion = resultado[0];
            const total = funcion.precio * cantidad;

            // Guardar reserva
            const sql = 'INSERT INTO reservas (nombre, correo, id_funcion, cantidad, total) VALUES (?, ?, ?, ?, ?)';
            conexion.query(sql, [nombre, correo, idFuncion, cantidad, total], (error, result) => {
              if (error) {
                console.error('Error al guardar la reserva:', error);
                return res.json({ respuesta: '❌ Hubo un error al guardar su reserva. Intente más tarde.' });
              }

              res.json({
                respuesta: `✅ 🎫 Reserva confirmada!\n\n👤 Nombre: ${nombre}\n📧 Correo: ${correo}\n🎬 Película: ${funcion.titulo}\n🕓 Horario: ${funcion.horario}\n🎟️ Entradas: ${cantidad}\n💰 Total: ${total}\n\nLe enviaremos los detalles a su correo.`
              });
            });
          }
        );
        return; // Importante: salir aquí para no continuar procesando
      }
    }
  }

  // Ahora sí identificar la intención para otros casos
  const intencion = identificarIntencion(mensaje);

  // 👋 SALUDO
  if (intencion === 'saludo') {
    return res.json({
      respuesta: '👋 ¡Hola! Soy el asistente virtual del cine 😊. Estoy aquí para ayudarle. Puede preguntar por "películas", "horarios", "precios" o hacer una "reserva".'
    });
  }

  // 👋 DESPEDIDA
  else if (intencion === 'despedida') {
    return res.json({
      respuesta: '👋 ¡Gracias por su visita! Que disfrute su película. ¡Nos vemos pronto! 🎬'
    });
  }

  // 🎬 MOSTRAR PELÍCULAS
  else if (intencion === 'peliculas') {
    conexion.query('SELECT titulo FROM peliculas', (error, resultados) => {
      if (error) return res.json({ respuesta: '❌ Error al obtener películas.' });
      const lista = resultados.map(p => p.titulo).join(', ');
      res.json({ respuesta: '🎥 Hoy tenemos en cartelera: ' + lista });
    });
  }

  // 🕓 MOSTRAR HORARIOS
  else if (intencion === 'horarios') {
    conexion.query(
      'SELECT p.titulo, f.horario FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula',
      (error, resultados) => {
        if (error) return res.json({ respuesta: '❌ Error al obtener horarios.' });

        let texto = '🕓 Horarios disponibles:\n';
        resultados.forEach(r => {
          texto += `${r.titulo} - ${r.horario}\n`;
        });
        res.json({ respuesta: texto });
      }
    );
  }

  // 💰 MOSTRAR PRECIOS
  else if (intencion === 'precios') {
    conexion.query(
      'SELECT p.titulo, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula',
      (error, resultados) => {
        if (error) return res.json({ respuesta: '❌ Error al obtener precios.' });

        let texto = '💰 Precios:\n';
        resultados.forEach(r => {
          texto += `${r.titulo}: $${r.precio}\n`;
        });
        res.json({ respuesta: texto });
      }
    );
  }

  // 🎟️ INICIAR PROCESO DE RESERVA
  else if (intencion === 'reservar') {
    // Mostrar películas disponibles con sus funciones
    conexion.query(
      'SELECT f.id, p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula ORDER BY p.titulo',
      (error, funciones) => {
        if (error) return res.json({ respuesta: '❌ Error al obtener funciones disponibles.' });

        let texto = '🎟️ Para reservar, escriba:\nnombre, correo, ID de función, cantidad\n\n📋 Funciones disponibles:\n\n';
        funciones.forEach(f => {
          texto += `ID: ${f.id} - ${f.titulo} (${f.horario}) - ${f.precio} c/u\n`;
        });
        texto += '\n📝 Ejemplo: Juan Pérez, juan@gmail.com, 1, 2';
        
        res.json({ respuesta: texto });
      }
    );
  }

  // 🧾 GUARDAR RESERVA (formato: nombre, correo, id_funcion, cantidad)
  else if (mensaje.includes('@') && mensaje.includes(',')) {
    const partes = mensaje.split(',').map(p => p.trim());
    
    if (partes.length < 4) {
      return res.json({
        respuesta: '⚠️ Formato incompleto. Use:\nnombre, correo, ID función, cantidad\n\nEjemplo: Juan Pérez, juan@gmail.com, 1, 2'
      });
    }

    const nombre = partes[0];
    const correo = partes[1];
    const idFuncion = parseInt(partes[2]);
    const cantidad = parseInt(partes[3]);

    // Validar datos
    if (!correo.includes('@')) {
      return res.json({ respuesta: '⚠️ El correo no es válido.' });
    }

    if (isNaN(idFuncion) || isNaN(cantidad) || cantidad < 1) {
      return res.json({ respuesta: '⚠️ El ID de función y cantidad deben ser números válidos.' });
    }

    // Obtener precio de la función
    conexion.query(
      'SELECT p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula WHERE f.id = ?',
      [idFuncion],
      (error, resultado) => {
        if (error || resultado.length === 0) {
          return res.json({ respuesta: '❌ No se encontró la función especificada. Use "reservar" para ver funciones disponibles.' });
        }

        const funcion = resultado[0];
        const total = funcion.precio * cantidad;

        // Guardar reserva
        const sql = 'INSERT INTO reservas (nombre, correo, id_funcion, cantidad, total) VALUES (?, ?, ?, ?, ?)';
        conexion.query(sql, [nombre, correo, idFuncion, cantidad, total], (error, result) => {
          if (error) {
            console.error('Error al guardar la reserva:', error);
            return res.json({ respuesta: '❌ Hubo un error al guardar su reserva. Intente más tarde.' });
          }

          res.json({
            respuesta: `✅ 🎫 Reserva confirmada!\n\n👤 Nombre: ${nombre}\n📧 Correo: ${correo}\n🎬 Película: ${funcion.titulo}\n🕓 Horario: ${funcion.horario}\n🎟️ Entradas: ${cantidad}\n💰 Total: ${total}\n\nLe enviaremos los detalles a su correo.`
          });
        });
      }
    );
  }

  // ❓ CASO NO RECONOCIDO - Intentar buscar película similar
  else {
    // Buscar si mencionan alguna película en su mensaje
    conexion.query('SELECT titulo FROM peliculas', (error, peliculas) => {
      if (error) {
        return res.json({
          respuesta: '🤔 Perdón, no entendí la pregunta. Puede preguntar por "películas", "horarios", "precios" o "reservar".'
        });
      }

      // Buscar película más similar mencionada
      let mejorCoincidencia = null;
      let mejorSimilitud = 0;

      peliculas.forEach(p => {
        const sim = similitud(mensaje, p.titulo);
        if (sim > mejorSimilitud && sim > 0.4) {
          mejorSimilitud = sim;
          mejorCoincidencia = p.titulo;
        }
      });

      // Si encontró una película, dar info sobre ella
      if (mejorCoincidencia) {
        conexion.query(
          'SELECT p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula WHERE p.titulo = ?',
          [mejorCoincidencia],
          (error, datos) => {
            if (error || datos.length === 0) {
              return res.json({
                respuesta: `🎬 Encontré la película "${mejorCoincidencia}". ¿Qué desea saber: horarios, precios o reservar?`
              });
            }

            const info = datos[0];
            res.json({
              respuesta: `🎬 "${info.titulo}"\n🕓 Horario: ${info.horario}\n💰 Precio: ${info.precio}\n\n¿Desea reservar?`
            });
          }
        );
      } else {
        // No entendió nada
        res.json({
          respuesta: '🤔 Perdón, no entendí la pregunta. Puede preguntar por "películas", "horarios", "precios" o "reservar".'
        });
      }
    });
  }
});

// Iniciar servidor
app.listen(puerto, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${puerto}`);
});