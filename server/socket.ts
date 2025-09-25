import { Server } from "socket.io";
import http from "http";

let io: Server;

export function setupSocket(server: http.Server) {
  io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    socket.on("join", (usuarioId: string) => {
      if (!usuarioId) return;
      socket.join(`u:${usuarioId}`);
    });

    socket.on("joinGroup", (grupoId: string) => {
      if (!grupoId) return;
      socket.join(`g:${grupoId}`);
    });

    socket.on("leaveGroup", (grupoId: string) => {
      if (!grupoId) return;
      socket.leave(`g:${grupoId}`);
    });

    socket.on("sendMessage", (mensagem) => {
      io.to(`u:${mensagem.paraId}`).emit("novaMensagem", mensagem);
      io.to(`u:${mensagem.deId}`).emit("novaMensagem", mensagem);
    });
    socket.on("sendGroupMessage", (mensagem) => {
      io.to(`g:${mensagem.grupoId}`).emit("novaMensagemGrupo", mensagem);
    });
  });

  return io;
}

export function getIO() { return io; }