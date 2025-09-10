/**
 * Centralized API service layer for remote calls with debug tracing
 */
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ApiError = {
  code: string;
  message: string;
  details?: any;
};

type TraceCategory = 'rls_error' | 'network_error' | 'parse_error' | 'validation_error' | 'unique_violation';

const isTraceEnabled = () => {
  return import.meta.env.VITE_DB_TRACE === '1' || import.meta.env.VITE_DB_TRACE === 'true';
};

function traceLog(category: TraceCategory, operation: string, data?: any) {
  if (!isTraceEnabled()) return;
  
  // Sanitize data to remove PII
  const sanitized = sanitizeForTrace(data);
  console.groupCollapsed(`[DB_TRACE] ${category.toUpperCase()} - ${operation}`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Category:', category);
  console.log('Operation:', operation);
  if (sanitized) {
    console.log('Data:', sanitized);
  }
  console.groupEnd();
}

function sanitizeForTrace(data: any): any {
  if (!data) return data;
  
  // Remove or mask potential PII fields
  const piiFields = ['email', 'phone', 'address', 'postal_code'];
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    
    piiFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[MASKED]';
      }
    });
    
    // Recursively sanitize nested objects
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeForTrace(sanitized[key]);
      }
    });
    
    return sanitized;
  }
  
  return data;
}

function categorizeError(error: any): TraceCategory {
  const errorString = String(error?.message || error || '').toLowerCase();
  
  if (errorString.includes('rls') || errorString.includes('policy') || errorString.includes('permission')) {
    return 'rls_error';
  }
  if (errorString.includes('unique') || errorString.includes('duplicate')) {
    return 'unique_violation';
  }
  if (errorString.includes('network') || errorString.includes('fetch')) {
    return 'network_error';
  }
  if (errorString.includes('parse') || errorString.includes('json')) {
    return 'parse_error';
  }
  
  return 'validation_error';
}

export class ApiService {
  /**
   * Wrapper for Supabase operations with error tracing
   */
  static async supabaseQuery<T>(
    operation: string,
    queryFn: () => Promise<{ data: T | null; error: any }>
  ): Promise<T> {
    try {
      const result = await queryFn();
      
      if (result.error) {
        const category = categorizeError(result.error);
        traceLog(category, operation, { error: result.error });
        throw new Error(result.error.message || 'Database operation failed');
      }
      
      traceLog('validation_error', `${operation}_success`, { hasData: !!result.data });
      return result.data as T;
    } catch (error) {
      const category = categorizeError(error);
      traceLog(category, operation, { error });
      throw error;
    }
  }

  /**
   * Wrapper for fetch operations with error tracing
   */
  static async fetchRequest<T>(
    operation: string,
    url: string,
    options?: RequestInit
  ): Promise<T> {
    try {
      traceLog('network_error', `${operation}_start`, { url, method: options?.method || 'GET' });
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        traceLog('network_error', operation, { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      traceLog('network_error', `${operation}_success`, { status: response.status });
      return data;
    } catch (error) {
      const category = error instanceof SyntaxError ? 'parse_error' : 'network_error';
      traceLog(category, operation, { error });
      throw error;
    }
  }

  /**
   * Generic error handler with user-friendly messages
   */
  static handleError(error: any, context: string, userMessage?: string) {
    const category = categorizeError(error);
    traceLog(category, context, { error });
    
    const defaultMessage = userMessage || 'Si è verificato un errore imprevisto';
    
    // Show user-friendly error messages
    if (category === 'rls_error') {
      toast.error('Accesso negato. Verifica i tuoi permessi.');
    } else if (category === 'unique_violation') {
      toast.error('Elemento già esistente.');
    } else if (category === 'network_error') {
      toast.error('Errore di connessione. Riprova più tardi.');
    } else {
      toast.error(defaultMessage);
    }
    
    console.error(`[${context}]`, error);
  }
}

export { type ApiError, type TraceCategory };