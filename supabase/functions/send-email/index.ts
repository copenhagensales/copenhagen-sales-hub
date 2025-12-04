import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  scheduledDateTime?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, inReplyTo, scheduledDateTime }: EmailRequest = await req.json();
    
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "to, subject and body are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = Deno.env.get('MICROSOFT_TENANT_ID');
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');

    if (!tenantId || !clientId || !clientSecret) {
      console.error("Missing Microsoft Graph credentials");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    console.log('Getting Microsoft Graph access token...');
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token request failed:', tokenResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Authentication failed: ${tokenResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // If scheduled, create a draft and schedule it
    if (scheduledDateTime) {
      console.log(`Creating scheduled email to ${to} for ${scheduledDateTime}`);
      
      // Create draft message
      const draftUrl = 'https://graph.microsoft.com/v1.0/users/job@copenhagensales.dk/messages';
      
      const draftPayload: any = {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      };

      if (inReplyTo) {
        draftPayload.internetMessageHeaders = [
          {
            name: 'In-Reply-To',
            value: inReplyTo,
          },
        ];
      }

      const draftResponse = await fetch(draftUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draftPayload),
      });

      if (!draftResponse.ok) {
        const errorText = await draftResponse.text();
        console.error('Draft creation failed:', draftResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to create draft: ${draftResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const draftData = await draftResponse.json();
      const messageId = draftData.id;

      // Schedule the send using the beta endpoint
      const scheduleUrl = `https://graph.microsoft.com/beta/users/job@copenhagensales.dk/messages/${messageId}/send`;
      
      // Update message with scheduled send time first
      const updateUrl = `https://graph.microsoft.com/beta/users/job@copenhagensales.dk/messages/${messageId}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          singleValueExtendedProperties: [
            {
              id: 'SystemTime 0x3FEF',
              value: scheduledDateTime,
            },
          ],
        }),
      });

      if (!updateResponse.ok) {
        console.log('Could not set deferred send time, sending via send endpoint with header');
      }

      // Send the message (will be deferred if property was set)
      const sendResponse = await fetch(scheduleUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!sendResponse.ok && sendResponse.status !== 202) {
        const errorText = await sendResponse.text();
        console.error('Schedule send failed:', sendResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: `Failed to schedule email: ${sendResponse.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Email scheduled successfully for', scheduledDateTime);

      return new Response(
        JSON.stringify({ status: 'scheduled', scheduledFor: scheduledDateTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email immediately via Microsoft Graph API
    console.log(`Sending email to ${to}`);
    const emailUrl = 'https://graph.microsoft.com/v1.0/users/job@copenhagensales.dk/sendMail';
    
    const emailPayload: any = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
      saveToSentItems: true,
    };

    // Add In-Reply-To header if this is a reply
    if (inReplyTo) {
      emailPayload.message.internetMessageHeaders = [
        {
          name: 'In-Reply-To',
          value: inReplyTo,
        },
      ];
    }

    const emailResponse = await fetch(emailUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Email send failed:', emailResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${emailResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully');

    return new Response(
      JSON.stringify({ status: 'sent' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-email:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
