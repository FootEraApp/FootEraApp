import { io } from "socket.io-client";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

const socket = io(API.BASE_URL, {
  auth: { token: Storage.token || localStorage.getItem("token") },
  transports: ["websocket"],
});

export default socket;