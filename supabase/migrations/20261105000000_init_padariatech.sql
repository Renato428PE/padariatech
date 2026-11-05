-- Migração Inicial PadariaTech
-- Criação de tabelas, índices, RLS e RPC

-- 1. TABELA PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    categoria VARCHAR(60) NOT NULL,
    preco NUMERIC(10,2) NOT NULL CHECK (preco > 0),
    estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABELA VENDAS
CREATE TABLE IF NOT EXISTS public.vendas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data_venda TIMESTAMPTZ NOT NULL DEFAULT now(),
    valor_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (valor_total >= 0),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. TABELA ITENS_VENDA
CREATE TABLE IF NOT EXISTS public.itens_venda (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    venda_id BIGINT NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    produto_id BIGINT NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- ÍNDICES DE PERFORMANCE E INTEGRIDADE
CREATE INDEX IF NOT EXISTS idx_produtos_usuario ON public.produtos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_vendas_usuario ON public.vendas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_itens_venda_venda ON public.itens_venda(venda_id);
CREATE INDEX IF NOT EXISTS idx_itens_venda_produto ON public.itens_venda(produto_id);

-- RLS (ROW LEVEL SECURITY)
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS: PRODUTOS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'produtos' AND policyname = 'Usuarios gerenciam seus proprios produtos'
    ) THEN
        CREATE POLICY "Usuarios gerenciam seus proprios produtos"
        ON public.produtos FOR ALL
        TO authenticated
        USING (auth.uid() = usuario_id)
        WITH CHECK (auth.uid() = usuario_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vendas' AND policyname = 'Usuarios visualizam suas proprias vendas'
    ) THEN
        CREATE POLICY "Usuarios visualizam suas proprias vendas"
        ON public.vendas FOR SELECT
        TO authenticated
        USING (auth.uid() = usuario_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'itens_venda' AND policyname = 'Usuarios visualizam itens de suas vendas'
    ) THEN
        CREATE POLICY "Usuarios visualizam itens de suas vendas"
        ON public.itens_venda FOR SELECT
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.vendas v
                WHERE v.id = itens_venda.venda_id
                AND v.usuario_id = auth.uid()
            )
        );
    END IF;
END $$;

-- FUNÇÃO RPC TRANSACIONAL: REGISTRAR VENDA
CREATE OR REPLACE FUNCTION public.registrar_venda(itens_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usuario_id UUID;
    v_venda_id BIGINT;
    v_total NUMERIC(10,2) := 0.00;
    v_item RECORD;
    v_produto RECORD;
    v_subtotal NUMERIC(10,2);
BEGIN
    -- 1. Validar usuário autenticado
    v_usuario_id := auth.uid();
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado. Usuário não autenticado.';
    END IF;

    -- 2. Validar payload de itens
    IF itens_payload IS NULL OR jsonb_array_length(itens_payload) = 0 THEN
        RAISE EXCEPTION 'O carrinho de vendas não pode estar vazio.';
    END IF;

    -- 3. Criar o cabeçalho da venda (total temporário zero)
    INSERT INTO public.vendas (usuario_id, valor_total)
    VALUES (v_usuario_id, 0.00)
    RETURNING id INTO v_venda_id;

    -- 4. Processar itens com bloqueio de concorrência (FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(itens_payload) AS (produto_id BIGINT, quantidade INT)
    LOOP
        IF v_item.quantidade <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida para o produto %.', v_item.produto_id;
        END IF;

        -- Bloquear e obter produto do próprio usuário
        SELECT * INTO v_produto
        FROM public.produtos
        WHERE id = v_item.produto_id AND usuario_id = v_usuario_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Produto % não encontrado ou não pertence ao usuário.', v_item.produto_id;
        END IF;

        IF v_produto.estoque < v_item.quantidade THEN
            RAISE EXCEPTION 'Estoque insuficiente para o produto "%" (Disponível: %, Solicitado: %).',
                v_produto.nome, v_produto.estoque, v_item.quantidade;
        END IF;

        -- Calcular subtotal com o preço registrado no banco (não confia no front)
        v_subtotal := ROUND(v_produto.preco * v_item.quantidade, 2);
        v_total := v_total + v_subtotal;

        -- Atualizar estoque
        UPDATE public.produtos
        SET estoque = estoque - v_item.quantidade
        WHERE id = v_produto.id;

        -- Inserir item da venda
        INSERT INTO public.itens_venda (venda_id, produto_id, quantidade, preco_unitario, subtotal)
        VALUES (v_venda_id, v_produto.id, v_item.quantidade, v_produto.preco, v_subtotal);
    END LOOP;

    -- 5. Atualizar o total da venda
    UPDATE public.vendas
    SET valor_total = v_total
    WHERE id = v_venda_id;

    RETURN jsonb_build_object(
        'sucesso', true,
        'venda_id', v_venda_id,
        'valor_total', v_total
    );
END;
$$;

-- Restringir permissões de execução da função
REVOKE EXECUTE ON FUNCTION public.registrar_venda(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_venda(JSONB) TO authenticated;
