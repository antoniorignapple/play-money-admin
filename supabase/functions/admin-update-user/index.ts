import { createClient } from 'npm:@supabase/supabase-js@2.105.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const adminActions = new Set([
  'create_user',
  'update_user_profile',
  'update_pin',
  'delete_user',
])
const validPin = (value: unknown) => /^\d{4}$/.test(String(value ?? ''))
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const employeeSafeFields =
  'id,auth_user_id,email,full_name,role,created_at,active,last_access_at,last_seen'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json({ error: 'Sessione mancante' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Configurazione server incompleta' }, 500)
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: userError } = await supabaseUser.auth.getUser(token)
    const caller = userData?.user
    if (userError || !caller) return json({ error: 'Sessione non valida o scaduta' }, 401)

    const body = await req.json()
    const action = String(body?.action ?? '')

    if (adminActions.has(action)) {
      const { data: isAdmin, error: adminError } =
        await supabaseUser.rpc('is_play_money_admin_secure')
      if (adminError) return json({ error: 'Verifica ruolo Admin non riuscita' }, 500)
      if (isAdmin !== true) return json({ error: 'Operazione riservata all’Admin' }, 403)
    } else if (action === 'update_own_pin') {
      if (String(body?.auth_user_id ?? '') !== caller.id) {
        return json({ error: 'Puoi modificare soltanto il tuo PIN' }, 403)
      }
    } else {
      return json({ error: 'Azione non valida' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    if (action === 'update_own_pin') {
      return updateOwnPin(
        supabaseAdmin,
        supabaseUrl,
        anonKey,
        caller.id,
        caller.email ?? '',
        body,
      )
    }

    if (action === 'update_pin') {
      const authUserId = String(body?.auth_user_id ?? '')
      const newPin = String(body?.new_pin ?? '')
      if (!authUserId || !validPin(newPin)) {
        return json({ error: 'Utente o nuovo PIN non valido' }, 400)
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        { password: `pm${newPin}` },
      )
      if (authError) return json({ error: authError.message }, 500)

      return json({ success: true })
    }

    if (action === 'delete_user') {
      const authUserId = String(body?.auth_user_id ?? '')
      if (!authUserId) return json({ error: 'Utente mancante' }, 400)

      const { error: dbError } = await supabaseAdmin
        .from('dipendenti')
        .delete()
        .eq('auth_user_id', authUserId)
      if (dbError) return json({ error: dbError.message }, 500)

      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId)
      if (authError) return json({ error: authError.message }, 500)

      return json({ success: true })
    }

    if (action === 'update_user_profile') {
      const authUserId = String(body?.auth_user_id ?? '')
      const fullName = String(body?.full_name ?? '').trim()
      const email = String(body?.email ?? '').trim().toLowerCase()
      const role = body?.role === 'admin' ? 'admin' : 'operator'
      if (!authUserId || !fullName || !validEmail(email)) {
        return json({ error: 'Utente, nome o email non validi' }, 400)
      }

      const { data: previousEmployee, error: previousEmployeeError } = await supabaseAdmin
        .from('dipendenti')
        .select(employeeSafeFields)
        .eq('auth_user_id', authUserId)
        .single()
      if (previousEmployeeError || !previousEmployee) {
        return json({ error: 'Dipendente non trovato' }, 404)
      }

      const { data: previousAuthData, error: previousAuthError } =
        await supabaseAdmin.auth.admin.getUserById(authUserId)
      const previousAuthUser = previousAuthData?.user
      if (previousAuthError || !previousAuthUser) {
        return json({ error: previousAuthError?.message || 'Utente Auth non trovato' }, 404)
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUserId,
        {
          email,
          user_metadata: {
            ...(previousAuthUser.user_metadata ?? {}),
            full_name: fullName,
          },
          app_metadata: {
            ...(previousAuthUser.app_metadata ?? {}),
            role,
          },
        },
      )
      if (authUpdateError) return json({ error: authUpdateError.message }, 500)

      const { data: dipendente, error: dbUpdateError } = await supabaseAdmin
        .from('dipendenti')
        .update({ full_name: fullName, email, role })
        .eq('auth_user_id', authUserId)
        .select(employeeSafeFields)
        .single()

      if (dbUpdateError || !dipendente) {
        const { error: rollbackError } = await supabaseAdmin.auth.admin.updateUserById(
          authUserId,
          {
            email: previousAuthUser.email,
            user_metadata: previousAuthUser.user_metadata,
            app_metadata: previousAuthUser.app_metadata,
          },
        )
        const rollbackSuffix = rollbackError
          ? ' Ripristino Auth non riuscito: contattare assistenza.'
          : ''
        return json(
          { error: `${dbUpdateError?.message || 'Aggiornamento dipendente non riuscito'}.${rollbackSuffix}` },
          500,
        )
      }

      return json({ success: true, dipendente })
    }

    const fullName = String(body?.full_name ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const pin = String(body?.pin ?? '')
    const role = body?.role === 'admin' ? 'admin' : 'operator'
    if (!fullName || !email || !validPin(pin)) {
      return json({ error: 'Nome, email o PIN non validi' }, 400)
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: `pm${pin}`,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role },
    })
    if (authError || !authData.user) {
      return json({ error: authError?.message || 'Creazione utente non riuscita' }, 500)
    }

    const { data: dipendente, error: dbError } = await supabaseAdmin
      .from('dipendenti')
      .insert({
        auth_user_id: authData.user.id,
        full_name: fullName,
        email,
        role,
        active: true,
      })
      .select(employeeSafeFields)
      .single()

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return json({ error: dbError.message }, 500)
    }

    return json({ success: true, dipendente })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore inatteso'
    return json({ error: message }, 500)
  }
})

async function updateOwnPin(
  supabaseAdmin: ReturnType<typeof createClient>,
  supabaseUrl: string,
  anonKey: string,
  callerId: string,
  callerEmail: string,
  body: Record<string, unknown>,
) {
  const currentPin = String(body?.current_pin ?? '')
  const newPin = String(body?.new_pin ?? '')
  if (!validPin(currentPin) || !validPin(newPin) || currentPin === newPin) {
    return json({ error: 'PIN attuale o nuovo PIN non valido' }, 400)
  }

  const { data: employee, error: employeeError } = await supabaseAdmin
    .from('dipendenti')
    .select('id')
    .eq('auth_user_id', callerId)
    .single()
  if (employeeError || !employee) return json({ error: 'Dipendente non trovato' }, 404)

  if (!callerEmail) return json({ error: 'Email Auth non disponibile' }, 400)
  const pinVerifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: verifyError } = await pinVerifier.auth.signInWithPassword({
    email: callerEmail,
    password: `pm${currentPin}`,
  })
  if (verifyError) {
    return json({ error: 'PIN attuale non corretto' }, 403)
  }

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    callerId,
    { password: `pm${newPin}` },
  )
  if (authError) return json({ error: authError.message }, 500)

  return json({ success: true })
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
