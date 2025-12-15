// server/socket
import { Server } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";

let io: Server;

export function setupSocket(server: http.Server) {

  io = new Server(server, {
    cors: {
      origin: ["https://footera.app.br", "https://www.footera.app.br"],
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;
      if (token) {
        const payload = jwt.verify(String(token), process.env.JWT_SECRET!) as any;
        const userId = payload?.id || payload?.userId;
        if (userId) socket.join(`u:${userId}`);
      }
    } catch {}

    socket.on("join", (usuarioId: string) => {
      if (usuarioId) socket.join(`u:${usuarioId}`);
    });

    socket.on("joinGroup", (grupoId: string) => {
      if (grupoId) socket.join(`g:${grupoId}`);
    });

    socket.on("leaveGroup", (grupoId: string) => {
      if (grupoId) socket.leave(`g:${grupoId}`);
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
export function emitToUser(userId: string, event: string, payload: any) {
  if (io) io.to(`u:${userId}`).emit(event, payload);
}
export function emitToUsers(userIds: string[], event: string, payload: any) {
  if (!io || !userIds?.length) return;
  io.to(userIds.map(id => `u:${id}`)).emit(event, payload);
}