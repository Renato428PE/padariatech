import { supabase } from './supabaseClient.js';

/**
 * Carrega todos os indicadores do Dashboard em tempo real do Supabase
 */
export async function carregarMetricasDashboard() {
  // 1. Busca produtos para total e estoque baixo (<= 15 unidades)
  const { data: produtos, error: errProd } = await supabase
    .from('produtos')
    .select('id, nome, estoque, preco');

  if (errProd) {
    console.error('Erro ao buscar produtos para dashboard:', errProd);
    throw errProd;
  }

  // 2. Busca vendas para faturamento e quantidade
  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select('id, data_venda, valor_total')
    .order('data_venda', { ascending: false });

  if (errVendas) {
    console.error('Erro ao buscar vendas para dashboard:', errVendas);
    throw errVendas;
  }

  const totalProdutos = produtos ? produtos.length : 0;
  const produtosBaixoEstoque = produtos ? produtos.filter(p => p.estoque <= 15) : [];
  const quantidadeVendas = vendas ? vendas.length : 0;
  const faturamentoTotal = vendas
    ? vendas.reduce((acc, v) => acc + parseFloat(v.valor_total || 0), 0)
    : 0;

  const ultimasCincoVendas = vendas ? vendas.slice(0, 5) : [];

  return {
    totalProdutos,
    totalEstoqueBaixo: produtosBaixoEstoque.length,
    produtosBaixoEstoque,
    quantidadeVendas,
    faturamentoTotal,
    ultimasCincoVendas
  };
}
