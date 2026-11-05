import { getSession, signInUser, signUpUser, signOutUser, onAuthStateChange, getCurrentUser } from './auth.js';
import { listarProdutos, cadastrarProduto, atualizarProduto, excluirProduto, carregarProdutosExemplo } from './produtos.js';
import { getCarrinho, adicionarAoCarrinho, alterarQuantidadeCarrinho, removerDoCarrinho, limparCarrinho, calcularTotalEstimado, finalizarVenda, listarHistoricoVendas } from './vendas.js';
import { carregarMetricasDashboard } from './dashboard.js';

// Utilitário de Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Formatador de Moeda Real (BRL)
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

// Formatador de Data/Hora amigável
function formatDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR');
}

// Navegação entre Views (Abas)
function switchView(viewName) {
  document.querySelectorAll('.content-view').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  const targetLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);

  if (targetView) targetView.style.display = 'block';
  if (targetLink) targetLink.classList.add('active');

  // Fechar sidebar mobile ao navegar
  document.getElementById('sidebar').classList.remove('open');

  // Gatilhos de carregamento sob demanda
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'produtos') loadProdutos();
  if (viewName === 'vendas') loadPOS();
  if (viewName === 'historico') loadHistorico();
}

// Controle de Autenticação na UI
function updateAuthStateUI(user) {
  const authSection = document.getElementById('auth-section');
  const appSection = document.getElementById('app-section');

  if (user) {
    authSection.style.display = 'none';
    appSection.style.display = 'flex';
    document.getElementById('user-display-email').textContent = user.email;
    switchView('dashboard');
  } else {
    authSection.style.display = 'flex';
    appSection.style.display = 'none';
  }
}

// ==========================================
// 1. CARREGAMENTO DO DASHBOARD
// ==========================================
async function loadDashboard() {
  try {
    const data = await carregarMetricasDashboard();
    document.getElementById('dash-total-produtos').textContent = data.totalProdutos;
    document.getElementById('dash-estoque-baixo').textContent = data.totalEstoqueBaixo;
    document.getElementById('dash-total-vendas').textContent = data.quantidadeVendas;
    document.getElementById('dash-faturamento').textContent = formatCurrency(data.faturamentoTotal);

    const tbody = document.getElementById('dash-ultimas-vendas-tbody');
    if (!data.ultimasCincoVendas || data.ultimasCincoVendas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--texto-secundario);">Nenhuma venda registrada ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = data.ultimasCincoVendas.map(v => `
      <tr>
        <td><strong>#${v.id}</strong></td>
        <td>${formatDateTime(v.data_venda)}</td>
        <td><strong>${formatCurrency(v.valor_total)}</strong></td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Erro ao carregar indicadores: ' + error.message, 'error');
  }
}

// ==========================================
// 2. CARREGAMENTO E CRUD DE PRODUTOS
// ==========================================
async function loadProdutos() {
  const tbody = document.getElementById('tabela-produtos-tbody');
  const busca = document.getElementById('filtro-busca-produto').value;
  try {
    const produtos = await listarProdutos(busca);
    if (produtos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--texto-secundario);">Nenhum produto cadastrado. Adicione um novo ou carregue exemplos!</td></tr>';
      return;
    }

    tbody.innerHTML = produtos.map(p => `
      <tr>
        <td>#${p.id}</td>
        <td><strong>${p.nome}</strong></td>
        <td>${p.categoria}</td>
        <td>${formatCurrency(p.preco)}</td>
        <td>
          <span class="badge ${p.estoque <= 15 ? 'badge-low' : 'badge-ok'}">
            ${p.estoque} un
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm btn-editar-prod" 
            data-id="${p.id}" data-nome="${p.nome}" data-cat="${p.categoria}" data-preco="${p.preco}" data-estoque="${p.estoque}">
            ✏️ Editar
          </button>
          <button class="btn btn-danger btn-sm btn-excluir-prod" data-id="${p.id}" data-nome="${p.nome}">
            🗑️ Excluir
          </button>
        </td>
      </tr>
    `).join('');

    // Eventos de Edição
    document.querySelectorAll('.btn-editar-prod').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirModalProduto({
          id: btn.dataset.id,
          nome: btn.dataset.nome,
          categoria: btn.dataset.cat,
          preco: btn.dataset.preco,
          estoque: btn.dataset.estoque
        });
      });
    });

    // Eventos de Exclusão
    document.querySelectorAll('.btn-excluir-prod').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nome = btn.dataset.nome;
        if (confirm(`Tem certeza que deseja excluir o produto "${nome}"?`)) {
          try {
            await excluirProduto(id);
            showToast(`Produto "${nome}" excluído com sucesso!`, 'success');
            loadProdutos();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

  } catch (error) {
    showToast('Erro ao listar produtos: ' + error.message, 'error');
  }
}

