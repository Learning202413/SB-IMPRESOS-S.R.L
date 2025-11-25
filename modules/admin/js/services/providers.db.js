import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const providersDB = {
    async getProviders() {
        const { data } = await supabase.from('proveedores').select('*').order('created_at', { ascending: false });
        return (data || []).map(p => ({ ...p, taxId: p.tax_id }));
    },
    
    async addProvider(provider) {
        const { error } = await supabase.from('proveedores').insert({
            name: provider.name, tax_id: provider.taxId, contact: provider.contact, insumos: provider.insumos, address: provider.address
        });
        if (!error) log('PROVEEDOR_CREADO', provider.name);
        return { success: !error };
    },

    async updateProvider(id, updates) {
        const dbUpdates = {};
        if(updates.name) dbUpdates.name = updates.name;
        if(updates.taxId) dbUpdates.tax_id = updates.taxId;
        if(updates.contact) dbUpdates.contact = updates.contact;
        if(updates.insumos) dbUpdates.insumos = updates.insumos;

        const { error } = await supabase.from('proveedores').update(dbUpdates).eq('id', id);
        if (!error) log('PROVEEDOR_ACTUALIZADO', id);
        return { success: !error };
    },

    async deleteProvider(id) {
        const { error } = await supabase.from('proveedores').delete().eq('id', id);
        if (!error) log('PROVEEDOR_ELIMINADO', id);
        return { success: !error };
    }
};