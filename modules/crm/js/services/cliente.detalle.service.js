/**
 * js/services/cliente.detalle.service.js
 * Servicio de Detalle de Cliente (Creación/Edición) conectado a Supabase.
 * Incluye integración con APISPERU.COM para consultas.
 */
import supabase from '../../../../core/http/supabase.client.js';
import { log } from './local.db.js';

// Token para consultas de RUC/DNI
const API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImNqYXp6dGluN0BnbWFpbC5jb20ifQ.5NcXq2oQNzTUSEHiGwzZvCqY57fktdSPdBx9kjkXw8k';

export const ClienteDetalleService = {
    
    /**
     * Consulta DNI o RUC a apisperu.com
     */
    async consultarDocumento(numero) {
        if (!numero) return { success: false, message: 'Ingrese un número.' };
        
        // Detectar tipo por longitud
        const type = numero.length === 8 ? 'dni' : (numero.length === 11 ? 'ruc' : null);
        
        if (!type) {
            return { success: false, message: 'El documento debe tener 8 (DNI) u 11 (RUC) dígitos.' };
        }

        try {
            const url = `https://dniruc.apisperu.com/api/v1/${type}/${numero}?token=${API_TOKEN}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error en la API externa');

            const data = await response.json();

            // Validar si la API devolvió éxito
            if (data.success === false) {
                return { success: false, message: 'Documento no encontrado o inválido.' };
            }

            return { success: true, data: data, tipo: type };
        } catch (error) {
            console.error("Error API:", error);
            return { success: false, message: 'Error de conexión con el servicio de consulta.' };
        }
    },

    /**
     * Obtiene un cliente por ID desde Supabase
     */
    async getClientById(id) {
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            console.error("Error obteniendo cliente:", error);
            return null;
        }

        // Adaptador: La UI espera 'ruc', la BD tiene 'ruc_dni'
        return { ...data, ruc: data.ruc_dni };
    },

    /**
     * Crea un nuevo cliente en Supabase
     */
    async createClient(clientData) {
        try {
            // Mapeo de datos del Formulario -> Base de Datos
            const dbClient = {
                tipo_persona: clientData.tipo_persona,
                ruc_dni: clientData.ruc, // IMPORTANTE: Mapeo de 'ruc' a 'ruc_dni'
                razon_social: clientData.razon_social,
                nombre_contacto: clientData.nombre_contacto,
                email: clientData.email,
                telefono: clientData.telefono,
                direccion: clientData.direccion,
                departamento: clientData.departamento,
                provincia: clientData.provincia,
                distrito: clientData.distrito,
                ubigeo: clientData.ubigeo,
                estado: 'Activo'
            };

            const { data, error } = await supabase
                .from('clientes')
                .insert(dbClient)
                .select()
                .single();

            if (error) throw error;

            log('CLIENTE_CREADO', `Cliente registrado: ${clientData.razon_social}`);
            return { success: true, id: data.id };

        } catch (error) {
            console.error("Error creando cliente:", error);
            // Manejo de duplicados (código PostgreSQL 23505)
            if (error.code === '23505') {
                return { success: false, message: 'Ya existe un cliente con este RUC/DNI.' };
            }
            return { success: false, message: error.message || 'Error al guardar en base de datos.' };
        }
    },

    /**
     * Actualiza un cliente existente en Supabase
     */
    async updateClient(id, updates) {
        try {
            // Mapeo de datos para actualización
            const dbUpdates = { ...updates };
            
            // Si viene el campo 'ruc' de la UI, lo cambiamos a 'ruc_dni'
            if (dbUpdates.ruc) {
                dbUpdates.ruc_dni = dbUpdates.ruc;
                delete dbUpdates.ruc;
            }
            
            dbUpdates.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('clientes')
                .update(dbUpdates)
                .eq('id', id);

            if (error) throw error;

            log('CLIENTE_ACTUALIZADO', `Cliente ID: ${id}`);
            return { success: true };

        } catch (error) {
            console.error("Error actualizando cliente:", error);
            return { success: false, message: error.message };
        }
    }
};