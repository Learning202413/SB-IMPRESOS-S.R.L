/**
 * js/services/ordenes.service.js
 * Servicio de Listado de Órdenes (Supabase).
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

export const OrdenesService = {
    
    async getAllOrders() {
        // JOIN: Traemos datos del cliente y los items anidados
        const { data, error } = await supabase
            .from('ordenes')
            .select(`
                *,
                clientes ( razon_social ),
                orden_items ( producto, cantidad, precio_unitario, subtotal )
            `)
            .order('fecha_creacion', { ascending: false });

        if (error) {
            console.error("Error cargando órdenes:", error);
            return [];
        }

        // Mapeo para la vista
        return data.map(o => ({
            id: o.id,
            codigo: o.codigo,
            ot_id: o.ot_id || 'PENDIENTE',
            cliente_id: o.cliente_id,
            // Extraemos el nombre del objeto anidado 'clientes'
            cliente_nombre: o.clientes?.razon_social || 'Cliente Eliminado', 
            estado: o.estado,
            estado_facturacion: o.estado_facturacion,
            fecha_creacion: new Date(o.fecha_creacion).toLocaleDateString('es-PE'),
            total: o.total,
            items: o.orden_items || []
        }));
    },

    async deleteOrder(id) {
        const { error } = await supabase
            .from('ordenes')
            .delete()
            .eq('id', id);

        if (error) return { success: false };
        
        log('ORDEN_ELIMINADA', `Orden ID: ${id}`);
        return { success: true };
    }
};