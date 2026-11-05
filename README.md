# 🥖 PadariaTech — Sistema de Gestão para Padarias

Aplicação web completa, moderna e responsiva para gerenciamento operacional de pequenas padarias e confeitarias, desenvolvida com foco em simplicidade, segurança e alta confiabilidade transacional.

---

## 🎯 Objetivo Educacional
Este projeto foi desenvolvido como prática profissional guiada para alunos do curso Técnico em Desenvolvimento de Sistemas, demonstrando a integração ponta a ponta entre:
- Desenvolvimento Web Moderno (Vanilla ES6+ e Vite)
- Banco de Dados Relacional e Segurança no PostgreSQL (Supabase)
- Row Level Security (RLS) e Transações Atômicas via RPC
- Integrações e Automações com ferramentas MCP (Model Context Protocol)
- Publicação Serverless e Edge na Vercel
- Versionamento e controle de releases no Git / GitHub

---

## 🚀 Tecnologias Utilizadas

### Frontend
- **HTML5 Semântico**: Estrutura acessível com formulários nativos.
- **CSS3 Moderno**: Paleta temática de padaria (creme, caramelo, marrom e dourado), Grid, Flexbox e total responsividade mobile/desktop.
- **JavaScript (ES6+) Modular**: Sem dependência de frameworks pesados, garantindo alta performance e facilidade de manutenção.
- **Vite**: Bundler ultrarrápido para desenvolvimento e build de produção.

### Backend & Banco de Dados (Supabase / PostgreSQL)
- **PostgreSQL 17**: Banco relacional robusto.
- **Supabase Auth**: Gerenciamento seguro de usuários com tokens JWT e sessões persistentes.
- **Supabase JavaScript SDK (`@supabase/supabase-js`)**: Comunicação segura via cliente oficial.
- **Row Level Security (RLS)**: Cada usuário autenticado gerencia exclusivamente seus próprios produtos e vendas.
- **Função RPC Transacional (`registrar_venda`)**:
  - Execução atômica com `SECURITY DEFINER` e `SET search_path = public`.
  - Bloqueio concorrente de linhas com `FOR UPDATE`.
  - Recálculo de preços no próprio PostgreSQL para evitar manipulação de valores no frontend.
  - Decremento automático de estoque.
  - Integridade referencial protegida (`ON DELETE RESTRICT` em produtos vinculados a vendas).

---

## 🏛️ Arquitetura do Sistema

```text
padariatech/
├── index.html                 # Ponto de entrada SPA (Single Page Application)
├── package.json               # Configurações e dependências do projeto
├── vite.config.js             # Configurações do Vite
├── .env.example               # Modelo de variáveis de ambiente
├── .gitignore                 # Exclusão de artefatos sensíveis e builds
├── README.md                  # Documentação completa
├── src/
│   ├── css/
│   │   └── style.css          # Identidade visual PadariaTech
│   └── js/
│       ├── supabaseClient.js  # Conexão com o Supabase utilizando publishable/anon key
│       ├── auth.js            # Login, cadastro, logout e listeners de sessão
│       ├── produtos.js        # CRUD de produtos e carga de catálogo inicial
│       ├── vendas.js          # Gestão de carrinho e chamada da RPC transacional
│       ├── dashboard.js       # Métricas de faturamento, estoque baixo e vendas
│       └── app.js             # Controlador de rotas, eventos e UI
└── supabase/
    └── migrations/
        └── 20261105000000_init_padariatech.sql # DDL completa, RLS e RPC
```

---

## 🗄️ Modelo de Dados

### Tabelas
1. **`produtos`**:
   - `id`: BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
   - `nome`: VARCHAR(120) NOT NULL
   - `categoria`: VARCHAR(60) NOT NULL
   - `preco`: NUMERIC(10,2) NOT NULL CHECK (preco > 0)
   - `estoque`: INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0)
   - `usuario_id`: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
   - `criado_em`: TIMESTAMPTZ NOT NULL DEFAULT now()

2. **`vendas`**:
   - `id`: BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
   - `data_venda`: TIMESTAMPTZ NOT NULL DEFAULT now()
   - `valor_total`: NUMERIC(10,2) NOT NULL CHECK (valor_total >= 0)
   - `usuario_id`: UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE

3. **`itens_venda`**:
   - `id`: BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
   - `venda_id`: BIGINT NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE
   - `produto_id`: BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT
   - `quantidade`: INTEGER NOT NULL CHECK (quantidade > 0)
   - `preco_unitario`: NUMERIC(10,2) NOT NULL CHECK (preco_unitario > 0)
   - `subtotal`: NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)

---

## 🔒 Segurança e Autenticação
- O frontend consome exclusivamente a **Publishable / Anon Key** do Supabase. A `service_role` ou quaisquer credenciais de administração **nunca** são expostas.
- O acesso direto de inserção/alteração de vendas no frontend é bloqueado via RLS; a criação ocorre estritamente pela função `registrar_venda()`.
- O isolamento multi-inquilino garante que nenhum usuário veja dados de outro usuário.

---

## 🛠️ Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js (v18+) e NPM instalados.
- Projeto configurado no [Supabase](https://supabase.com).

### Passo a Passo
1. Clone o repositório ou navegue até o diretório do projeto:
   ```bash
   cd padariatech
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente:
   Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
   Preencha com a URL do seu projeto e a chave publicável:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
   ```
4. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Abra o navegador no endereço indicado (geralmente `http://localhost:3000`).

---

## 📦 Como Gerar o Build de Produção
```bash
npm run build
```
Os arquivos otimizados e prontos para publicação serão gerados na pasta `dist/`.

---

## 🌐 Repositório e Links
- **Repositório GitHub**: [https://github.com/Renato428PE/padariatech](https://github.com/Renato428PE/padariatech)
- **Projeto Vercel**: `padariatech` (Team: `team_VNNBW7YFGTXLbUCsW9vpiZTj` / Renato Ramos)
- **Supabase Backend**: `fuxsasvwvqivdwyxyawh` (PostgreSQL 17, US East)

---

## 🏷️ Versão do Projeto
- **Versão**: `v1.0.0`
- **Tag**: `v1.0.0`
- **Status**: Produção estável, testada e versionada.
