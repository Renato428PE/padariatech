import { supabase } from './supabaseClient.js';

let currentUser = null;

/**
 * Obtém a sessão ativa no momento
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Erro ao buscar sessão:', error);
    return null;
  }
  currentUser = data.session?.user || null;
  return data.session;
}

/**
 * Retorna o usuário logado
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Cadastrar novo usuário com e-mail e senha
 */
export async function signUpUser(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  return { data, error };
}

/**
 * Realizar login com e-mail e senha
 */
export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (data?.user) {
    currentUser = data.user;
  }
  return { data, error };
}

/**
 * Fazer logout da sessão atual
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  currentUser = null;
  return { error };
}

/**
 * Ouve mudanças de estado da autenticação (login, logout, refresh)
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    callback(event, session);
  });
}
