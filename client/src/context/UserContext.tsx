import { createContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: number;
  name: string;
  username: string;
  age?: number;
  position?: string;
  team?: string;
  avatar?: string;
}

export interface Score {
  total: number;
  performance: number;
  discipline: number;
  responsibility: number;
}

interface UserContextType {
  user: User | null;
  score: Score | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);
