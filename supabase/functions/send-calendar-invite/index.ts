import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarInviteRequest {
  recipientEmail: string;
  subject: string;
  startDateTime: string;
  durationMinutes: number;
  attendees: { name: string; email: string }[];
  description?: string;
}

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("MICROSOFT_TENANT_ID");
  const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
  const clientSecret = Deno.env.get("MICROSOFT_CLIENT_SECRET");

  console.log("Getting Microsoft Graph access token...");

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token fetch failed:", errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json();
  console.log("Access token obtained successfully");
  return data.access_token;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      recipientEmail,
      subject,
      startDateTime,
      durationMinutes,
      attendees,
      description,
    }: CalendarInviteRequest = await req.json();

    console.log("Creating calendar invite:", {
      recipientEmail,
      subject,
      startDateTime,
      durationMinutes,
      attendeeCount: attendees.length,
    });

    const accessToken = await getAccessToken();

    // Calculate end time
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    // Create the event via Microsoft Graph
    const eventPayload = {
      subject,
      body: {
        contentType: "HTML",
        content: description || `Jobsamtale med ${attendees.map(a => a.name).join(", ")}`,
      },
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "Europe/Copenhagen",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "Europe/Copenhagen",
      },
      attendees: [
        {
          emailAddress: {
            address: recipientEmail,
            name: recipientEmail,
          },
          type: "required",
        },
        ...attendees.map((a) => ({
          emailAddress: {
            address: a.email,
            name: a.name,
          },
          type: "required",
        })),
      ],
      isOnlineMeeting: false,
    };

    // Send the calendar event using the shared mailbox
    const graphUrl = `https://graph.microsoft.com/v1.0/users/job@copenhagensales.dk/calendar/events`;
    
    const response = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to create calendar event:", errorText);
      throw new Error(`Failed to create calendar event: ${errorText}`);
    }

    const event = await response.json();
    console.log("Calendar event created successfully:", event.id);

    return new Response(
      JSON.stringify({ success: true, eventId: event.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-calendar-invite:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
