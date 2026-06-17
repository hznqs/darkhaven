-- Etapa 11: campos de perfil do cliente. Migration aditiva, sem apagar dados.
ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "state" TEXT,
ADD COLUMN IF NOT EXISTS "notes" TEXT;
