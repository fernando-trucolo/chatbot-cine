<script setup>
import { ref } from 'vue';
import axios from 'axios';

const apiUrl = 'http://localhost:3000/api/chat';
const mensajeUsuario = ref('');
const mensajes = ref([]);

async function enviarMensaje() {
  if (mensajeUsuario.value.trim() === '') return;

  // Agregar mensaje del usuario
  mensajes.value.push({ de: 'usuario', texto: mensajeUsuario.value });

  try {
    const respuesta = await axios.post(apiUrl, { mensaje: mensajeUsuario.value });
    mensajes.value.push({ de: 'bot', texto: respuesta.data.respuesta });
  } catch (error) {
    mensajes.value.push({ de: 'bot', texto: 'Error al comunicarse con el servidor.' });
  }

  mensajeUsuario.value = '';
}
</script>

<template>
  <div class="chat-container">
    <h1>🎬 Chatbot del Cine</h1>
    
    <div class="chat-box">
      <div v-for="(m, index) in mensajes" :key="index" :class="['mensaje', m.de]">
        <strong v-if="m.de === 'usuario'">Tú:</strong>
        <strong v-else>Bot:</strong>
        {{ m.texto }}
      </div>
    </div>

    <div class="input-area">
      <input v-model="mensajeUsuario" placeholder="Escribe tu mensaje..." @keyup.enter="enviarMensaje" />
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
