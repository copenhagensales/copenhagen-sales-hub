import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateApplicationData {
  email: string;
  phone?: string;
  status: string;
  source?: string;
  notes?: string;
  application_date?: string;
  role?: string;
}

interface EmployeeData {
  email: string;
  team: string;
}

// Team mapping from employee data to database team names
const teamMapping: Record<string, string | undefined> = {
  'Team: TDC': 'TDC Erhverv',
  'Team: Eesy TM': 'Eesy TM',
  'Team: YouSee': 'YouSee',
  'Team: United': 'United',
  'Team: Relatel': 'Relatel',
  'Team: Fieldmarketing': undefined,
  'Relatel Kundeservice': undefined,
  'Rekruttering & SoMe': undefined,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { candidates, employees } = await req.json();

    if (!candidates || !Array.isArray(candidates)) {
      throw new Error('Invalid candidates data');
    }

    console.log(`Processing ${candidates.length} candidate applications`);

    // Build email to team mapping from employee data
    const emailToTeam: Record<string, string> = {};
    if (employees && Array.isArray(employees)) {
      for (const emp of employees) {
        if (emp.email && emp.team) {
          const normalizedEmail = emp.email.toLowerCase().trim();
          const mappedTeam = teamMapping[emp.team];
          if (mappedTeam) {
            emailToTeam[normalizedEmail] = mappedTeam;
          }
        }
      }
      console.log(`Built team mapping for ${Object.keys(emailToTeam).length} employees`);
    }

    const results = {
      total: candidates.length,
      applicationsCreated: 0,
      candidatesNotFound: 0,
      teamsAssigned: 0,
      errors: [] as string[],
    };

    for (const candidate of candidates) {
      try {
        const email = candidate.email?.toLowerCase().trim();
        const phone = candidate.phone?.trim();

        if (!email && !phone) {
          results.errors.push('Missing email and phone');
          continue;
        }

        // Find existing candidate by email or phone
        let candidateQuery = supabase.from('candidates').select('id, email');
        
        if (email && phone) {
          candidateQuery = candidateQuery.or(`email.eq.${email},phone.eq.${phone}`);
        } else if (email) {
          candidateQuery = candidateQuery.eq('email', email);
        } else if (phone) {
          candidateQuery = candidateQuery.eq('phone', phone);
        }

        const { data: existingCandidates, error: findError } = await candidateQuery;

        if (findError) {
          console.error('Error finding candidate:', findError);
          results.errors.push(`Error finding candidate ${email || phone}: ${findError.message}`);
          continue;
        }

        if (!existingCandidates || existingCandidates.length === 0) {
          results.candidatesNotFound++;
          console.log(`Candidate not found: ${email || phone}`);
          continue;
        }

        const existingCandidate = existingCandidates[0];

        // Map status to valid database enum values
        let dbStatus = 'startet';
        if (candidate.status) {
          const statusLower = candidate.status.toLowerCase().trim();
          if (statusLower === 'ansat') dbStatus = 'ansat';
          else if (statusLower === 'udskudt_samtale' || statusLower === 'udskudt samtale') dbStatus = 'udskudt_samtale';
          else if (statusLower === 'ikke_kvalificeret' || statusLower === 'ikke kvalificeret') dbStatus = 'ikke_kvalificeret';
          else if (statusLower === 'ikke_ansat' || statusLower === 'ikke ansat') dbStatus = 'ikke_ansat';
          else if (statusLower === 'ghostet') dbStatus = 'ghostet';
          else if (statusLower === 'takket_nej' || statusLower === 'takket nej') dbStatus = 'takket_nej';
          else if (statusLower === 'ny_ansoegning' || statusLower === 'ny ansøgning') dbStatus = 'ny_ansoegning';
        }

        // Determine role
        let role = 'salgskonsulent';
        if (candidate.role) {
          const roleLower = candidate.role.toLowerCase().trim();
          if (roleLower === 'fieldmarketing') role = 'fieldmarketing';
        }

        // Find team if status is ansat
        let teamId = null;
        if (dbStatus === 'ansat' && email) {
          const teamName = emailToTeam[email];
          if (teamName) {
            const { data: teams } = await supabase
              .from('teams')
              .select('id')
              .ilike('name', teamName)
              .limit(1);
            
            if (teams && teams.length > 0) {
              teamId = teams[0].id;
              results.teamsAssigned++;
            }
          }
        }

        // Create application
        const applicationData: any = {
          candidate_id: existingCandidate.id,
          role: role,
          status: dbStatus,
          source: candidate.source || 'Hjemmesiden',
          notes: candidate.notes || null,
          application_date: candidate.application_date || new Date().toISOString(),
        };

        if (teamId) {
          applicationData.team_id = teamId;
        }

        if (dbStatus === 'ansat' && candidate.application_date) {
          applicationData.hired_date = candidate.application_date;
        }

        const { error: insertError } = await supabase
          .from('applications')
          .insert(applicationData);

        if (insertError) {
          console.error('Error creating application:', insertError);
          results.errors.push(`Error for ${email || phone}: ${insertError.message}`);
        } else {
          results.applicationsCreated++;
        }

      } catch (error) {
        console.error('Error processing candidate:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`Error processing candidate: ${errorMessage}`);
      }
    }

    console.log('Import completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
