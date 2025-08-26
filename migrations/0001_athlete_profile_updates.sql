ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "gender" text DEFAULT 'male' NOT NULL;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "videos" text[] DEFAULT '{}';
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "achievements" text[] DEFAULT '{}';
ALTER TABLE "athletes" ADD COLUMN IF NOT EXISTS "football_type" text DEFAULT 'field' NOT NULL;

-- Renomear a coluna video_url para manter compatibilidade
ALTER TABLE "athletes" RENAME COLUMN "video_url" TO "video";