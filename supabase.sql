-- Você precisará rodar este código no "SQL Editor" do novo Supabase
-- Acesse: https://supabase.com/dashboard/project/dvkphzzuincokfybsqrj/sql/new

-- Cria a tabela de Perfis Públicos
CREATE TABLE profiles (
  id uuid references auth.users on delete cascade not null primary key,
  cpf text unique not null,
  full_name text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativa RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política: Usuário público pode ver (necessário se for exibir nome)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- Política: Usuário só pode inserir seu próprio perfil (no signup)
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Política: Usuário só pode atualizar seu próprio perfil
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
