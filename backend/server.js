// ===== IMPORTS =====
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  }
});

// ===== CONEXIÓN A MYSQL =====
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'cinebot'
});

db.connect(err => {
  if (err) console.log("❌ Error DB:", err);
  else console.log("✅ Conectado a cinebot");
});

// ===== UTILIDADES =====
function normalizar(texto) {
  return texto.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, "");
}

function contiene(mensaje, arr) {
  const msg = normalizar(mensaje);
  return arr.some(p => msg.includes(normalizar(p)));
}

function similitud(a, b) {
  const t1 = normalizar(a);
  const t2 = normalizar(b);
  if (t1 === t2) return 1;
  if (t1.includes(t2) || t2.includes(t1)) return 0.8;

  const w1 = t1.split(" ");
  const w2 = t2.split(" ");
  const comunes = w1.filter(w => w2.includes(w)).length;
  return comunes / Math.max(w1.length, w2.length);
}

function intencion(mensaje) {
  const grupos = {
    saludo: ["hola", "buenas", "hey", "holo", "saludos", "buen"],
    despedida: ["chau", "adios", "bye", "nos vemos", "gracias"],
    peliculas: ["pelicula", "peliculas", "cartelera", "pelis"],
    horarios: ["horario", "hora", "cuando"],
    precios: ["precio", "cuanto vale", "entrada"],
    reservar: ["reservar", "comprar", "apartado", "guardar"],
    agregar: ["agregar", "insertar", "nueva", "poner"],
  };

  for (const [key, palabras] of Object.entries(grupos)) {
    if (contiene(mensaje, palabras)) return key;
  }
  return "desconocido";
}

let admin = { autenticado: false, paso: null };

