import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZapierApplicationData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: 'fieldmarketing' | 'salgskonsulent';
  status?: 'ansat' | 'udskudt_samtale' | 'ikke_kvalificeret' | 'ikke_ansat' | 'startet' | 'ny_ansoegning';
  source?: string;
  notes?: string;
  cv_url?: string;
  cover_letter_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const data: ZapierApplicationData = await req.json();
    
    console.log('Received Zapier webhook data:', data);

    // Validate required fields
    if (!data.first_name || !data.last_name || !data.email || !data.phone || !data.role) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields",
          required: ["first_name", "last_name", "email", "phone", "role"]
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    if (data.role !== 'fieldmarketing' && data.role !== 'salgskonsulent') {
      return new Response(
        JSON.stringify({ 
          error: "Invalid role. Must be 'fieldmarketing' or 'salgskonsulent'"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status if provided
    const validStatuses = ['ansat', 'udskudt_samtale', 'ikke_kvalificeret', 'ikke_ansat', 'startet', 'ny_ansoegning'];
    if (data.status && !validStatuses.includes(data.status)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid status. Must be one of: ansat, udskudt_samtale, ikke_kvalificeret, ikke_ansat, startet, ny_ansoegning"
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if candidate already exists (by email or phone)
    const { data: existingCandidate, error: searchError } = await supabase
      .from('candidates')
      .select('id, email, phone')
      .or(`email.eq.${data.email},phone.eq.${data.phone}`)
      .maybeSingle();

    let candidateId: string;

    if (existingCandidate) {
      console.log('Found existing candidate:', existingCandidate.id);
      candidateId = existingCandidate.id;
      
      // Update candidate with any new notes
      if (data.notes) {
        const existingNotes = await supabase
          .from('candidates')
          .select('notes')
          .eq('id', candidateId)
          .single();
        
        const updatedNotes = existingNotes.data?.notes 
          ? `${existingNotes.data.notes}\n\n${new Date().toISOString()}: ${data.notes}`
          : data.notes;

        await supabase
          .from('candidates')
          .update({ 
            notes: updatedNotes,
            updated_at: new Date().toISOString()
          })
          .eq('id', candidateId);
      }
    } else {
      // Create new candidate
      console.log('Creating new candidate');
      const { data: newCandidate, error: candidateError } = await supabase
        .from('candidates')
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (candidateError) {
        console.error('Error creating candidate:', candidateError);
        return new Response(
          JSON.stringify({ error: 'Failed to create candidate', details: candidateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      candidateId = newCandidate.id;
      console.log('Created candidate:', candidateId);
    }

    // Check how many applications this candidate has
    const { count: applicationCount } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('candidate_id', candidateId);

    console.log(`Candidate has ${applicationCount} existing applications`);

    // Create new application
    const applicationNotes = [];
    
    // Add notes from Zapier webhook if provided with label
    if (data.notes) {
      applicationNotes.push(`Ansøgning fra kandidat: ${data.notes}`);
    }
    
    // Add repeat application note if applicable
    if (applicationCount && applicationCount > 0) {
      applicationNotes.push(`Gentagen ansøgning (ansøgning #${applicationCount + 1})`);
    }
    
    const { data: newApplication, error: applicationError } = await supabase
      .from('applications')
      .insert({
        candidate_id: candidateId,
        role: data.role,
        source: 'Hjemmesiden', // Always set to "Hjemmesiden"
        application_date: new Date().toISOString(),
        status: data.status || 'ny_ansoegning', // Use provided status or default to 'ny_ansoegning'
        cv_url: data.cv_url || null,
        cover_letter_url: data.cover_letter_url || null,
        notes: applicationNotes.length > 0 ? applicationNotes.join('\n\n') : null,
      })
      .select()
      .single();

    if (applicationError) {
      console.error('Error creating application:', applicationError);
      return new Response(
        JSON.stringify({ error: 'Failed to create application', details: applicationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created application:', newApplication.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        candidate_id: candidateId,
        application_id: newApplication.id,
        is_repeat_application: applicationCount && applicationCount > 0,
        application_count: (applicationCount || 0) + 1
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in zapier-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
