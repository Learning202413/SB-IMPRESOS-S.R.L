/**
 * js/services/dashboard.service.js
 * KPIs CRM en tiempo real con Supabase.
 */
import supabase from '../../../../core/http/supabase.client.js';

export const DashboardService = {
    
    async getKpiStats() {
        try {
            // 1. Cotizaciones Activas
            const { count: activeQuotes } = await supabase
                .from('ordenes')
                .select('*', { count: 'exact', head: true })
                .in('estado', ['Nueva', 'En Negociación']);

            // 2. Rechazadas
            const { count: totalRejected } = await supabase
                .from('ordenes')
                .select('*', { count: 'exact', head: true })
                .in('estado', ['Rechazada', 'Cancelada']);

            // 3. Completadas
            const { count: totalCompleted } = await supabase
                .from('ordenes')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'Completado');

            // 4. En Producción (Calculado por exclusión o lista explícita)
            // Lista explícita de estados productivos para ser precisos
            const productionStates = [
                'Orden creada', 'Diseño Pendiente', 'En diseño', 'En Aprobación de Cliente',
                'Diseño Aprobado', 'Cambios Solicitados', 'En Pre-prensa', 'Asignada a Prensa',
                'En Preparación', 'Imprimiendo', 'En proceso', 'En prensa',
                'En Post-Prensa', 'En Acabados', 'En Control de Calidad'
            ];
            
            const { count: activeProduction } = await supabase
                .from('ordenes')
                .select('*', { count: 'exact', head: true })
                .in('estado', productionStates);

            return {
                activeQuotes: activeQuotes || 0,
                activeProduction: activeProduction || 0,
                totalRejected: totalRejected || 0,
                totalCompleted: totalCompleted || 0
            };

        } catch (error) {
            console.error("Error KPIs:", error);
            return { activeQuotes:0, activeProduction:0, totalRejected:0, totalCompleted:0 };
        }
    }
};