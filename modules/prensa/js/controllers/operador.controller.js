/**
 * js/controllers/operador.controller.js
 * Controlador de Operador de Prensa.
 * CORRECCIÓN: Actualización inmediata de la UI y validación robusta de estado.
 */
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

        // Renderizar datos básicos
        const otIdEl = document.getElementById('task-ot-id');
        if(otIdEl) otIdEl.textContent = task.ot_id;
        
        const headerEl = document.getElementById('ot-header');
        if(headerEl) headerEl.textContent = `Terminal: ${task.ot_id}`;
        
        document.getElementById('task-client').textContent = task.cliente || '-';
        document.getElementById('task-product').textContent = task.producto || '-';
        document.getElementById('task-paper').textContent = task.paper || '-';

        // --- LÓGICA DE ESTADOS CORREGIDA ---
        // Validamos si existe el tiempo O si el estado ya es 'En Preparación' (fallback)
        const isPrepStarted = task.tiempos.prep || task.estado_prensa === 'En Preparación';
        const isPrintStarted = task.tiempos.print || task.estado_prensa === 'Imprimiendo';
        const isFinished = task.estado_prensa === 'En Post-Prensa' || task.estado_prensa === 'Completado';

        if (isPrepStarted) {
            document.getElementById('time-prep-start').textContent = task.tiempos.prep || 'Iniciado';
            const btnPrep = document.getElementById('btn-start-prep');
            if(btnPrep) { 
                btnPrep.disabled = true; 
                btnPrep.classList.add('opacity-50', 'cursor-not-allowed'); 
            }
            
            // Habilitar el siguiente botón solo si no se ha iniciado impresión aún
            const btnPrint = document.getElementById('btn-start-print');
            if (btnPrint && !isPrintStarted) {
                btnPrint.disabled = false;
                btnPrint.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        if (isPrintStarted) {
            document.getElementById('time-print-start').textContent = task.tiempos.print || 'Iniciado';
            const btnPrint = document.getElementById('btn-start-print');
            if(btnPrint) { 
                btnPrint.disabled = true; 
                btnPrint.classList.add('opacity-50', 'cursor-not-allowed'); 
            }
            
            const btnFinish = document.getElementById('btn-finish-job');
            if (btnFinish && !isFinished) {
                btnFinish.disabled = false;
                btnFinish.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    },

    setupEvents() {
        const id = this.currentTaskId;

        // 1. BOTÓN PREPARACIÓN
        document.getElementById('btn-start-prep')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-start-prep');
            const originalContent = btn.innerHTML;
            
            // Feedback visual de carga
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>';
            if(window.lucide) window.lucide.createIcons();

            const res = await OperadorService.startPreparation(id);
            
            if (res.success) {
                if(window.UI) window.UI.showNotification('Iniciado', 'Preparación registrada.');
                
                // FEEDBACK VISUAL INMEDIATO (Antes de recargar data)
                btn.innerHTML = originalContent;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                
                const btnPrint = document.getElementById('btn-start-print');
                if(btnPrint) {
                    btnPrint.disabled = false;
                    btnPrint.classList.remove('opacity-50', 'cursor-not-allowed');
                }

                // Recarga datos en segundo plano para asegurar consistencia
                this.loadData(); 
            } else {
                if(window.UI) window.UI.showNotification('Error', 'No se pudo guardar: ' + res.message);
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        });

        // 2. BOTÓN IMPRESIÓN
        document.getElementById('btn-start-print')?.addEventListener('click', async () => {
            const btn = document.getElementById('btn-start-print');
            const originalContent = btn.innerHTML;
            
            btn.disabled = true;
            btn.innerHTML = '<i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>';
            if(window.lucide) window.lucide.createIcons();

            const res = await OperadorService.startPrinting(id);
            
            if (res.success) {
                if(window.UI) window.UI.showNotification('Iniciado', 'Impresión en curso.');
                
                // Feedback Inmediato
                btn.innerHTML = originalContent;
                btn.classList.add('opacity-50', 'cursor-not-allowed');

                const btnFinish = document.getElementById('btn-finish-job');
                if(btnFinish) {
                    btnFinish.disabled = false;
                    btnFinish.classList.remove('opacity-50', 'cursor-not-allowed');
                }

                this.loadData();
            } else {
                if(window.UI) window.UI.showNotification('Error', 'No se pudo guardar: ' + res.message);
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
        });

        // 3. BOTÓN FINALIZAR (Abre Modal)
        document.getElementById('btn-finish-job')?.addEventListener('click', () => {
            if (window.showFinishModal) window.showFinishModal();
        });

        // Manejo de Submit de Modales (Evita listeners duplicados)
        if (this._submitHandler) document.body.removeEventListener('submit', this._submitHandler);

        this._submitHandler = async (e) => {
            if (e.target && e.target.id === 'finish-form') {
                e.preventDefault();
                const btn = document.getElementById('confirm-finish-button');
                const originalText = btn.innerHTML;
                btn.disabled = true; btn.textContent = 'Enviando...';

                const consumo = document.getElementById('consumo-real')?.value || 0;
                const desperdicio = document.getElementById('desperdicio')?.value || 0;

                const res = await OperadorService.finishJob(id, consumo, desperdicio);

                if (res.success) {
                    if(window.hideFinishModal) window.hideFinishModal();
                    if(window.UI) window.UI.showNotification('Finalizado', 'OT enviada a Post-Prensa.');
                    setTimeout(() => window.location.hash = '#/cola', 1000);
                } else {
                    if(window.UI) window.UI.showNotification('Error', res.message);
                    btn.disabled = false; btn.innerHTML = originalText;
                }
            }

            if (e.target && e.target.id === 'incident-form') {
                e.preventDefault();
                const type = document.getElementById('incident-type')?.value;
                const details = document.getElementById('incident-details')?.value;
                
                const res = await OperadorService.reportIncident(id, details, type);
                
                if (res.success) {
                    if(window.hideIncidentModal) window.hideIncidentModal();
                    if(window.UI) window.UI.showNotification('Incidencia', 'Reporte guardado.');
                } else {
                    if(window.UI) window.UI.showNotification('Error', 'Error al guardar incidencia.');
                }
            }
        };
        document.body.addEventListener('submit', this._submitHandler);
    }
};