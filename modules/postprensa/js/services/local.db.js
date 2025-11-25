import supabase from '../../../../core/http/supabase.client.js';

export const LocalDB = { getAll: () => [], getById: () => null, update: () => false };

export const log = async (action, details) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('audit_logs').insert({
            action, details, 
            user_id: session?.user?.id, 
            user_email: session?.user?.email || 'Acabados',
            created_at: new Date().toISOString()
        });
    } catch (e) { console.warn(e); }
};