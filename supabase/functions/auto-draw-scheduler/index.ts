import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current date
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find events scheduled for auto-draw today with draw_date set to today and not yet completed
    const { data: events, error: eventsError } = await supabaseClient
      .from('events')
      .select('id, name, draw_status')
      .eq('draw_date', today.toISOString().split('T')[0])
      .eq('draw_status', 'pending')

    if (eventsError) {
      throw eventsError
    }

    const results = []

    for (const event of events || []) {
      try {
        // Check if event has enough participants
        const { data: members } = await supabaseClient
          .from('event_members')
          .select('id')
          .eq('event_id', event.id)
          .eq('status', 'joined')

        if (!members || members.length < 2) {
          results.push({
            eventId: event.id,
            status: 'skipped',
            reason: 'Not enough participants'
          })
          continue
        }

        // Perform the draw by calling the existing draw function
        const { data: drawResult, error: drawError } = await supabaseClient.functions.invoke('draw', {
          body: { eventId: event.id }
        })

        if (drawError) {
          throw drawError
        }

        // Send notifications to all participants
        const { data: participantMembers } = await supabaseClient
          .from('event_members')
          .select('participant_id, anonymous_name')
          .eq('event_id', event.id)
          .eq('status', 'joined')

        for (const member of participantMembers || []) {
          const { data: participant } = await supabaseClient
            .from('participants')
            .select('profile_id')
            .eq('id', member.participant_id)
            .single()

          if (participant?.profile_id) {
            await supabaseClient
              .from('notifications')
              .insert({
                profile_id: participant.profile_id,
                type: 'assignment',
                title: 'Sorteggio Automatico Completato',
                body: `Il sorteggio per l'evento "${event.name}" è stato completato automaticamente. Controlla il tuo abbinamento!`
              })
          }
        }

        results.push({
          eventId: event.id,
          status: 'completed',
          assignedCount: drawResult.assignedCount
        })

      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error)
        results.push({
          eventId: event.id,
          status: 'error',
          error: error.message
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Auto-draw scheduler error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    )
  }
})