function abrirModalProduto(prod = null) {
  const modal = document.getElementById('modal-produto');
  const titulo = document.getElementById('modal-produto-titulo');
  const form = document.getElementById('form-salvar-produto');

  form.reset();
  if (prod) {
    titulo.textContent = 'Editar Produto';
    document.getElementById('prod-id').value = prod.id;
    document.getElementById('prod-nome').value = prod.nome;
    document.getElementById('prod-categoria').value = prod.categoria;
    document.getElementById('prod-preco').value = prod.preco;
    document.getElementById('prod-estoque').value = prod.estoque;
  } else {
    titulo.textContent = 'Cadastrar Novo Produto';
    document.getElementById('prod-id').value = '';
  }
  modal.classList.add('active');
}

function fecharModalProduto() {
  document.getElementById('modal-produto').classList.remove('active');
}

// ==========================================
// 3. BALCÃO DE VENDAS (PDV)
// ==========================================
let produtosDisponiveisPDV = [];

async function loadPOS() {
  const container = document.getElementById('pos-products-container');
  try {
    produtosDisponiveisPDV = await listarProdutos();
    renderPOSProducts();
    renderCarrinho();
  } catch (err) {
    showToast('Erro ao carregar produtos para venda: ' + err.message, 'error');
  }
}

function renderPOSProducts() {
  const container = document.getElementById('pos-products-container');
  const filtro = document.getElementById('filtro-pos-produto').value.toLowerCase();

  const filtrados = produtosDisponiveisPDV.filter(p => p.nome.toLowerCase().includes(filtro));
  if (filtrados.length === 0) {
    container.innerHTML = '<p style="color: var(--texto-secundario);">Nenhum produto disponível.</p>';
    return;
  }

  container.innerHTML = filtrados.map(p => `
    <div class="pos-product-card" data-id="${p.id}">
      <div>
        <h4>${p.nome}</h4>
        <span style="font-size: 0.8rem; color: var(--texto-secundario);">${p.categoria}</span>
      </div>
      <div style="margin-top: 10px;">
        <div class="price">${formatCurrency(p.preco)}</div>
        <div class="stock">Estoque: ${p.estoque} un</div>
        <button class="btn btn-secondary btn-block btn-sm btn-adicionar-carrinho" data-id="${p.id}" style="margin-top: 8px;">
          + Adicionar
        </button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.btn-adicionar-carrinho').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pId = parseInt(btn.dataset.id, 10);
      const prod = produtosDisponiveisPDV.find(item => item.id === pId);
      if (prod) {
        try {
          adicionarAoCarrinho(prod, 1);
          renderCarrinho();
          showToast(`"${prod.nome}" adicionado ao carrinho!`, 'info');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  });
}

function renderCarrinho() {
  const container = document.getElementById('carrinho-itens-container');
  const totalEl = document.getElementById('carrinho-total-valor');
  const itens = getCarrinho();

  if (itens.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--texto-secundario); padding-top: 50px;">Nenhum produto adicionado.</p>';
    totalEl.textContent = 'R$ 0,00';
    return;
  }

  container.innerHTML = itens.map(item => `
    <div class="cart-item">
      <div>
        <strong>${item.nome}</strong><br>
        <span style="font-size: 0.82rem; color: var(--texto-secundario);">
          ${formatCurrency(item.preco)} x 
          <input type="number" min="1" max="${item.estoque}" value="${item.quantidade}" 
            class="input-cart-qtd" data-id="${item.id}" style="width: 50px; text-align: center; border-radius: 4px; border: 1px solid var(--borda);">
        </span>
      </div>
      <div style="text-align: right;">
        <strong>${formatCurrency(item.subtotal)}</strong><br>
        <button class="btn btn-danger btn-sm btn-remover-item" data-id="${item.id}" style="padding: 2px 6px; font-size: 0.75rem; margin-top: 4px;">Remover</button>
      </div>
    </div>
  `).join('');

  totalEl.textContent = formatCurrency(calcularTotalEstimado());

  // Eventos de alteração de quantidade no carrinho
  document.querySelectorAll('.input-cart-qtd').forEach(input => {
    input.addEventListener('change', () => {
      const pId = parseInt(input.dataset.id, 10);
      const novaQtd = parseInt(input.value, 10);
      try {
        alterarQuantidadeCarrinho(pId, novaQtd);
        renderCarrinho();
      } catch (err) {
        showToast(err.message, 'error');
        renderCarrinho();
      }
    });
  });

  // Eventos de remoção
  document.querySelectorAll('.btn-remover-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const pId = parseInt(btn.dataset.id, 10);
      removerDoCarrinho(pId);
      renderCarrinho();
    });
  });
}

// ==========================================
// 4. HISTÓRICO DE VENDAS
// ==========================================
async function loadHistorico() {
  const tbody = document.getElementById('tabela-historico-tbody');
  try {
    const vendas = await listarHistoricoVendas();
    if (vendas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--texto-secundario);">Nenhuma venda realizada até o momento.</td></tr>';
      return;
    }

    tbody.innerHTML = vendas.map(v => {
      const itensHtml = v.itens_venda && v.itens_venda.length > 0
        ? v.itens_venda.map(it => `• ${it.quantidade}x ${it.produtos?.nome || 'Produto'} (${formatCurrency(it.preco_unitario)}) = ${formatCurrency(it.subtotal)}`).join('<br>')
        : 'Sem itens';

      return `
        <tr>
          <td><strong>#${v.id}</strong></td>
          <td>${formatDateTime(v.data_venda)}</td>
          <td style="font-size: 0.85rem; line-height: 1.4;">${itensHtml}</td>
          <td><strong style="color: var(--sucesso);">${formatCurrency(v.valor_total)}</strong></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Erro ao carregar histórico: ' + err.message, 'error');
  }
}

