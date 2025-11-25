// Importamos createClient para generar una instancia temporal
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
// Importamos el cliente principal para lectura y las credenciales
import supabase from '../../../../core/http/supabase.client.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../../config/supabase.config.js';
import { log } from './local.db.js';

export const usersDB = {
    async getUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, status');
            
        if (error) {
            console.error("Error fetching users:", error);
            return [];
        }
        return data.map(u => ({ ...u, name: u.full_name }));
    },
    
    /**
     * Crea un usuario en Supabase Auth usando un cliente temporal
     * para NO cerrar la sesión del administrador actual.
     */
    async addUser(user) {
        try {
            // 1. Crear una instancia nueva y desechable de Supabase
            const tempSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

            // 2. Usar esta instancia para registrar al usuario
            // Esto devuelve un token para el nuevo usuario, pero no afecta a 'supabase' principal
            const { data, error } = await tempSupabase.auth.signUp({
                email: user.email,
                password: user.password,
                options: {
                    // Pasamos los datos del perfil en metadata
                    // El trigger SQL 'handle_new_user' los leerá de aquí
                    data: {
                        full_name: user.name,
                        role: user.role
                    }
                }
            });

            if (error) {
                console.error("Error Supabase Auth:", error);
                return { success: false, message: error.message };
            }

            // 3. Verificar si se creó (si requiere confirmación de email, user será null o identidades vacías según config)
            if (data.user) {
                log('USUARIO_CREADO', `Admin creó usuario: ${user.email} (${user.role})`);
                return { success: true };
            } else {
                return { success: false, message: "No se pudo obtener respuesta de creación." };
            }

        } catch (e) {
            console.error("Excepción al crear usuario:", e);
            return { success: false, message: "Error interno del sistema." };
        }
    },

    async updateUser(id, updates) {
        const dbUpdates = { ...updates };
        if (dbUpdates.name) {
            dbUpdates.full_name = dbUpdates.name;
            delete dbUpdates.name;
        }
        const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', id);
        
        if (!error) log('USUARIO_EDITADO', `ID ${id} actualizado.`);
        return { success: !error };
    },

    async deleteUser(id) {
        // Nota: Esto borra el PERFIL público. El usuario Auth queda "huérfano" pero sin acceso a datos.
        // Para borrar de Auth se requiere Edge Function (backend).
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        
        if (!error) log('USUARIO_ELIMINADO', `Perfil ID ${id} eliminado.`);
        return { success: !error };
    },

    async getActiveUserCount() {
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'Online');
        return count || 0;
    }
};