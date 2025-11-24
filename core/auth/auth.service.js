import supabase from '../http/supabase.client.js';

class AuthService {
    async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });
            return { user: data.user, error: error };
        } catch (e) {
            console.error("Error en auth service:", e);
            return { user: null, error: e };
        }
    }

    async logout() {
        const { error } = await supabase.auth.signOut();
        return { error };
    }
}

export const authService = new AuthService();