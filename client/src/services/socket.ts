import { io } from "socket.io-client";
import { API } from "../config.js";

const token =
  localStorage.getItem("token") ||
  sessionStorage.getItem("token") ||
  "";

const socket = io(API.BASE_URL, {
  auth: { token },
  transports: ["websocket"],
});

socket.on("connect", () => {
  // ping inicial
  socket.emit("presence:ping");

  // ping contínuo
  const t = setInterval(() => socket.emit("presence:ping"), 25_000);
  (socket as any).__presenceTimer = t;
});

socket.on("disconnect", () => {
  const t = (socket as any).__presenceTimer;
  if (t) clearInterval(t);
});

export default socket;