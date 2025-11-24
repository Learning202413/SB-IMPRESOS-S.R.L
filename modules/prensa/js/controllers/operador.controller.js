import { OperadorService } from '../services/operador.service.js';

export const OperadorController = {
    currentTaskId: null,

    init: async function(params) {
        this.currentTaskId = params[0];
        console.log(`OperadorController: ID ${this.currentTaskId}`);
        if (this.currentTaskId) {
            await this.loadData();
            this.setupEvents();
        }
    },

    async loadData() {
        const task = await OperadorService.getTaskById(this.currentTaskId);
        if (!task) return;

        // Renderizar Info Básica
        const otIdEl = document.getElementById('task-ot-id');
        if(otIdEl) otIdEl.textContent = task.ot_id;
        
        const headerEl = document.getElementById('ot-header');
        if(headerEl) headerEl.textContent = `Terminal: ${task.ot_id}`;
        
        const clientEl = document.getElementById('task-client');
        if(clientEl) clientEl.textContent = task.cliente;
        
        const prodEl = document.getElementById('task-product');
        if(prodEl) prodEl.textContent = task.producto;
        
        const paperEl = document.getElementById('task-paper');
        if(paperEl) paperEl.textContent = task.paper;

        // Actualizar estado de botones y tiempos
        if (task.tiempos.prep) {
            const timePrep = document.getElementById('time-prep-start');
            if(timePrep) timePrep.textContent = task.tiempos.prep;
            
            const btnPrep = document.getElementById('btn-start-prep');
            if(btnPrep) {
                btnPrep.disabled = true;
                btnPrep.classList.add('opacity-50');
            }
            document.getElementById('btn-start-print')?.removeAttribute('disabled');
        }

        if (task.tiempos.print) {
            const timePrint = document.getElementById('time-print-start');
            if(timePrint) timePrint.textContent = task.tiempos.print;
            
            const btnPrint = document.getElementById('btn-start-print');
            if(btnPrint) {
                btnPrint.disabled = true;
                btnPrint.classList.add('opacity-50');
            }
            document.getElementById('btn-finish-job')?.removeAttribute('disabled');
        }
    },

    setupEvents() {
        const id = this.currentTaskId;

        // 1. Preparación
        document.getElementById('btn-start-prep')?.addEventListener('click', async () => {
            await OperadorService.startPreparation(id);
            if(window.UI) window.UI.showNotification('Estado Actualizado', 'Preparación iniciada.');
            this.loadData();
        });

        // 2. Impresión
        document.getElementById('btn-start-print')?.addEventListener('click', async () => {
            await OperadorService.startPrinting(id);
            if(window.UI) window.UI.showNotification('Estado Actualizado', 'Impresión en curso.');
            this.loadData();
        });

        // 3. Botón "Listo para Post-Prensa" (Abre el modal)
        document.getElementById('btn-finish-job')?.addEventListener('click', () => {
            // Intenta usar la función global específica si existe
            if (window.UI && typeof window.UI.showFinishModal === 'function') {
                window.UI.showFinishModal(); 
            } else {
                // Fallback: Usar el contenedor genérico
                const genericContainer = document.getElementById('modal-container'); 
                const contentTemplate = document.getElementById('finish-modal-content'); 

                if (genericContainer && contentTemplate) {
                    genericContainer.innerHTML = contentTemplate.innerHTML;
                    genericContainer.classList.remove('hidden');
                }
            }
        });

        // ========================================================================
        // DELEGACIÓN DE EVENTOS (SOLUCIÓN ROBUSTA)
        // ========================================================================
        
        // Removemos listener previo si existiera para evitar duplicados (opcional pero buena práctica)
        if (this._submitHandler) {
            document.body.removeEventListener('submit', this._submitHandler);
        }

        this._submitHandler = async (e) => {
            // A. Caso: Formulario de Finalizar Tarea
            if (e.target && e.target.id === 'finish-form') {
                e.preventDefault();
                
                const consumo = document.getElementById('consumo-real')?.value || 0;
                const desperdicio = document.getElementById('desperdicio')?.value || 0;

                // 1. Guardar datos
                await OperadorService.finishJob(id, consumo, desperdicio);

                // 2. CERRAR MODALES (Corrección Aquí: Forzar cierre de todos los posibles contenedores)
                const genericModal = document.getElementById('modal-container');
                const specificModal = document.getElementById('finish-modal-container'); 
                
                if (genericModal) genericModal.classList.add('hidden');
                if (specificModal) specificModal.classList.add('hidden');
                
                // También llamar al helper de UI si existe para limpiar estado interno
                if (window.UI && window.UI.hideModal) {
                    window.UI.hideModal('modal-container');
                    window.UI.hideModal('finish-modal-container');
                }

                // 3. Mostrar Notificación y Redirigir
                if(window.UI) window.UI.showNotification('Finalizado', 'OT enviada a Post-Prensa.');
                
                setTimeout(() => {
                    window.location.hash = '#/cola';
                }, 1000);
            }

            // B. Caso: Formulario de Incidencia
            if (e.target && e.target.id === 'incident-form') {
                e.preventDefault();
                
                const type = document.getElementById('incident-type')?.value || 'General';
                const details = document.getElementById('incident-details')?.value || '';
                
                await OperadorService.reportIncident(id, details, type);
                
                // Cerrar Modales de Incidencia
                const genericModal = document.getElementById('modal-container');
                const incidentModal = document.getElementById('incident-modal-container');
                
                if (genericModal) genericModal.classList.add('hidden');
                if (incidentModal) incidentModal.classList.add('hidden');

                if(window.UI) window.UI.showNotification('Incidencia', 'Reporte guardado.');
            }
        };

        document.body.addEventListener('submit', this._submitHandler);
    }
};