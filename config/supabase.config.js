/**
 * config/supabase.config.js
 * Archivo de configuración central.
 * Define y exporta las constantes de Supabase.
 */

// ** VARIABLES GLOBALES PARA SUPABASE **
// Estas variables (ej. __SUPABASE_URL) son reemplazadas por el entorno de despliegue.
export const SUPABASE_URL = typeof __SUPABASE_URL !== 'undefined' 
    ? __SUPABASE_URL 
    : 'https://yrrnwttfpxybfiyyieaz.supabase.co';

export const SUPABASE_ANON_KEY = typeof __SUPABASE_KEY !== 'undefined' 
    ? __SUPABASE_KEY 
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlycm53dHRmcHh5YmZpeXlpZWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5ODQwMjIsImV4cCI6MjA3OTU2MDAyMn0.RcTqg6mQcM5qQx6TIsTUnBphFxsEt0Mu8bCzid_0LVY';