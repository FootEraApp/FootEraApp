// @ts-nocheck
import { db } from "./db";
import { users, type InsertUser, type SelectUser } from "../shared/schema"; 
import { eq } from "drizzle-orm";

export const storage = {
  getUserByUsername: (username: string) => {
    return db.query.users.findFirst({ where: eq(users.username, username) });
  },

  getUser: (id: number) => {
    return db.query.users.findFirst({ where: eq(users.id, id) });
  },

  createUser: async (data: InsertUser): Promise<SelectUser | undefined> => {
    const [row] = await db.insert(users).values(data).returning();
    return row;
  },

  updateUser: async (id: number, data: Partial<InsertUser>): Promise<SelectUser | undefined> => {
    const [row] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return row;
  }
};