import supabase from '../../../../core/http/supabase.client.js';

// Wrapper legacy
export const LocalDB = { getAll: () => [], getById: () => null, update: () => false };

export const log = async (action, details) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('audit_logs').insert({
            action, details, 
            user_id: session?.user?.id, 
            user_email: session?.user?.email || 'Prensa',
            created_at: new Date().toISOString()
        });
    } catch (e) { console.warn(e); }
};