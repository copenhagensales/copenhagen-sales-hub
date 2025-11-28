import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateImportData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  notes: string;
  application_date: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { candidates } = await req.json();
    
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "No candidates provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting bulk import of ${candidates.length} candidates`);
    
    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const errors: string[] = [];

    for (const candidate of candidates as CandidateImportData[]) {
      try {
        // Validate required fields
        if (!candidate.first_name || !candidate.email || !candidate.phone) {
          console.error(`Missing required fields for candidate: ${JSON.stringify(candidate)}`);
          errors.push(`Mangler påkrævede felter: ${candidate.email || 'ingen email'}`);
          errorCount++;
          continue;
        }

        // Check if candidate already exists (by email or phone)
        const { data: existingCandidate } = await supabase
          .from('candidates')
          .select('id')
          .or(`email.eq.${candidate.email},phone.eq.${candidate.phone}`)
          .maybeSingle();

        if (existingCandidate) {
          console.log(`Candidate already exists: ${candidate.email}`);
          duplicateCount++;
          continue;
        }

        // Create new candidate
        const { data: newCandidate, error: candidateError } = await supabase
          .from('candidates')
          .insert({
            first_name: candidate.first_name,
            last_name: candidate.last_name || "",
            email: candidate.email,
            phone: candidate.phone,
            notes: candidate.notes || "",
          })
          .select()
          .single();

        if (candidateError) {
          console.error(`Error creating candidate ${candidate.email}:`, candidateError);
          errors.push(`Fejl ved oprettelse af ${candidate.email}: ${candidateError.message}`);
          errorCount++;
          continue;
        }

        // Map status values
        let mappedStatus = candidate.status?.toLowerCase();
        const validStatuses = ['ansat', 'udskudt_samtale', 'ikke_kvalificeret', 'ikke_ansat', 'startet', 'ghostet', 'takket_nej', 'interesseret_i_kundeservice'];
        if (!validStatuses.includes(mappedStatus)) {
          mappedStatus = 'startet'; // Default status
        }

        // Create application for the candidate - all as "salgskonsulent"
        const { error: applicationError } = await supabase
          .from('applications')
          .insert({
            candidate_id: newCandidate.id,
            role: 'salgskonsulent',
            status: mappedStatus,
            source: candidate.source || 'Hjemmesiden',
            notes: candidate.notes || "",
            application_date: candidate.application_date || new Date().toISOString(),
          });

        if (applicationError) {
          console.error(`Error creating application for ${candidate.email}:`, applicationError);
          errors.push(`Fejl ved oprettelse af ansøgning for ${candidate.email}: ${applicationError.message}`);
          errorCount++;
          continue;
        }

        successCount++;
        console.log(`Successfully imported candidate: ${candidate.email}`);
      } catch (error: any) {
        console.error(`Error processing candidate:`, error);
        errors.push(`Uventet fejl: ${error.message}`);
        errorCount++;
      }
    }

    console.log(`Import completed: ${successCount} success, ${errorCount} errors, ${duplicateCount} duplicates`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: candidates.length,
          imported: successCount,
          duplicates: duplicateCount,
          errors: errorCount,
        },
        errors: errors.length > 0 ? errors : undefined,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('Bulk import error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});