/**
 * js/services/cliente.detalle.service.js
 * Servicio actualizado con integración a APISPERU.COM
 */
import { getStorage, setStorage, log } from './local.db.js';

const SEED_CLIENTS = [
    { id: '1', ruc: '20123456789', razon_social: 'Industrias Gráficas S.A.', nombre_contacto: 'Carlos Pérez', email: 'carlos.perez@ig.com', telefono: '+51 987 654 321', estado: 'Activo', direccion: 'Av. Industrial 123', ubigeo: '120101' },
    { id: '2', ruc: '10987654321', razon_social: 'Editorial Futuro EIRL', nombre_contacto: 'Elena Ríos', email: 'erios@editorial.pe', telefono: '+51 900 111 222', estado: 'Activo', direccion: 'Jr. Los Andes 456', ubigeo: '120101' }
];

const DB_KEY = 'crm_clients';
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
            if (!response.ok) throw new Error('Error en la API');

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

    async getClientById(id) {
        return new Promise(resolve => {
            const clients = getStorage(DB_KEY, SEED_CLIENTS);
            const found = clients.find(c => c.id === id);
            setTimeout(() => resolve(found || null), 100);
        });
    },

    async createClient(clientData) {
        const clients = getStorage(DB_KEY, SEED_CLIENTS);
        const newClient = { 
            ...clientData, 
            id: Date.now().toString(), 
            estado: 'Activo'
        };
        clients.push(newClient);
        setStorage(DB_KEY, clients);
        log('CLIENTE_CREADO', `Nombre: ${newClient.razon_social}`);
        return { success: true, id: newClient.id };
    },

    async updateClient(id, updates) {
        let clients = getStorage(DB_KEY, SEED_CLIENTS);
        const index = clients.findIndex(c => c.id === id);
        
        if (index === -1) return { success: false, message: 'Cliente no encontrado' };

        clients[index] = { ...clients[index], ...updates };
        setStorage(DB_KEY, clients);
        log('CLIENTE_ACTUALIZADO', `ID: ${id}`);
        return { success: true };
    }
};