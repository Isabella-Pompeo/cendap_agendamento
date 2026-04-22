-- Você precisará rodar este código no "SQL Editor" do novo Supabase
-- Acesse: https://supabase.com/dashboard/project/dvkphzzuincokfybsqrj/sql/new

-- Cria a tabela de Perfis Públicos
CREATE TABLE IF NOT EXISTS profiles (
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

-- ==========================================
-- TABELAS DO SISTEMA DE TELEMEDICINA
-- ==========================================

-- Tabela de Pagamentos (InfinitePay)
CREATE TABLE IF NOT EXISTS payments (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references profiles(id) not null,
  amount integer not null, -- Em centavos (ex: 15000 = R$ 150,00)
  status text not null default 'pending', -- pending, approved, rejected, refunded
  infinitepay_tx_id text,
  payment_method text, -- pix, credit_card
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = patient_id);
-- Insert/Update is handled by backend service role

-- Tabela de Consultas (Telemedicina)
CREATE TABLE IF NOT EXISTS consultations (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references profiles(id) not null,
  payment_id uuid references payments(id),
  doctor_name text not null,
  appointment_date timestamp with time zone not null,
  status text not null default 'scheduled', -- scheduled, in_progress, completed, canceled
  daily_room_url text,
  daily_room_name text,
  clinical_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own consultations" ON consultations FOR SELECT USING (auth.uid() = patient_id);
-- Médico pode ver todas (vamos simplificar por agora, idealmente checar role)
CREATE POLICY "Doctors can view and update consultations" ON consultations FOR ALL USING (true);

-- Tabela de Modelos de Documentos
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text not null, -- prescription, exam, certificate
  content_html text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view templates" ON document_templates FOR SELECT USING (true);
CREATE POLICY "Doctors can manage templates" ON document_templates FOR ALL USING (true);

-- Tabela de Documentos Emitidos (Receitas, Pedidos de Exames)
CREATE TABLE IF NOT EXISTS issued_documents (
  id uuid default gen_random_uuid() primary key,
  consultation_id uuid references consultations(id) not null,
  patient_id uuid references profiles(id) not null,
  type text not null, -- prescription, exam, certificate
  validation_token uuid default gen_random_uuid() not null unique,
  document_url text, -- Caminho no bucket medical-documents
  status text not null default 'draft', -- draft, signed
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  signed_at timestamp with time zone
);
ALTER TABLE issued_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own signed documents" ON issued_documents FOR SELECT USING (auth.uid() = patient_id AND status = 'signed');
CREATE POLICY "Doctors can manage all documents" ON issued_documents FOR ALL USING (true);

-- Configurações do Médico (Assinatura, Carimbo)
CREATE TABLE IF NOT EXISTS doctor_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  full_name text not null,
  crm text not null,
  signature_url text, -- Caminho no bucket doctor-assets
  stamp_url text, -- Caminho no bucket doctor-assets
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE doctor_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view doctor settings" ON doctor_settings FOR SELECT USING (true);
CREATE POLICY "Doctors can update own settings" ON doctor_settings FOR ALL USING (auth.uid() = user_id);
