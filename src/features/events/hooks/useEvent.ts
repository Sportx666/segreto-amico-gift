/**
 * Event-related hooks with proper error handling and caching
 */
import { useAuth } from '@/components/AuthProvider';
import { EventService, type Event } from '@/services/events';
import { useApiQuery, useApiMutation } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';

export function useEvent(eventId: string | undefined) {
  const { user } = useAuth();
  const { t } = useI18n();

  return useApiQuery(
    ['event', eventId],
    () => {
      if (!eventId) throw new Error('Event ID required');
      return EventService.getEventById(eventId);
    },
    {
      enabled: !!eventId,
      errorMessage: t('toasts.load_event_error')
    }
  );
}

export function useUserEvents() {
  const { user } = useAuth();
  const { t } = useI18n();

  return useApiQuery(
    ['user-events', user?.id],
    async () => {
      if (!user) return [];
      return EventService.getUserEvents(user.id);
    },
    {
      enabled: !!user,
      errorMessage: t('toasts.load_events_error')
    }
  );
}

export function useEventRole(eventId: string | undefined) {
  const { user } = useAuth();
  const { t } = useI18n();

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
      errorMessage: t('toasts.check_permissions_error')
    }
  );
}

export function useDeleteEvent() {
  const { user } = useAuth();
  const { t } = useI18n();

  return useApiMutation(
    (eventId: string) => {
      if (!user) throw new Error('Authentication required');
      return EventService.deleteEvent(eventId, user.id);
    },
    {
      onSuccess: () => {
        toast.success(t('toasts.event_deleted'));
      },
      invalidateQueries: [['user-events']],
      errorMessage: t('toasts.delete_event_error')
    }
  );
}
