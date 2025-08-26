import { Server } from "socket.io";
import http from "http";

export function setupSocket(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: "*", 
    },
  });

  io.on("connection", (socket) => {
    console.log("Novo cliente conectado:", socket.id);

    socket.on("join", (usuarioId: string) => {
      socket.join(usuarioId);
      console.log(`Usuário ${usuarioId} entrou na sala privada dele`);
    });

    socket.on("joinGroup", (grupoId: string) => {
      socket.join(grupoId);
      console.log(`Socket ${socket.id} entrou no grupo ${grupoId}`);
    });

    socket.on("sendMessage", (mensagem) => {
      io.to(mensagem.paraId).emit("novaMensagem", mensagem);
      io.to(mensagem.deId).emit("novaMensagem", mensagem);
    });

    socket.on("sendGroupMessage", (mensagem) => {
      io.to(mensagem.grupoId).emit("novaMensagemGrupo", mensagem);
    });

    socket.on("disconnect", () => {
      console.log("Cliente desconectado:", socket.id);
    });
  });

  return io;
}