/**
 * js/services/dashboard.service.js
 * KPIs de Inventario desde Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

export const DashboardService = {
    async getKPIs() {
        try {
            // 1. Total de Ítems
            const { count: totalItems } = await supabase
                .from('inventario')
                .select('*', { count: 'exact', head: true });

            // 2. Stock Crítico (Stock <= Minimo)
            // Nota: Supabase no soporta comparacion directa entre columnas en filtros simples (col1 <= col2).
            // Traemos los datos necesarios y filtramos en JS (eficiente para < 5000 items).
            const { data: products } = await supabase
                .from('inventario')
                .select('stock_actual, stock_minimo');
            
            let criticalCount = 0;
            let nearDepletion = 0;

            if (products) {
                products.forEach(p => {
                    const stock = p.stock_actual || 0;
                    const min = p.stock_minimo || 0;
                    
                    if (stock <= min) {
                        criticalCount++;
                    } else if (stock <= (min * 1.5)) {
                        nearDepletion++;
                    }
                });
            }

            // 3. OCs Pendientes (Estado Enviada)
            const { count: pendingOCs } = await supabase
                .from('compras_ordenes')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'Enviada');

            return {
                criticalCount: criticalCount || 0,
                pendingOCs: pendingOCs || 0,
                totalItems: totalItems || 0,
                nearDepletion: nearDepletion || 0
            };

        } catch (error) {
            console.error("Error calculando KPIs:", error);
            return { criticalCount: 0, pendingOCs: 0, totalItems: 0, nearDepletion: 0 };
        }
    }
};