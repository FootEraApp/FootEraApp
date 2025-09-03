import axios from "axios";
import { API } from "@/config.js";
import { readToken } from "@/utils/auth.js";

const api = axios.create({ baseURL: API.BASE_URL });

api.interceptors.request.use((config) => {
  const t = readToken();
  if (t) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${t}` } as any;
  }
  return config;
});

export default api;