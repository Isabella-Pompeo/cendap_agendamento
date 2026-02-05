# 🏥 Agendamento Virtual - Clínica Médica

Um sistema moderno e elegante para agendamento de consultas e exames, integrado diretamente com Google Sheets.

![Status do Projeto](https://img.shields.io/badge/Status-Finalizado-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js%20%7C%20React%20%7C%20Google%20Apps%20Script-blue?style=for-the-badge)

## ✨ Funcionalidades

### 📅 Agendamento Inteligente
- **Médicos e Especialidades:** Seleção intuitiva de profissionais e serviços.
- **Calendário Dinâmico:** Bloqueio automático de finais de semana e horários indisponíveis.
- **Tipos de Atendimento:** Diferenciação clara entre Consultas (Primeira vez) e Retornos.
- **Exames:** Agendamento de exames de imagem e laboratoriais com instruções específicas.

### 🔍 Busca de Agendamentos
- **Rastreamento pelo ID:** O paciente pode consultar o status do seu agendamento usando um código único.
- **Detalhes Completos:** Visualização de todos os dados: Médico, Data, Horário e Status (Pendente/Confirmado).
- **Avisos Importantes:** Exibição de alertas de preparo (ex: Jejum) direto na busca.

### ☁️ Integração com Google Sheets
- **Banco de Dados Gratuito:** Todos os dados são salvos automaticamente em uma planilha do Google.
- **Gestão Facilitada:** A clínica pode confirmar ou cancelar agendamentos apenas mudando o status na planilha.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** [Next.js](https://nextjs.org/), React, TypeScript.
- **Estilização:** CSS Modules (Design responsivo e moderno).
- **Backend (Serverless):** Google Apps Script (API para leitura e escrita na planilha).
- **Ícones:** SVG customizados.

---

## 🚀 Como Rodar o Projeto

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/gaab01/agendamentovirtual.git
    cd agendamentovirtual
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Rode o servidor local:**
    ```bash
    npm run dev
    ```

4.  **Acesse:** `http://localhost:3000`

---

## 📝 Estrutura da Planilha (Google Sheets)

O sistema espera uma planilha com as seguintes colunas (Ordem A-K):

| Coluna | Descrição |
| :--- | :--- |
| **A** | ID do Agendamento (Gerado automaticamente) |
| **B** | Data de Criação |
| **C** | Nome do Paciente |
| **D** | Telefone |
| **E** | Médico |
| **F** | Especialidade |
| **G** | Data da Consulta |
| **H** | Horário |
| **I** | Tipo (Consulta/Exame) |
| **J** | Status (Pendente/Confirmado) |
| **K** | Info Adicional (Avisos/Preparo) |

---

Desenvolvido com 💙 para facilitar a gestão de clínicas.