// ==========================================
// INICIALIZAÇÃO DE EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Ouvinte de estado de autenticação
  onAuthStateChange((event, session) => {
    updateAuthStateUI(session?.user || null);
  });

  // 2. Verificar sessão ativa inicial
  const session = await getSession();
  updateAuthStateUI(session?.user || null);

  // 3. Alternar entre formulários de login e cadastro
  document.getElementById('link-ir-cadastro').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-card').style.display = 'none';
    document.getElementById('signup-card').style.display = 'block';
  });

  document.getElementById('link-ir-login').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-card').style.display = 'none';
    document.getElementById('login-card').style.display = 'block';
  });

  // 4. Submissão do Login
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await signInUser(email, password);
    if (error) {
      showToast('Falha no login: ' + error.message, 'error');
    } else {
      showToast('Login realizado com sucesso! Bem-vindo(a).', 'success');
      updateAuthStateUI(data.user);
    }
  });

  // 5. Submissão do Cadastro
  document.getElementById('form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
      showToast('As senhas não coincidem!', 'error');
      return;
    }

    const { data, error } = await signUpUser(email, password);
    if (error) {
      showToast('Falha no cadastro: ' + error.message, 'error');
    } else {
      showToast('Cadastro realizado! Se necessário, confirme seu e-mail ou faça login.', 'success');
      document.getElementById('signup-card').style.display = 'none';
      document.getElementById('login-card').style.display = 'block';
    }
  });

  // 6. Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOutUser();
    showToast('Sessão encerrada com sucesso.', 'info');
    updateAuthStateUI(null);
  });

  // 7. Navegação entre abas
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(link.dataset.view);
    });
  });

  // 8. Mobile Menu Toggle
  document.getElementById('btn-toggle-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // 9. Atualizar Dashboard
  document.getElementById('btn-atualizar-dashboard').addEventListener('click', () => {
    loadDashboard();
    showToast('Dashboard atualizado!', 'info');
  });

  // 10. Produtos: Busca e Filtro
  document.getElementById('filtro-busca-produto').addEventListener('input', () => {
    loadProdutos();
  });

  // 11. Modal de Produtos (Abrir, Fechar e Salvar)
  document.getElementById('btn-abrir-modal-produto').addEventListener('click', () => {
    abrirModalProduto();
  });
  document.getElementById('btn-fechar-modal-produto').addEventListener('click', fecharModalProduto);
  document.getElementById('btn-cancelar-modal-produto').addEventListener('click', fecharModalProduto);

  document.getElementById('form-salvar-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value;
    const categoria = document.getElementById('prod-categoria').value;
    const preco = document.getElementById('prod-preco').value;
    const estoque = document.getElementById('prod-estoque').value;

    try {
      if (id) {
        await atualizarProduto(id, { nome, categoria, preco, estoque });
        showToast('Produto atualizado com sucesso!', 'success');
      } else {
        await cadastrarProduto({ nome, categoria, preco, estoque });
        showToast('Produto cadastrado com sucesso!', 'success');
      }
      fecharModalProduto();
      loadProdutos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 12. Carregar Produtos de Exemplo
  document.getElementById('btn-carregar-exemplos').addEventListener('click', async () => {
    try {
      const res = await carregarProdutosExemplo();
      showToast(res.mensagem, 'success');
      loadProdutos();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 13. PDV: Filtro e Limpeza do Carrinho
  document.getElementById('filtro-pos-produto').addEventListener('input', renderPOSProducts);
  document.getElementById('btn-limpar-carrinho').addEventListener('click', () => {
    limparCarrinho();
    renderCarrinho();
    showToast('Carrinho limpo.', 'info');
  });

  // 14. Finalizar Venda Atômica
  document.getElementById('btn-finalizar-venda').addEventListener('click', async () => {
    const itens = getCarrinho();
    if (itens.length === 0) {
      showToast('O carrinho está vazio!', 'error');
      return;
    }

    if (!confirm('Deseja realmente confirmar esta venda?')) return;

    try {
      const res = await finalizarVenda();
      showToast(`Venda #${res.venda_id} realizada com sucesso! Total: ${formatCurrency(res.valor_total)}`, 'success');
      renderCarrinho();
      loadPOS(); // Recarrega os produtos e estoque atualizado
    } catch (err) {
      showToast('Falha na venda: ' + err.message, 'error');
    }
  });

  // 15. Atualizar Histórico
  document.getElementById('btn-atualizar-historico').addEventListener('click', () => {
    loadHistorico();
    showToast('Histórico atualizado!', 'info');
  });
});
