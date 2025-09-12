/**
 * Event service - centralized event operations
 */
import { supabase } from '@/integrations/supabase/client';
import { ApiService } from './api';
import { ParticipantService } from './participants';

export type Event = {
  id: string;
  name: string;
  date: string | null;
  budget: number | null;
  draw_status: string;
  amazon_marketplace: string;
  join_code: string;
  created_at: string;
  cover_image_url?: string | null;
  admin_profile_id: string;
  draw_date?: string | null;
};

export type EventMember = {
  id: string;
  role: string;
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: string;
  participant_id: string;
  event_id: string;
  display_name?: string | null;
};

export class EventService {
  /**
   * Get event details by ID
   */
  static async getEventById(eventId: string): Promise<Event | null> {
    try {
      return await ApiService.supabaseQuery(
        'get_event_by_id',
        async () => {
          const result = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();
          return result;
        }
      );
    } catch {
      return null;
    }
  }

  /**
   * Get user's events
   */
  static async getUserEvents(userId: string): Promise<Event[]> {
    const participantId = await ParticipantService.getParticipantByProfileId(userId);
    
    if (!participantId) {
      // User has no participant record, check admin events
      const adminEvents = await ApiService.supabaseQuery(
        'get_admin_events',
        async () => {
          const result = await supabase
            .from('events')
            .select('*')
            .eq('admin_profile_id', userId)
            .order('created_at', { ascending: false });
          return result;
        }
      );
      return adminEvents || [];
    }

    // Get events where user is a member
    const userEvents = await ApiService.supabaseQuery(
      'get_user_events',
      async () => {
        const result = await supabase
          .from('events')
          .select(`
            *,
            event_members!inner(participant_id)
          `)
          .eq('event_members.participant_id', participantId)
          .order('created_at', { ascending: false });
        return result;
      }
    );
    return userEvents || [];
  }

  /**
   * Get event members
   */
  static async getEventMembers(eventId: string): Promise<EventMember[]> {
    const members = await ApiService.supabaseQuery(
      'get_event_members',
      async () => {
        const result = await supabase
          .from('event_members')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true });
        return result;
      }
    );
    return members || [];
  }

  /**
   * Check user membership and role in event
   */
  static async getUserEventRole(eventId: string, userId: string): Promise<{ 
    isMember: boolean; 
    role: string; 
    participantId: string | null; 
  }> {
    try {
      const participantId = await ParticipantService.getOrCreateParticipantId(userId);
      
      const membership = await ApiService.supabaseQuery(
        'get_user_event_role',
        async () => {
          const result = await supabase
            .from('event_members')
            .select('role')
            .eq('event_id', eventId)
            .eq('participant_id', participantId)
            .maybeSingle();
          return result;
        }
      );

      if (membership && typeof membership === 'object' && 'role' in membership) {
        return {
          isMember: true,
          role: (membership as any).role || 'member',
          participantId
        };
      }

      // Check if user is admin
      const event = await this.getEventById(eventId);
      const isAdmin = event?.admin_profile_id === userId;
      
      return {
        isMember: isAdmin,
        role: isAdmin ? 'admin' : 'member',
        participantId
      };
    } catch (error) {
      ApiService.handleError(error, 'get_user_event_role');
      return {
        isMember: false,
        role: 'member',
        participantId: null
      };
    }
  }

  /**
   * Auto-join user to event if they're admin
   */
  static async autoJoinEvent(
    eventId: string, 
    userId: string, 
    participantId: string,
    displayName: string
  ): Promise<EventMember> {
    const event = await this.getEventById(eventId);
    const desiredRole = event?.admin_profile_id === userId ? 'admin' : 'member';

    return ApiService.supabaseQuery(
      'auto_join_event',
      async () => {
        const result = await supabase
          .from('event_members')
          .insert({
            event_id: eventId,
            participant_id: participantId,
            role: desiredRole,
            status: 'invited',
            anonymous_name: displayName
          })
          .select('*')
          .single();
        return result;
      }
    );
  }

  /**
   * Delete event (admin only)
   */
  static async deleteEvent(eventId: string, userId: string): Promise<void> {
    const event = await this.getEventById(eventId);
    
    if (!event || event.admin_profile_id !== userId) {
      throw new Error('Non autorizzato a eliminare questo evento');
    }

    await ApiService.supabaseQuery(
      'delete_event',
      async () => {
        const result = await supabase
          .from('events')
          .delete()
          .eq('id', eventId);
        return result;
      }
    );
  }
}