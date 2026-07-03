-- =============================================
-- BuroBot — Schema aggiuntivo per Gestione Team
-- Esegui questo nel SQL Editor di Supabase
-- =============================================

-- 1. Aggiungi il campo team_owner_id ai profili per collegare i collaboratori al proprietario
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Crea la tabella per memorizzare gli inviti in attesa
CREATE TABLE IF NOT EXISTS public.team_invitations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    team_owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    email text NOT NULL,
    role text NOT NULL CHECK (role IN ('collaboratore', 'amministratore')),
    created_at timestamptz DEFAULT now(),
    UNIQUE(team_owner_id, email)
);
