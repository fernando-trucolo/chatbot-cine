<script setup>
import { ref, onMounted } from 'vue';
import { io } from 'socket.io-client';

const socket = io("http://localhost:3000");

const mensajeUsuario = ref('');
const mensajes = ref([]);


onMounted(() => {
  socket.on("respuesta", (texto) => {
    mensajes.value.push({ de: 'bot', texto });
  });
});

function enviarMensaje() {
  if (mensajeUsuario.value.trim() === '') return;


  mensajes.value.push({ de: 'usuario', texto: mensajeUsuario.value });


  socket.emit("mensaje", mensajeUsuario.value);

  mensajeUsuario.value = '';
}
</script>

<template>
  <div class="chat-container">
    <h1>🎬 Chatbot del Cine</h1>
    
    <div class="chat-box">
      <div 
        v-for="(m, index) in mensajes" 
        :key="index" 
        :class="['mensaje', m.de]"
      >
        <strong v-if="m.de === 'usuario'">Tú:</strong>
        <strong v-else>Bot:</strong>
        {{ m.texto }}
      </div>
    </div>

    <div class="input-area">
      <input 
        v-model="mensajeUsuario" 
        placeholder="Escribe tu mensaje..." 
        @keyup.enter="enviarMensaje"
      />
      <button @click="enviarMensaje">Enviar</button>
    </div>
  </div>
</template>

<style>
.chat-container {
  width: 400px;
  margin: 30px auto;
  border: 2px solid #aaa;
  border-radius: 10px;
  padding: 15px;
  font-family: Arial;
}

.chat-box {
  height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  margin-bottom: 10px;
  padding: 5px;
  background-color: #f9f9f9;
}

.mensaje {
  margin: 5px 0;
}

.mensaje.usuario {
  text-align: right;
  color: blue;
}

.mensaje.bot {
  text-align: left;
 color: green;
}

.input-area {
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  padding: 5px;
}

button {
  padding: 5px 10px;
  cursor: pointer;
}
</style>
