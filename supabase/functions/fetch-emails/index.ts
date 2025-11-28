import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tenantId = Deno.env.get('MICROSOFT_TENANT_ID');
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Fetch unread emails from inbox
    console.log('Fetching unread emails from inbox...');
    const messagesUrl = 'https://graph.microsoft.com/v1.0/users/job@copenhagensales.dk/mailFolders/inbox/messages?$filter=isRead eq false&$top=50&$select=id,subject,from,receivedDateTime,bodyPreview,body,internetMessageId';

    const messagesResponse = await fetch(messagesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error('Failed to fetch messages:', messagesResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch emails: ${messagesResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messagesData = await messagesResponse.json();
    const emails = messagesData.value || [];
    
    console.log(`Found ${emails.length} unread emails`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    let processedCount = 0;
    let skippedCount = 0;

    for (const email of emails) {
      const fromEmail = email.from?.emailAddress?.address;
      const fromName = email.from?.emailAddress?.name || fromEmail;
      
      if (!fromEmail) {
        console.log('Skipping email without sender address');
        skippedCount++;
        continue;
      }

      // Find candidate by email
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', fromEmail)
        .limit(1);

      if (!candidates || candidates.length === 0) {
        console.log(`No candidate found with email ${fromEmail}`);
        skippedCount++;
        continue;
      }

      const candidateId = candidates[0].id;

      // Find most recent application for this candidate
      const { data: applications } = await supabase
        .from('applications')
        .select('id')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!applications || applications.length === 0) {
        console.log(`No application found for candidate ${candidateId}`);
        skippedCount++;
        continue;
      }

      const applicationId = applications[0].id;

      // Check if email already logged (by internetMessageId)
      const { data: existing } = await supabase
        .from('communication_logs')
        .select('id')
        .eq('application_id', applicationId)
        .eq('type', 'email')
        .eq('content', email.internetMessageId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Email ${email.internetMessageId} already logged`);
        skippedCount++;
        continue;
      }

      // Log the inbound email - store internetMessageId in content field for deduplication
      // Store actual body in outcome field temporarily
      const emailBody = email.body?.content || email.bodyPreview || '';
      const { error: logError } = await supabase
        .from('communication_logs')
        .insert({
          application_id: applicationId,
          type: 'email',
          direction: 'inbound',
          content: email.internetMessageId, // Use for deduplication
          outcome: `Subject: ${email.subject}\n\nFrom: ${fromName} <${fromEmail}>\n\n${emailBody}`, // Store full email content here
        });

      if (logError) {
        console.error('Error logging email:', logError);
        continue;
      }

      console.log(`Email logged for application ${applicationId}`);
      processedCount++;

      // Mark email as read in Microsoft Graph
      const markReadUrl = `https://graph.microsoft.com/v1.0/users/job@copenhagensales.dk/messages/${email.id}`;
      await fetch(markReadUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isRead: true }),
      });
    }

    console.log(`Processed ${processedCount} emails, skipped ${skippedCount}`);

    return new Response(
      JSON.stringify({ 
        processed: processedCount, 
        skipped: skippedCount,
        total: emails.length 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-emails:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
