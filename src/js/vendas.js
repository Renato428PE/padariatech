import { supabase } from './supabaseClient.js';

let carrinho = [];

/**
 * Retorna os itens do carrinho atual
 */
export function getCarrinho() {
  return carrinho;
}

/**
 * Adiciona um produto ao carrinho ou incrementa quantidade
 */
export function adicionarAoCarrinho(produto, quantidade = 1) {
  if (quantidade <= 0) throw new Error('A quantidade deve ser positiva.');
  
  const index = carrinho.findIndex(item => item.id === produto.id);
  const qtdAtual = index > -1 ? carrinho[index].quantidade : 0;
  const qtdFinal = qtdAtual + quantidade;

  if (qtdFinal > produto.estoque) {
    throw new Error(`Estoque insuficiente. Apenas ${produto.estoque} unidades disponíveis.`);
  }

  if (index > -1) {
    carrinho[index].quantidade = qtdFinal;
    carrinho[index].subtotal = parseFloat((carrinho[index].quantidade * produto.preco).toFixed(2));
  } else {
    carrinho.push({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      estoque: produto.estoque,
      quantidade: quantidade,
      subtotal: parseFloat((quantidade * produto.preco).toFixed(2))
    });
  }

  return carrinho;
}

/**
 * Atualiza quantidade de um item no carrinho
 */
export function alterarQuantidadeCarrinho(produtoId, novaQuantidade) {
  const index = carrinho.findIndex(item => item.id === produtoId);
  if (index === -1) return carrinho;

  if (novaQuantidade <= 0) {
    carrinho.splice(index, 1);
  } else {
    if (novaQuantidade > carrinho[index].estoque) {
      throw new Error(`Estoque insuficiente. Apenas ${carrinho[index].estoque} disponíveis.`);
    }
    carrinho[index].quantidade = novaQuantidade;
    carrinho[index].subtotal = parseFloat((novaQuantidade * carrinho[index].preco).toFixed(2));
  }

  return carrinho;
}

/**
 * Remove produto do carrinho
 */
export function removerDoCarrinho(produtoId) {
  carrinho = carrinho.filter(item => item.id !== produtoId);
  return carrinho;
}

/**
 * Limpa o carrinho
 */
export function limparCarrinho() {
  carrinho = [];
  return carrinho;
}

/**
 * Calcula o total estimado no cliente (o valor oficial é calculado no PostgreSQL)
 */
export function calcularTotalEstimado() {
  return carrinho.reduce((acc, item) => acc + item.subtotal, 0);
}

/**
 * Finaliza a venda chamando a função RPC transacional do PostgreSQL
 */
export async function finalizarVenda() {
  if (carrinho.length === 0) {
    throw new Error('O carrinho está vazio.');
  }

  // Prepara o payload para a função RPC contendo apenas os IDs e quantidades
  const payload = carrinho.map(item => ({
    produto_id: item.id,
    quantidade: item.quantidade
  }));

  const { data, error } = await supabase.rpc('registrar_venda', {
    itens_payload: payload
  });

  if (error) {
    console.error('Erro na RPC registrar_venda:', error);
    throw new Error(error.message || 'Falha ao registrar venda no banco de dados.');
  }

  // Limpa o carrinho após o sucesso da transação
  limparCarrinho();
  return data;
}

/**
 * Consulta o histórico de vendas do usuário com os itens detalhados
 */
export async function listarHistoricoVendas() {
  const { data, error } = await supabase
    .from('vendas')
    .select(`
      id,
      data_venda,
      valor_total,
      itens_venda (
        id,
        quantidade,
        preco_unitario,
        subtotal,
        produtos (
          id,
          nome,
          categoria
        )
      )
    `)
    .order('data_venda', { ascending: false });

  if (error) {
    console.error('Erro ao listar histórico de vendas:', error);
    throw error;
  }

  return data || [];
}
