import { io } from "socket.io-client";
import { API } from "../config.js";
import Storage from "../../../server/utils/storage.js";

const token = Storage.token; 

const socket = io(API.BASE_URL, {
  auth: { token },
  autoConnect: false,
  transports: ["websocket"], 
});

export default socket;