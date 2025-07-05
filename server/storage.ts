import { db } from "./db"; // assume que usa drizzle
import { users } from "@shared/schema"; // tabela users
import { eq } from "drizzle-orm";

export const storage = {
  getUserByUsername: async (username: string) => {
    return db.query.users.findFirst({ where: eq(users.username, username) });
  },

  getUser: async (id: number) => {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  },

  createUser: async (data: any) => {
    return db.insert(users).values(data).returning().then(r => r[0]);
  },

  updateUser: async (id: number, data: any) => {
    return db.update(users).set(data).where(eq(users.id, id)).returning().then(r => r[0]);
  }
};
