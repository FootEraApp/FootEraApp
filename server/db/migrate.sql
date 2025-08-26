
-- Criar tabela de usuários primeiro
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  profile_type TEXT NOT NULL DEFAULT 'athlete',
  avatar TEXT,
  verified BOOLEAN DEFAULT false,
  age INTEGER,
  position TEXT,
  team TEXT,
  age_group TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de escolas
CREATE TABLE IF NOT EXISTS schools (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  foundation_year INTEGER,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  age_groups TEXT[],
  description TEXT,
  infrastructure TEXT[]
);

-- Criar tabela de atletas
CREATE TABLE IF NOT EXISTS athletes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  age INTEGER,
  birthdate TIMESTAMP,
  gender TEXT NOT NULL DEFAULT 'male',
  position TEXT,
  height INTEGER,
  weight INTEGER,
  city TEXT,
  state TEXT,
  phone TEXT,
  is_independent BOOLEAN DEFAULT false,
  school_id INTEGER REFERENCES schools(id),
  school_approved BOOLEAN DEFAULT false,
  bio TEXT,
  age_group TEXT,
  videos TEXT[],
  achievements TEXT[],
  football_type TEXT NOT NULL DEFAULT 'field'
);

-- Criar tabela de clubes
CREATE TABLE IF NOT EXISTS clubs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  foundation_year INTEGER,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT,
  phone TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  description TEXT,
  division TEXT
);

-- Criar tabela de solicitações de vínculo
CREATE TABLE IF NOT EXISTS school_athlete_requests (
  id SERIAL PRIMARY KEY,
  athlete_id INTEGER NOT NULL REFERENCES athletes(id),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  status TEXT NOT NULL,
  requested_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Criar tabela de seguidores
CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id),
  followed_id INTEGER NOT NULL REFERENCES users(id),
  followed_at TIMESTAMP DEFAULT NOW()
);
