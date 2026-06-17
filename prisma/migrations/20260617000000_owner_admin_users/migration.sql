-- Etapa 17: campos de controle do admin principal e autoria de usuários.
-- Migration aditiva, sem apagar dados.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isOwnerAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_createdById_fkey'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
