import { createClient } from 'npm:@supabase/supabase-js@2.105.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const validPin = (value: unknown) => /^\d{4}$/.test(String(value ?? ''))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ verified: false }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json({ verified: false }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ verified: false }, 500)
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: callerData, error: callerError } =
      await callerClient.auth.getUser(token)
    if (callerError || !callerData?.user) return json({ verified: false }, 401)

    const body = await req.json()
    const giroId = String(body?.giro_id ?? '')
    const pin = String(body?.pin ?? '')
    if (!giroId || !validPin(pin)) return json({ verified: false }, 400)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: giro, error: giroError } = await adminClient
      .from('giri')
      .select('default_employee_id,active')
      .eq('id', giroId)
      .eq('active', true)
      .maybeSingle()
    if (giroError) return json({ verified: false }, 500)
    if (!giro?.default_employee_id) return json({ verified: false }, 404)

    const { data: owner, error: ownerError } = await adminClient
      .from('dipendenti')
      .select('email,active')
      .eq('id', giro.default_employee_id)
      .eq('active', true)
      .maybeSingle()
    if (ownerError) return json({ verified: false }, 500)
    if (!owner?.email) return json({ verified: false }, 404)

    const pinVerifier = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: verifyError } = await pinVerifier.auth.signInWithPassword({
      email: owner.email,
      password: `pm${pin}`,
    })

    return json({ verified: !verifyError })
  } catch {
    return json({ verified: false }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