// ===== SOCKET.IO =====
io.on("connection", socket => {
  console.log("🟢 Cliente conectado");

  socket.on("mensaje", mensaje => {

    const intent = intencion(mensaje);

    // ---------------- SALUDO ----------------
    if (intent === "saludo") {
      socket.emit("respuesta", "👋 ¡Hola! soy Cinebot, el asistente virtual del cine, estoy para ayudarte puedes preguntarme por películas, horarios, precios o para reservar.");
      return;
    }

    if (intent === "despedida") {
      socket.emit("respuesta", "👋 ¡Gracias por tu visita!");
      return;
    }

    // ---------------- PELÍCULAS ----------------
    if (intent === "peliculas") {
      db.query("SELECT titulo FROM peliculas", (err, rows) => {
        if (err) return socket.emit("respuesta", "❌ Error al obtener películas.");
        if (rows.length === 0) return socket.emit("respuesta", "No hay películas cargadas.");

        const lista = rows.map(r => r.titulo).join(", ");
        socket.emit("respuesta", "🎥 En cartelera: " + lista);
      });
      return;
    }

    // ---------------- HORARIOS ----------------
    if (intent === "horarios") {
      db.query(
        "SELECT p.titulo, f.horario FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula",
        (err, rows) => {
          if (err) return socket.emit("respuesta", "❌ Error al obtener horarios.");
          if (rows.length === 0) return socket.emit("respuesta", "No hay funciones disponibles.");

          const texto = rows.map(r => `${r.titulo} - ${r.horario}`).join("\n");
          socket.emit("respuesta", "🕓 Horarios:\n" + texto);
        }
      );
      return;
    }

    // ---------------- PRECIOS ----------------
    if (intent === "precios") {
      db.query(
        "SELECT p.titulo, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula",
        (err, rows) => {
          if (err) return socket.emit("respuesta", "❌ Error al obtener precios.");
          if (rows.length === 0) return socket.emit("respuesta", "No hay precios cargados.");

          const texto = rows.map(r => `${r.titulo}: $${r.precio}`).join("\n");
          socket.emit("respuesta", "💰 Precios:\n" + texto);
        }
      );
      return;
    }

    // ---------------- RESERVAR ----------------
    if (intent === "reservar") {
  db.query(
    "SELECT f.id, p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id = f.id_pelicula",
    (err, rows) => {
      if (err) return socket.emit("respuesta", "❌ Error al obtener funciones.");

      let txt = 
`🎟️ *Para reservar escribí los datos así:*

nombre, correo, ID función, cantidad

📌 *Ejemplo:*  
Fer Trucolo, fer@gmail.com, 4, 2

📽️ *Funciones disponibles:*  
`;

      rows.forEach(f => {
        txt += `\n• ID ${f.id} — ${f.titulo} (${f.horario}) — $${f.precio}`;
      });

      socket.emit("respuesta", txt);
    }
  );
  return;
}

    // ---------------- PROCESAR RESERVA ----------------
    if (mensaje.includes("@") && mensaje.includes(",")) {
      const partes = mensaje.split(",").map(x => x.trim());
      if (partes.length < 4) {
        socket.emit("respuesta", "⚠️ Formato: nombre, correo, ID función, cantidad");
        return;
      }

      const [nombre, correo, idFuncion, cantidad] = partes;

      db.query(
        "SELECT p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id=f.id_pelicula WHERE f.id=?",
        [idFuncion],
        (err, rows) => {
          if (err || rows.length === 0)
            return socket.emit("respuesta", "❌ No se encontró esa función.");

          const f = rows[0];
          const total = f.precio * cantidad;

          db.query(
            "INSERT INTO reservas (nombre, correo, id_funcion, cantidad, total) VALUES (?, ?, ?, ?, ?)",
            [nombre, correo, idFuncion, cantidad, total]
          );

          socket.emit("respuesta",
            `✅ Reserva confirmada!\n🎬 ${f.titulo}\n🕓 ${f.horario}\n🎟️ ${cantidad} entradas\n💰 Total: $${total}`
          );
        }
      );
      return;
    }

    // ---------------- ADMIN ----------------
    if (intent === "agregar") {
      admin = { autenticado: false, paso: "pedir_pass" };
      socket.emit("respuesta", "🔐 Ingrese la contraseña:");
      return;
    }

    if (admin.paso === "pedir_pass") {
      if (mensaje === "admin123") {
        admin = { autenticado: true, paso: "pedir_pelicula" };
        socket.emit("respuesta", "Ingrese: título, duración, descripción");
      } else {
        socket.emit("respuesta", "❌ Contraseña incorrecta.");
      }
      return;
    }

    if (admin.paso === "pedir_pelicula") {
      const partes = mensaje.split(",").map(p => p.trim());
      if (partes.length < 3)
        return socket.emit("respuesta", "Formato: título, duración, descripción");

      const [titulo, duracion, descripcion] = partes;

      db.query(
        "INSERT INTO peliculas (titulo, duracion, descripcion) VALUES (?, ?, ?)",
        [titulo, duracion, descripcion],
        err => {
          if (err) return socket.emit("respuesta", "❌ Error al guardar película.");

          admin = { autenticado: true, paso: "pedir_funcion" };
          socket.emit("respuesta", "Película agregada. Ahora ingrese: id_pelicula, horario, sala, precio");
        }
      );
      return;
    }

    if (admin.paso === "pedir_funcion") {
      const partes = mensaje.split(",").map(p => p.trim());
      if (partes.length < 4)
        return socket.emit("respuesta", "Formato: id_pelicula, horario, sala, precio");

      const [id, horario, sala, precio] = partes;

      db.query(
        "INSERT INTO funciones (id_pelicula, horario, sala, precio) VALUES (?, ?, ?, ?)",
        [id, horario, sala, precio],
        err => {
          if (err) return socket.emit("respuesta", "❌ Error al agregar función.");

          admin = { autenticado: false, paso: null };
          socket.emit("respuesta", "✅ Función agregada correctamente.");
        }
      );
      return;
    }

    // ---------------- NO ENTENDIDO / SIMILITUD ----------------
    db.query("SELECT titulo FROM peliculas", (err, rows) => {
      if (err) return socket.emit("respuesta", "No entendí. Preguntá por películas o reservas.");

      let mejor = null;
      let max = 0;

      rows.forEach(r => {
        const s = similitud(mensaje, r.titulo);
        if (s > max && s > 0.4) {
          mejor = r.titulo;
          max = s;
        }
      });

      if (!mejor) {
        socket.emit("respuesta", "🤔 No entendí. Podés preguntar por 'películas', 'horarios', 'precios' o 'reservar'.");
        return;
      }

      db.query(
        "SELECT p.titulo, f.horario, f.precio FROM peliculas p JOIN funciones f ON p.id=f.id_pelicula WHERE p.titulo=?",
        [mejor],
        (er2, info) => {
          if (er2 || info.length === 0)
            return socket.emit("respuesta", `🎬 ${mejor}. ¿Querés ver horarios o reservar?`);

          const d = info[0];
          socket.emit("respuesta",
            `🎬 ${d.titulo}\n🕓 ${d.horario}\n💰 $${d.precio}\n¿Querés reservar?`
          );
        }
      );
    });

  });
});

server.listen(3000, () => {
  console.log("🚀 Servidor Socket.IO en http://localhost:3000/");
});
