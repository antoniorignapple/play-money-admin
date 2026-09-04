import { createClient } from 'npm:@supabase/supabase-js@2.105.4'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Metodo non consentito' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json({ ok: false, error: 'Sessione mancante' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@playmoney.local'

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return json({ ok: false, error: 'Configurazione server incompleta' }, 500)
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token)
    if (callerError || !callerData?.user) {
      return json({ ok: false, error: 'Sessione non valida o scaduta' }, 401)
    }

    const { data: isAdmin, error: adminError } =
      await callerClient.rpc('is_play_money_admin_secure')
    if (adminError) return json({ ok: false, error: 'Verifica ruolo Admin non riuscita' }, 500)
    if (isAdmin !== true) {
      return json({ ok: false, error: 'Operazione riservata all’Admin' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const requestId = String(body?.richiesta_id ?? '')
    if (body?.type !== 'simulazione_richiesta' || !uuidPattern.test(requestId)) {
      return json({ ok: false, error: 'Payload non valido' }, 400)
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: richiesta, error: requestError } = await adminClient
      .from('simulazioni_richieste')
      .select('id, venue_id, venue_name, requested_user_id, status')
      .eq('id', requestId)
      .maybeSingle()

    if (requestError) return json({ ok: false, error: 'Lettura richiesta non riuscita' }, 500)
    if (!richiesta) return json({ ok: false, error: 'Richiesta non trovata' }, 404)
    if (richiesta.status !== 'in_attesa') {
      return json({ ok: true, sent: 0, removed: 0, skipped: 1, failed: 0 })
    }

    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', richiesta.requested_user_id)
      .eq('enabled', true)
    if (subscriptionsError) {
      return json({ ok: false, error: 'Lettura dispositivi non riuscita' }, 500)
    }

    // Libera soltanto tentativi rimasti sospesi per un'interruzione del server.
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await adminClient
      .from('push_delivery_log')
      .delete()
      .eq('event_type', 'simulazione_richiesta')
      .eq('entity_id', richiesta.id)
      .eq('status', 'sending')
      .lt('attempted_at', staleBefore)

    const locale = richiesta.venue_name || richiesta.venue_id || 'locale richiesto'
    const payload = JSON.stringify({
      title: 'Nuova simulazione assegnata',
      body: `Admin ti ha assegnato ${locale}. Tocca per visualizzarla.`,
      icon: './icons/icon-light-192.png',
      badge: './icons/icon-light-192.png',
      url: './?tab=simulazioni',
      type: 'simulazione_richiesta',
      richiesta_id: richiesta.id,
      tag: `simulazione-${richiesta.id}`,
    })

    const counters = { sent: 0, removed: 0, skipped: 0, failed: 0 }
    await Promise.all((subscriptions ?? []).map(async (subscription) => {
      const { error: claimError } = await adminClient.from('push_delivery_log').insert({
        event_type: 'simulazione_richiesta',
        entity_id: richiesta.id,
        subscription_id: subscription.id,
        status: 'sending',
      })
      if (claimError?.code === '23505') {
        counters.skipped += 1
        return
      }
      if (claimError) {
        counters.failed += 1
        return
      }

      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload)
        await adminClient
          .from('push_delivery_log')
          .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
          .eq('event_type', 'simulazione_richiesta')
          .eq('entity_id', richiesta.id)
          .eq('subscription_id', subscription.id)
        counters.sent += 1
      } catch (error) {
        const statusCode = Number(error?.statusCode || error?.status || 0)
        if (statusCode === 404 || statusCode === 410) {
          await Promise.all([
            adminClient.from('push_subscriptions')
              .update({ enabled: false }).eq('id', subscription.id),
            adminClient.from('push_delivery_log')
              .update({ status: 'expired', last_error: `HTTP ${statusCode}` })
              .eq('event_type', 'simulazione_richiesta')
              .eq('entity_id', richiesta.id)
              .eq('subscription_id', subscription.id),
          ])
          counters.removed += 1
          return
        }

        // Un errore temporaneo non consuma la consegna: l'Admin può riprovare.
        await adminClient.from('push_delivery_log')
          .delete()
          .eq('event_type', 'simulazione_richiesta')
          .eq('entity_id', richiesta.id)
          .eq('subscription_id', subscription.id)
        counters.failed += 1
      }
    }))

    return json({ ok: counters.failed === 0, ...counters })
  } catch {
    return json({ ok: false, error: 'Errore inatteso durante l’invio' }, 500)
  }
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
