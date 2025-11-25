/**
 * js/services/reportes.service.js
 * Reportes de Inventario conectados a Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

export const ReportesService = {
    
    async getInventoryStats() {
        // Traemos todo el inventario para análisis
        const { data: products } = await supabase.from('inventario').select('sku, nombre, stock_actual, stock_minimo, clase_abc');
        
        if (!products) return { idleC: 0, replenishmentList: [] };

        // 1. Items Clase C "Ociosos" (Stock > 0 y es Clase C)
        const idleC = products.filter(p => p.clase_abc === 'C' && p.stock_actual > 0).length;

        // 2. Lista de Reposición
        const replenishmentList = products
            .filter(p => p.stock_actual <= p.stock_minimo)
            .map(p => ({
                producto: p.nombre,
                sku: p.sku,
                deficit: p.stock_minimo - p.stock_actual,
                unidad: 'Unid.'
            }));

        return { idleC, replenishmentList };
    },

    async getABCStats() {
        // Usamos una consulta agrupada simulada (contando por tipo)
        const { data: products } = await supabase.from('inventario').select('clase_abc');
        
        const total = products?.length || 0;
        if (total === 0) return { counts: {A:0, B:0, C:0}, percentages: {A:0, B:0, C:0}, total: 0 };

        const counts = {
            A: products.filter(p => p.clase_abc === 'A').length,
            B: products.filter(p => p.clase_abc === 'B').length,
            C: products.filter(p => p.clase_abc === 'C').length
        };

        return {
            counts,
            percentages: {
                A: ((counts.A / total) * 100).toFixed(1),
                B: ((counts.B / total) * 100).toFixed(1),
                C: ((counts.C / total) * 100).toFixed(1)
            },
            total
        };
    },

    async getNearDepletionItems() {
        const { data: products } = await supabase
            .from('inventario')
            .select('sku, nombre, stock_actual, stock_minimo');

        if (!products) return [];

        return products
            .filter(p => {
                const stock = p.stock_actual || 0;
                const min = p.stock_minimo || 0;
                return stock > min && stock <= (min * 1.5);
            })
            .map(p => ({
                nombre: p.nombre,
                sku: p.sku,
                stock: p.stock_actual,
                min: p.stock_minimo,
                healthPct: ((p.stock_actual / p.stock_minimo) * 100).toFixed(0)
            }));
    },

    async getPurchaseStats() {
        // Analizamos OCs del mes actual
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        const { count: purchaseFrequency } = await supabase
            .from('compras_ordenes')
            .select('*', { count: 'exact', head: true })
            .gte('fecha_emision', firstDay);

        // Tiempo de ciclo (promedio días entre emisión y recepción)
        const { data: receivedOCs } = await supabase
            .from('compras_ordenes')
            .select('fecha_emision, fecha_recepcion')
            .not('fecha_recepcion', 'is', null);

        let totalDays = 0;
        let count = 0;

        if (receivedOCs) {
            receivedOCs.forEach(oc => {
                const start = new Date(oc.fecha_emision);
                const end = new Date(oc.fecha_recepcion);
                const diffTime = Math.abs(end - start);
                totalDays += diffTime;
                count++;
            });
        }

        // Convertir ms a días
        const avgDays = count > 0 ? (totalDays / count / (1000 * 60 * 60 * 24)) : 0;

        return { 
            purchaseFrequency: purchaseFrequency || 0, 
            cycleTime: avgDays.toFixed(1) 
        };
    }
};