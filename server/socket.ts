import { Server } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { podeVerPresenca } from "./utils/privacy.js";

let io: Server;

const ONLINE_TTL_MS = 45_000; 

async function touchSeen(userId: string, extra?: { login?: boolean; logout?: boolean }) {
  const data: any = { lastSeenAt: new Date() };
  if (extra?.login) data.lastLoginAt = new Date();
  if (extra?.logout) data.lastLogoutAt = new Date();

  try {
    await prisma.usuario.update({ where: { id: userId }, data });
  } catch (e) {
    console.error("[SOCKET] touchSeen failed", userId, e);
  }
}

export function setupSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: [
      "http://localhost",
      "https://localhost",
      "http://localhost:5173",
      "http://10.0.2.2:5173",
      "https://footera.app.br",
      "https://www.footera.app.br",
    ],
    credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        (socket.handshake.query as any)?.token;

      if (!token) return next(new Error("NO_TOKEN"));

      const payload = jwt.verify(String(token), process.env.JWT_SECRET!) as any;
      const userId = String(payload?.id || payload?.userId || "").trim();
      if (!userId) return next(new Error("NO_USER"));

      (socket.data as any).userId = userId;
      return next();
    } catch (e) {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    const userId = String((socket.data as any)?.userId || "");
    if (userId) {
      socket.join(`u:${userId}`);
      void touchSeen(userId);
    }

    socket.on("presence:ping", async () => {
      const uid = String((socket.data as any)?.userId || "");
      if (!uid) return;

      await touchSeen(uid);
    });

    socket.on(
      "presence:status",
      async (
        ids: string[],
        cb?: (resp: any) => void
      ) => {
        try {
          const viewerId = String(
            (socket.data as any)
              ?.userId || ""
          );

          if (!viewerId) {
            return cb?.({
              items: [],
            });
          }

          const uniq =
            Array.from(
              new Set(
                (ids || [])
                  .map(String)
                  .filter(Boolean)
              )
            ).slice(0, 200);

          if (!uniq.length) {
            return cb?.({
              items: [],
            });
          }

          const rows =
            await prisma.usuario
              .findMany({
                where: {
                  id: {
                    in: uniq,
                  },
                },

                select: {
                  id: true,
                  lastSeenAt: true,
                  lastLogoutAt: true,
                },
              });

          const now =
            Date.now();

          const items =
            await Promise.all(
              rows.map(
                async (u) => {
                  const permitido =
                    await podeVerPresenca(
                      viewerId,
                      u.id
                    );

                  if (!permitido) {
                    return {
                      userId: u.id,
                      online: false,
                      lastSeenAt:
                        null,
                      lastLogoutAt:
                        null,
                      hidden: true,
                    };
                  }

                  const lastSeenMs =
                    u.lastSeenAt
                      ? new Date(
                          u.lastSeenAt
                        ).getTime()
                      : 0;

                  const online =
                    !!lastSeenMs &&
                    now -
                      lastSeenMs <=
                      ONLINE_TTL_MS;

                  return {
                    userId: u.id,
                    online,

                    lastSeenAt:
                      u.lastSeenAt,

                    lastLogoutAt:
                      u.lastLogoutAt,

                    hidden: false,
                  };
                }
              )
            );

          cb?.({
            items,
          });
        } catch (e) {
          console.error(
            "[SOCKET] presence:status",
            e
          );

          cb?.({
            items: [],
            error:
              "STATUS_FAILED",
          });
        }
      }
    );

    socket.on("join", (usuarioId: string) => {
      if (usuarioId) socket.join(`u:${usuarioId}`);
    });

    socket.on("joinGroup", (grupoId: string) => {
      if (grupoId) socket.join(`g:${grupoId}`);
    });

    socket.on("leaveGroup", (grupoId: string) => {
      if (grupoId) socket.leave(`g:${grupoId}`);
    });

    socket.on("sendGroupMessage", (mensagem) => {
      io.to(`g:${mensagem.grupoId}`).emit("novaMensagemGrupo", mensagem);
    });

    socket.on(
      "disconnect",
      () => {
        const uid = String(
          (socket.data as any)
            ?.userId || ""
        );

        if (!uid) return;

        setTimeout(
          async () => {
            try {
              const room =
                io.sockets
                  .adapter
                  .rooms
                  .get(
                    `u:${uid}`
                  );

              const aindaConectado =
                !!room &&
                room.size > 0;

              if (
                aindaConectado
              ) {
                return;
              }

              await touchSeen(
                uid,
                {
                  logout: true,
                }
              );
            } catch (e) {
              console.error(
                "[SOCKET] disconnect presence:",
                e
              );
            }
          },
          1500
        );
      }
    );
  });

  return io;
}

export function getIO() {
  return io;
}

export function emitToUser(userId: string, event: string, payload: any) {
  if (io) io.to(`u:${userId}`).emit(event, payload);
}

export function emitToUsers(userIds: string[], event: string, payload: any) {
  if (!io || !userIds?.length) return;
  io.to(userIds.map((id) => `u:${id}`)).emit(event, payload);
}