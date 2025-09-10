/**
 * Event-related hooks with proper error handling and caching
 */
import { useAuth } from '@/components/AuthProvider';
import { EventService, type Event } from '@/services/events';
import { useApiQuery, useApiMutation } from '@/hooks/useApiQuery';
import { toast } from 'sonner';

export function useEvent(eventId: string | undefined) {
  const { user } = useAuth();

  return useApiQuery(
    ['event', eventId],
    () => {
      if (!eventId) throw new Error('Event ID required');
      return EventService.getEventById(eventId);
    },
    {
      enabled: !!eventId,
      errorMessage: "Errore nel caricamento dell'evento"
    }
  );
}

export function useUserEvents() {
  const { user } = useAuth();

  return useApiQuery(
    ['user-events', user?.id],
    async () => {
      if (!user) return [];
      return EventService.getUserEvents(user.id);
    },
    {
      enabled: !!user,
      errorMessage: "Errore nel caricamento degli eventi"
    }
  );
}

export function useEventRole(eventId: string | undefined) {
  const { user } = useAuth();

  return useApiQuery(
    ['event-role', eventId, user?.id],
    async () => {
      if (!eventId || !user) {
        return { isMember: false, role: 'member', participantId: null };
      }
      return EventService.getUserEventRole(eventId, user.id);
    },
    {
      enabled: !!eventId && !!user,
      errorMessage: "Errore nel verificare i permessi"
    }
  );
}

export function useDeleteEvent() {
  const { user } = useAuth();

  return useApiMutation(
    (eventId: string) => {
      if (!user) throw new Error('Authentication required');
      return EventService.deleteEvent(eventId, user.id);
    },
    {
      onSuccess: () => {
        toast.success("Evento eliminato con successo");
      },
      invalidateQueries: [['user-events']],
      errorMessage: "Errore nell'eliminazione dell'evento"
    }
  );
}