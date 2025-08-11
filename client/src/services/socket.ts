import { io } from "socket.io-client";
import { API } from "../config";
import Storage from "../../../server/utils/storage";

const token = Storage.token; 

const socket = io(API.BASE_URL, {
  auth: { token },
  autoConnect: false,
  transports: ["websocket"], 
});

export default socket;