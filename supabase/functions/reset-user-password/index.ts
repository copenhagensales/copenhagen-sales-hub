import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Reset password function called');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header');
      throw new Error('No authorization header')
    }

    // Verify the user is authenticated
    const token = authHeader.replace('Bearer ', '')
    console.log('Verifying user token...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      console.error('User verification failed:', userError);
      throw new Error('Unauthorized')
    }

    console.log('User verified:', user.id);

    // Check if user is admin
    console.log('Checking admin role...');
    const { data: roles, error: rolesError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      throw rolesError;
    }
    
    console.log('User roles:', roles);
    
    const isAdmin = roles?.some(r => r.role === 'admin')
    if (!isAdmin) {
      console.error('User is not admin');
      throw new Error('Unauthorized: Admin role required')
    }

    // Get request body
    const { userId } = await req.json()
    
    if (!userId) {
      console.error('No userId provided');
      throw new Error('User ID is required')
    }

    console.log('Resetting password for user:', userId);

    // Generate a new temporary password
    const newPassword = Math.random().toString(36).slice(-8) + "Aa1!"
    console.log('Generated new password');

    // Update user password using admin API
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    console.log('Password updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        password: newPassword,
        message: 'Password reset successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Reset password error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
