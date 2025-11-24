/**
 * js/services/clientes.service.js
 * Servicio de Clientes CRM conectado a Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const ClientesService = {
    /**
     * Obtiene todos los clientes (Mapeo DB -> UI).
     */
    async getAllClients() {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .order('razon_social');

        if (error) {
            console.error("Error al obtener clientes:", error);
            return [];
        }

        // Adaptador: La BD usa 'ruc_dni', la UI usa 'ruc'
        return data.map(c => ({
            ...c,
            ruc: c.ruc_dni 
        }));
    },

    /**
     * Búsqueda optimizada en el servidor (ILIKE).
     */
    async searchClients(query) {
        if (!query || query.trim() === '') {
            const { data } = await supabase.from('clientes').select('*').limit(10);
            return (data || []).map(c => ({ ...c, ruc: c.ruc_dni }));
        }

        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .or(`razon_social.ilike.%${query}%,ruc_dni.ilike.%${query}%`)
            .limit(20);

        if (error) return [];

        return data.map(c => ({
            ...c,
            ruc: c.ruc_dni
        }));
    },

    async getClientById(id) {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;

        return { ...data, ruc: data.ruc_dni };
    },

    /**
     * Crea un nuevo cliente.
     */
    async createClient(clientData) {
        const dbClient = {
            tipo_persona: clientData.tipo_persona,
            ruc_dni: clientData.ruc, // Mapeo inverso UI -> DB
            razon_social: clientData.razon_social,
            nombre_contacto: clientData.nombre_contacto,
            email: clientData.email,
            telefono: clientData.telefono,
            direccion: clientData.direccion,
            departamento: clientData.departamento,
            provincia: clientData.provincia,
            distrito: clientData.distrito,
            ubigeo: clientData.ubigeo
        };

        const { data, error } = await supabase
            .from('clientes')
            .insert(dbClient)
            .select()
            .single();

        if (error) {
            console.error("Error creando cliente:", error);
            return { success: false, message: error.message };
        }

        log('CLIENTE_CREADO', `Cliente: ${clientData.razon_social}`);
        return { success: true, id: data.id };
    },

    /**
     * Actualiza un cliente.
     */
    async updateClient(id, updates) {
        const dbUpdates = { ...updates };
        
        // Mapeo de campos especiales
        if (updates.ruc) {
            dbUpdates.ruc_dni = updates.ruc;
            delete dbUpdates.ruc;
        }

        const { error } = await supabase
            .from('clientes')
            .update(dbUpdates)
            .eq('id', id);

        if (error) {
            console.error("Error actualizando cliente:", error);
            return { success: false, message: error.message };
        }

        log('CLIENTE_ACTUALIZADO', `ID: ${id}`);
        return { success: true };
    },

    async deleteClient(id) {
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) return { success: false, message: error.message };
        
        log('CLIENTE_ELIMINADO', `ID eliminado: ${id}`);
        return { success: true };
    }
};