
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

        const otIdEl = document.getElementById('task-ot-id');
        if(otIdEl) otIdEl.textContent = task.ot_id;
        
        const headerEl = document.getElementById('ot-header');
        if(headerEl) headerEl.textContent = `Terminal: ${task.ot_id}`;
        
        document.getElementById('task-client').textContent = task.cliente;
        document.getElementById('task-product').textContent = task.producto;
        document.getElementById('task-paper').textContent = task.paper;

        // Actualizar UI según tiempos
        if (task.tiempos.prep) {
            document.getElementById('time-prep-start').textContent = task.tiempos.prep;
            const btnPrep = document.getElementById('btn-start-prep');
            if(btnPrep) { btnPrep.disabled = true; btnPrep.classList.add('opacity-50'); }
            document.getElementById('btn-start-print')?.removeAttribute('disabled');
        }

        if (task.tiempos.print) {
            document.getElementById('time-print-start').textContent = task.tiempos.print;
            const btnPrint = document.getElementById('btn-start-print');
            if(btnPrint) { btnPrint.disabled = true; btnPrint.classList.add('opacity-50'); }
            document.getElementById('btn-finish-job')?.removeAttribute('disabled');
        }
    },

    setupEvents() {
        const id = this.currentTaskId;

        // CORREGIDO: Verificar respuesta del servicio antes de notificar
        document.getElementById('btn-start-prep')?.addEventListener('click', async () => {
            const res = await OperadorService.startPreparation(id);
            if (res.success) {
                if(window.UI) window.UI.showNotification('Iniciado', 'Preparación registrada.');
                this.loadData();
            } else {
                if(window.UI) window.UI.showNotification('Error', 'No se pudo guardar: ' + res.message);
            }
        });

        document.getElementById('btn-start-print')?.addEventListener('click', async () => {
            const res = await OperadorService.startPrinting(id);
            if (res.success) {
                if(window.UI) window.UI.showNotification('Iniciado', 'Impresión en curso.');
                this.loadData();
            } else {
                if(window.UI) window.UI.showNotification('Error', 'No se pudo guardar: ' + res.message);
            }
        });

        document.getElementById('btn-finish-job')?.addEventListener('click', () => {
            if (window.showFinishModal) window.showFinishModal();
        });

        // Manejo robusto de modales
        if (this._submitHandler) document.body.removeEventListener('submit', this._submitHandler);

        this._submitHandler = async (e) => {
            if (e.target && e.target.id === 'finish-form') {
                e.preventDefault();
                const consumo = document.getElementById('consumo-real')?.value || 0;
                const desperdicio = document.getElementById('desperdicio')?.value || 0;

                const res = await OperadorService.finishJob(id, consumo, desperdicio);

                if (res.success) {
                    if(window.hideFinishModal) window.hideFinishModal();
                    if(window.UI) window.UI.showNotification('Finalizado', 'OT enviada a Post-Prensa.');
                    setTimeout(() => window.location.hash = '#/cola', 1000);
                } else {
                    if(window.UI) window.UI.showNotification('Error', res.message);
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
