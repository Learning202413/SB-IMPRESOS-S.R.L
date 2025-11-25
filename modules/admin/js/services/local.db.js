import supabase from '../../../../core/http/supabase.client.js';

export const getStorage = (key, seed) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : seed;
};
export const setStorage = (key, data) => localStorage.setItem(key, JSON.stringify(data));

export const log = async (action, details) => {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('audit_logs').insert({
        action, details, 
        user_id: session?.user?.id, 
        user_email: session?.user?.email,
        created_at: new Date().toISOString()
    });
};

export const dbBase = {
    getLogs: async () => {
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
        return (data || []).map(l => ({ ...l, timestamp: new Date(l.created_at).toLocaleString(), user: l.user_email }));
    },
    getStorage, setStorage, log
};