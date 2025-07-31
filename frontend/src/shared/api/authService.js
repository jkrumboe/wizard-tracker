import supabase from '@/shared/utils/supabase';

class AuthService {
  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data.user;
  }

  async register({ email, password, name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });
    if (error) throw new Error(error.message);
    return data.user;
  }

  async logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  isAuthenticated() {
    const { data } = supabase.auth.getSession();
    return !!data?.session;
  }

  async refreshToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return data.session;
  }

  async checkAuthStatus() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  }

  initialize() {
    // No-op for Supabase
  }

  async adminLogin({ email, password }) {
    return this.login({ email, password });
  }

  async adminLogout() {
    return this.logout();
  }

  async setupAdmin() {
    // Assume admin created via Supabase dashboard
    return;
  }

  async updateProfile({ name, avatar }) {
    const { data, error } = await supabase.auth.updateUser({
      data: { name, avatar }
    });
    if (error) throw new Error(error.message);
    return data.user;
  }
}

export const authService = new AuthService();
export default authService;