import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", 
    },
  });

  io.on("connection", (socket) => {
    console.log("Novo cliente conectado", socket.id);

    socket.on("join", (userId: string) => {
      socket.join(userId); 
      console.log(`Usuário ${userId} entrou na sua sala`);
    });

    socket.on("sendMessage", (data) => {
      console.log("Mensagem recebida no servidor:", data);
      const { paraId, conteudo, deId } = data;
      io.to(paraId).emit("novaMensagem", {   
        conteudo,
        deId,
        paraId,
        criadaEm: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("Cliente desconectado", socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io não inicializado!");
  }
  return io;
};