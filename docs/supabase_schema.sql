-- =============================================
-- BuroBot — Supabase Database Schema
-- Esegui questo nel SQL Editor di Supabase
-- =============================================

-- Abilita pgvector per RAG (se usi Supabase vector store)
create extension if not exists vector;

-- =============================================
-- TABELLA: profiles (estende auth.users)
-- =============================================
create table public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    full_name text,
    plan text not null default 'free' check (plan in ('free', 'base', 'pmi', 'studio')),
    stripe_customer_id text unique,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Crea profilo automaticamente quando un utente si registra
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, full_name)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name'
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- =============================================
-- TABELLA: documents
-- =============================================
create table public.documents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    file_name text,
    document_type text default 'generico',
    original_text text,
    analysis jsonb,  -- { tipo_documento, spiegazione, scadenza, importo, azioni, urgenza }
    created_at timestamptz default now()
);

-- =============================================
-- TABELLA: response_letters (lettere generate)
-- =============================================
create table public.response_letters (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    response_type text default 'contestazione',
    letter_text text not null,
    created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Abilita RLS su tutte le tabelle
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.response_letters enable row level security;

-- Policies: ogni utente vede solo i propri dati
create policy "Users can view own profile"
    on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles for update using (auth.uid() = id);

create policy "Users can view own documents"
    on public.documents for select using (auth.uid() = user_id);

create policy "Users can insert own documents"
    on public.documents for insert with check (auth.uid() = user_id);

create policy "Users can delete own documents"
    on public.documents for delete using (auth.uid() = user_id);

create policy "Users can view own letters"
    on public.response_letters for select using (auth.uid() = user_id);

create policy "Users can insert own letters"
    on public.response_letters for insert with check (auth.uid() = user_id);

-- =============================================
-- INDICI per performance
-- =============================================
create index idx_documents_user_id on public.documents(user_id);
create index idx_documents_created_at on public.documents(created_at desc);
create index idx_documents_user_month on public.documents(user_id, created_at);
create index idx_letters_document_id on public.response_letters(document_id);

-- =============================================
-- STORAGE BUCKET per i file caricati
-- =============================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

create policy "Users can upload own documents"
    on storage.objects for insert
    with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own documents"
    on storage.objects for select
    using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
