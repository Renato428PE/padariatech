import { supabase } from './supabaseClient.js';
import { getCurrentUser } from './auth.js';

/**
 * Lista todos os produtos cadastrados do usuário logado
 */
export async function listarProdutos(termoBusca = '') {
  let query = supabase
    .from('produtos')
    .select('*')
    .order('nome', { ascending: true });

  if (termoBusca && termoBusca.trim() !== '') {
    query = query.ilike('nome', `%${termoBusca.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erro ao listar produtos:', error);
    throw error;
  }
  return data || [];
}

/**
 * Cadastrar um novo produto
 */
export async function cadastrarProduto({ nome, categoria, preco, estoque }) {
  const user = getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado.');

  const { data, error } = await supabase
    .from('produtos')
    .insert([
      {
        nome: nome.trim(),
        categoria: categoria.trim(),
        preco: parseFloat(preco),
        estoque: parseInt(estoque, 10),
        usuario_id: user.id
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Erro ao cadastrar produto:', error);
    throw error;
  }
  return data;
}

/**
 * Atualizar um produto existente
 */
export async function atualizarProduto(id, { nome, categoria, preco, estoque }) {
  const { data, error } = await supabase
    .from('produtos')
    .update({
      nome: nome.trim(),
      categoria: categoria.trim(),
      preco: parseFloat(preco),
      estoque: parseInt(estoque, 10)
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar produto:', error);
    throw error;
  }
  return data;
}

/**
 * Excluir produto (protegido por integridade referencial RESTRICT)
 */
export async function excluirProduto(id) {
  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', id);

  if (error) {
    if (error.code === '23503') {
      throw new Error('Não é possível excluir este produto pois ele já possui histórico de vendas registradas.');
    }
    console.error('Erro ao excluir produto:', error);
    throw error;
  }
  return true;
}

/**
 * Carrega a lista de produtos padrão/exemplo sem duplicar existentes
 */
export async function carregarProdutosExemplo() {
  const user = getCurrentUser();
  if (!user) throw new Error('Usuário não autenticado.');

  const produtosExemplo = [
    { nome: 'Pão francês', categoria: 'Pães', preco: 1.00, estoque: 100 },
    { nome: 'Pão de queijo', categoria: 'Salgados', preco: 4.50, estoque: 40 },
    { nome: 'Café expresso', categoria: 'Bebidas', preco: 5.00, estoque: 30 },
    { nome: 'Bolo de chocolate', categoria: 'Doces', preco: 35.00, estoque: 8 },
    { nome: 'Croissant', categoria: 'Folhados', preco: 8.50, estoque: 20 },
    { nome: 'Sonho', categoria: 'Doces', preco: 6.00, estoque: 15 },
    { nome: 'Leite integral', categoria: 'Bebidas', preco: 6.50, estoque: 25 },
    { nome: 'Sanduíche natural', categoria: 'Lanches', preco: 12.00, estoque: 12 }
  ];

  const existentes = await listarProdutos();
  const nomesExistentes = new Set(existentes.map(p => p.nome.toLowerCase()));

  const novos = produtosExemplo
    .filter(p => !nomesExistentes.has(p.nome.toLowerCase()))
    .map(p => ({
      ...p,
      usuario_id: user.id
    }));

  if (novos.length === 0) {
    return { inseridos: 0, mensagem: 'Todos os produtos de exemplo já estão cadastrados!' };
  }

  const { data, error } = await supabase
    .from('produtos')
    .insert(novos)
    .select();

  if (error) {
    console.error('Erro ao inserir produtos de exemplo:', error);
    throw error;
  }

  return { inseridos: data.length, mensagem: `${data.length} produtos de exemplo adicionados com sucesso!` };
}
