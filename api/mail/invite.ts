import { createServiceClient } from '../_supabase.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: any, res: any) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({}, { headers: corsHeaders });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, eventId, participantId, joinUrl } = req.body;
  if (!email || !eventId || !participantId || !joinUrl) {
    return res.status(400).json({ error: 'email, eventId, participantId, and joinUrl are required' });
  }

  // Verify user is admin of the event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('admin_profile_id, name')
    .eq('id', eventId)
    .single();
  
  if (eventError || !event) {
    return res.status(404).json({ error: 'Event not found' });
  }
  
  if (event.admin_profile_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Check if email service is configured
import { config } from '@/config/env';

  const resendApiKey = config.email.provider === 'resend' ? config.email.apiKey : undefined;
  const sendgridApiKey = config.email.provider === 'sendgrid' ? config.email.apiKey : undefined;

  if (!resendApiKey && !sendgridApiKey) {
    console.log('No email service configured - email would be sent to:', email);
    console.log('Join URL:', joinUrl);
    return res.status(204).json({});
  }

  try {
    if (resendApiKey) {
      // Send via Resend
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Amico Segreto <noreply@amicosegreto.lovable.app>',
          to: [email],
          subject: 'Invito Amico Segreto',
          html: `
            <h1>Sei stato invitato a partecipare!</h1>
            <p>Ciao! Sei stato invitato a partecipare all'evento "<strong>${event.name}</strong>".</p>
            <p>Clicca sul link qui sotto per unirti:</p>
            <p><a href="${joinUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Unisciti all'evento</a></p>
            <p>Oppure copia e incolla questo link nel tuo browser:</p>
            <p>${joinUrl}</p>
            <p>Non vediamo l'ora di vederti partecipare!</p>
          `,
        }),
      });

      if (!resendResponse.ok) {
        const errorText = await resendResponse.text();
        console.error('Resend API error:', errorText);
        throw new Error('Failed to send email via Resend');
      }

      const resendData = await resendResponse.json();
      console.log('Email sent via Resend:', resendData);
      
    } else if (sendgridApiKey) {
      // Send via SendGrid
      const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email }],
            subject: 'Invito Amico Segreto',
          }],
          from: { email: 'noreply@amicosegreto.lovable.app', name: 'Amico Segreto' },
          content: [{
            type: 'text/html',
            value: `
              <h1>Sei stato invitato a partecipare!</h1>
              <p>Ciao! Sei stato invitato a partecipare all'evento "<strong>${event.name}</strong>".</p>
              <p>Clicca sul link qui sotto per unirti:</p>
              <p><a href="${joinUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Unisciti all'evento</a></p>
              <p>Oppure copia e incolla questo link nel tuo browser:</p>
              <p>${joinUrl}</p>
              <p>Non vediamo l'ora di vederti partecipare!</p>
            `,
          }],
        }),
      });

      if (!sendgridResponse.ok) {
        const errorText = await sendgridResponse.text();
        console.error('SendGrid API error:', errorText);
        throw new Error('Failed to send email via SendGrid');
      }

      console.log('Email sent via SendGrid');
    }

    return res.status(200).json({ success: true, message: 'Email sent successfully' });

  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}