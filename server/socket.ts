import { Server } from "socket.io";
import http from "http";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";
import { podeVerPresenca } from "./utils/privacy.js";
import {
  getActiveContext,
} from "./services/activeContext.js";

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

  io.use(
    async (
      socket,
      next
    ) => {
      try {
        const token =
          (
            socket.handshake
              .auth as any
          )?.token ||
          (
            socket.handshake
              .query as any
          )?.token;

        if (!token) {
          return next(
            new Error(
              "NO_TOKEN"
            )
          );
        }

        const secret =
          process.env
            .JWT_SECRET;

        if (!secret) {
          console.error(
            "[SOCKET] JWT_SECRET não configurado."
          );

          return next(
            new Error(
              "SERVER_AUTH_ERROR"
            )
          );
        }

        const payload =
          jwt.verify(
            String(token),
            secret
          ) as any;

        const userId =
          String(
            payload?.id ??
            payload?.sub ??
            payload?.userId ??
            ""
          ).trim();

        if (!userId) {
          return next(
            new Error(
              "NO_USER"
            )
          );
        }

        const usuario =
          await prisma.usuario.findUnique({
            where: {
              id:
                userId,
            },

            select: {
              id:
                true,

              tokenVersion:
                true,

              verified:
                true,

              deletedAt:
                true,

              status:
                true,

              blockedAt:
                true,
            },
          });

        if (!usuario) {
          return next(
            new Error(
              "USER_NOT_FOUND"
            )
          );
        }

        if (
          usuario.deletedAt
        ) {
          return next(
            new Error(
              "ACCOUNT_DELETED"
            )
          );
        }

        const status =
          String(
            usuario.status ??
            ""
          ).toUpperCase();

        if (
          status ===
            "BLOQUEADO" ||
          usuario.blockedAt
        ) {
          return next(
            new Error(
              "ACCOUNT_BLOCKED"
            )
          );
        }

        if (
          !usuario.verified
        ) {
          return next(
            new Error(
              "EMAIL_NOT_VERIFIED"
            )
          );
        }

        const tokenVersion =
          Number(
            payload
              ?.tokenVersion ??
            0
          );

        const dbTokenVersion =
          Number(
            usuario
              .tokenVersion ??
            0
          );

        if (
          tokenVersion !==
          dbTokenVersion
        ) {
          return next(
            new Error(
              "TOKEN_VERSION_MISMATCH"
            )
          );
        }

        const activeContext =
          await getActiveContext(
            userId
          );

        if (!activeContext) {
          return next(
            new Error(
              "ACTIVE_CONTEXT_REQUIRED"
            )
          );
        }

        socket.data.userId =
          userId;

        socket.data.activeContext =
          activeContext;

        socket.data.activeContextKey =
          activeContext.key;

        socket.data.activeContextKind =
          activeContext.kind;

        socket.data.activeRole =
          activeContext.role ??
          activeContext.tipoUsuario ??
          null;

        socket.data.profileId =
          activeContext.profileId ??
          activeContext.tipoUsuarioId ??
          null;

        socket.data.organizationId =
          activeContext.organizationId ??
          null;

        socket.data.organizationType =
          activeContext.organizationType ??
          null;

        socket.data.organizationRole =
          activeContext.organizationRole ??
          null;

        socket.data
          .legacyOrganizationId =
          activeContext
            .legacyOrganizationId ??
          null;

        return next();
      } catch (error: any) {
        console.error(
          "[SOCKET] autenticação recusada:",
          error?.message ??
            error
        );

        if (
          error?.name ===
            "TokenExpiredError"
        ) {
          return next(
            new Error(
              "TOKEN_EXPIRED"
            )
          );
        }

        if (
          error?.name ===
            "JsonWebTokenError"
        ) {
          return next(
            new Error(
              "INVALID_TOKEN"
            )
          );
        }

        return next(
          new Error(
            "SOCKET_AUTH_FAILED"
          )
        );
      }
    }
  );

  io.on(
    "connection",
    (
      socket
    ) => {
      const userId =
        String(
          socket.data
            ?.userId ??
          ""
        ).trim();

      const activeContextKey =
        String(
          socket.data
            ?.activeContextKey ??
          ""
        ).trim();

      const activeContextKind =
        String(
          socket.data
            ?.activeContextKind ??
          ""
        ).trim();

      const organizationId =
        String(
          socket.data
            ?.organizationId ??
          ""
        ).trim();

      if (userId) {
        socket.join(
          `u:${userId}`
        );

        void touchSeen(
          userId
        );
      }

      if (activeContextKey) {
        socket.join(
          `ctx:${activeContextKey}`
        );
      }

      if (
        activeContextKind ===
          "ORGANIZATION" &&
        organizationId
      ) {
        socket.join(
          `org:${organizationId}`
        );
      }

    socket.on(
      "context:sync",
      async (
        cb?: (
          resp: any
        ) => void
      ) => {
        try {
          const uid =
            String(
              socket.data
                ?.userId ??
              ""
            ).trim();

          if (!uid) {
            return cb?.({
              ok: false,
              error:
                "NO_USER",
            });
          }

          /*
          * Sempre resolve o contexto
          * atual novamente no servidor.
          *
          * Não confiamos em contexto
          * enviado pelo cliente.
          */
          const nextContext =
            await getActiveContext(
              uid
            );

          if (!nextContext) {
            return cb?.({
              ok: false,
              error:
                "ACTIVE_CONTEXT_REQUIRED",
            });
          }

          /*
          * Busca TODOS os sockets
          * conectados dessa conta.
          *
          * Isso cobre:
          * - outra aba
          * - outra janela
          * - outro dispositivo
          */
          const socketsDoUsuario =
            await io
              .in(
                `u:${uid}`
              )
              .fetchSockets();

          for (
            const targetSocket of
              socketsDoUsuario
          ) {
            /*
            * Remove somente as salas
            * de contexto antigas.
            *
            * NÃO remove:
            * - u:<usuarioId>
            * - g:<grupoId>
            * - sala própria do socket
            */
            for (
              const room of
                Array.from(
                  targetSocket.rooms
                )
            ) {
              if (
                typeof room ===
                  "string" &&
                (
                  room.startsWith(
                    "ctx:"
                  ) ||
                  room.startsWith(
                    "org:"
                  )
                )
              ) {
                await targetSocket.leave(
                  room
                );
              }
            }

            /*
            * Atualiza o snapshot
            * operacional do socket.
            */
            targetSocket.data
              .activeContext =
              nextContext;

            targetSocket.data
              .activeContextKey =
              nextContext.key;

            targetSocket.data
              .activeContextKind =
              nextContext.kind;

            targetSocket.data
              .activeRole =
              nextContext.role ??
              nextContext
                .tipoUsuario ??
              null;

            targetSocket.data
              .profileId =
              nextContext
                .profileId ??
              nextContext
                .tipoUsuarioId ??
              null;

            targetSocket.data
              .organizationId =
              nextContext
                .organizationId ??
              null;

            targetSocket.data
              .organizationType =
              nextContext
                .organizationType ??
              null;

            targetSocket.data
              .organizationRole =
              nextContext
                .organizationRole ??
              null;

            targetSocket.data
              .legacyOrganizationId =
              nextContext
                .legacyOrganizationId ??
              null;

            /*
            * Entra na nova sala
            * contextual.
            */
            await targetSocket.join(
              `ctx:${nextContext.key}`
            );

            if (
              nextContext.kind ===
                "ORGANIZATION" &&
              nextContext.organizationId
            ) {
              await targetSocket.join(
                `org:${nextContext.organizationId}`
              );
            }

            /*
            * Opcional, mas útil:
            * avisa cada aba/socket que
            * o contexto foi atualizado.
            */
            targetSocket.emit(
              "context:synced",
              {
                activeContextKey:
                  nextContext.key,

                activeContextKind:
                  nextContext.kind,

                organizationId:
                  nextContext
                    .organizationId ??
                  null,
              }
            );
          }

          return cb?.({
            ok: true,

            activeContextKey:
              nextContext.key,

            activeContextKind:
              nextContext.kind,

            organizationId:
              nextContext
                .organizationId ??
              null,

            socketsSincronizados:
              socketsDoUsuario.length,
          });
        } catch (error) {
          console.error(
            "[SOCKET] context:sync:",
            error
          );

          return cb?.({
            ok: false,
            error:
              "CONTEXT_SYNC_FAILED",
          });
        }
      }
    );

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

    socket.on(
      "join",
      () => {
        const uid =
          String(
            (socket.data as any)
              ?.userId || ""
          );

        if (!uid) return;

        socket.join(
          `u:${uid}`
        );
      }
    );

    socket.on(
      "joinGroup",
      async (
        grupoId:
          string
      ) => {
        try {
          const uid =
            String(
              (
                socket.data as any
              )?.userId ??
              ""
            ).trim();

          const gid =
            String(
              grupoId ??
              ""
            ).trim();

          if (
            !uid ||
            !gid
          ) {
            return;
          }

          const membro =
            await prisma
              .membroGrupo
              .findUnique({
                where: {
                  grupoId_usuarioId: {
                    grupoId:
                      gid,

                    usuarioId:
                      uid,
                  },
                },

                select: {
                  usuarioId:
                    true,
                },
              });

          if (!membro) {
            console.warn(
              "[SOCKET] joinGroup negado",
              {
                userId:
                  uid,

                grupoId:
                  gid,
              }
            );

            return;
          }

          socket.join(
            `g:${gid}`
          );
        } catch (error) {
          console.error(
            "[SOCKET] joinGroup:",
            error
          );
        }
      }
    );

    socket.on("leaveGroup", (grupoId: string) => {
      if (grupoId) socket.leave(`g:${grupoId}`);
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