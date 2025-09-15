import { Server } from "socket.io";
import http from "http";

let io: Server; 

export function setupSocket(server: http.Server) {
  io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    
    socket.on("join", (usuarioId: string) => {
      socket.join(usuarioId);
    });

    socket.on("joinGroup", (grupoId: string) => {
      socket.join(grupoId);
    });

    socket.on("sendMessage", (mensagem) => {
      io.to(mensagem.paraId).emit("novaMensagem", mensagem);
      io.to(mensagem.deId).emit("novaMensagem", mensagem);
    });

    socket.on("sendGroupMessage", (mensagem) => {
      io.to(mensagem.grupoId).emit("novaMensagemGrupo", mensagem);
    });

    socket.on("disconnect", () => {
    });
  });

  return io;
}

export function getIO() {
  return io;
}