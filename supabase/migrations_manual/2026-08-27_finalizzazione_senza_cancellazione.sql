-- Play Money: finalizzazione periodi senza cancellazione/snapshot.
-- I periodi nuovi restano nelle tabelle originali; gli snapshot esistenti
-- rimangono soltanto per retrocompatibilità con le vecchie finalizzazioni.

create or replace function public.finalizza_periodo_conteggi(p_period_id uuid, p_new_date_to date, p_preview_fingerprint text, p_missing_venues_confirmed boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_period public.conteggi_periods%rowtype;
  v_preview jsonb;
  v_new_period_id uuid;
  v_new_date_from date;
  v_movimenti_count integer;
  v_transfer_count integer;
  v_transfer_total numeric;
  v_cassa_summary jsonb;
begin
  if auth.uid() is null or not public.is_play_money_admin() then
    raise exception 'Operazione riservata agli Admin';
  end if;

  select * into v_period from public.conteggi_periods where id = p_period_id for update;
  if not found or v_period.status <> 'open' or v_period.is_active is not true then
    raise exception 'Il periodo non è aperto e attivo';
  end if;

  v_preview := public.prepara_finalizzazione_conteggi(p_period_id);
  if coalesce(v_preview->>'fingerprint','') <> coalesce(p_preview_fingerprint,'') then
    raise exception 'I dati del periodo sono cambiati. Controlla nuovamente i Da Riportare';
  end if;
  if jsonb_array_length(coalesce(v_preview->'missing_venues','[]'::jsonb)) > 0 and p_missing_venues_confirmed is not true then
    raise exception 'Devi confermare i locali non conteggiati';
  end if;

  v_new_date_from := v_period.date_to + 1;
  if p_new_date_to is null or p_new_date_to < v_new_date_from then raise exception 'Data finale del nuovo periodo non valida'; end if;
  if exists(select 1 from public.conteggi_periods p where p.id <> p_period_id and daterange(p.date_from,p.date_to,'[]') && daterange(v_new_date_from,p_new_date_to,'[]')) then
    raise exception 'Il nuovo periodo si sovrappone a un periodo esistente';
  end if;

  select count(*) into v_movimenti_count from public.movements_cassa where deleted_at is null and work_date between v_period.date_from and v_period.date_to;
  select public._cassa_period_summary(p_period_id) into v_cassa_summary;

  insert into public.movements_cassa(client_id,work_date,venue_id,acconto,recupero,da_riportare,note,created_by,origine,source_conteggio_id,source_period_id)
  select 'finalize-'||p_period_id::text||'-'||c.id::text,v_new_date_from,c.venue_id,0,0,trunc(c.riporto),
    'Trasferimento automatico da finalizzazione • Conteggio '||c.id::text,auth.uid(),'chiusura_conteggio',c.id,p_period_id
  from public.conteggi_tool c
  where c.period_id=p_period_id and coalesce(c.riporto,0)>0
  on conflict (client_id) do nothing;
  get diagnostics v_transfer_count=row_count;

  select coalesce(sum(trunc(riporto)),0) into v_transfer_total from public.conteggi_tool where period_id=p_period_id and coalesce(riporto,0)>0;

  update public.conteggi_periods set status='closed',is_active=false,updated_at=now() where id=p_period_id;
  insert into public.conteggi_periods(title,date_from,date_to,status,note,created_by,is_active)
  values('Conteggi '||to_char(v_new_date_from,'DD/MM/YYYY')||' - '||to_char(p_new_date_to,'DD/MM/YYYY'),v_new_date_from,p_new_date_to,'open',null,auth.uid(),true)
  returning id into v_new_period_id;

  return jsonb_build_object('success',true,'closed_period_id',p_period_id,'snapshot_id',null,'archive_mode','live_data',
    'new_period_id',v_new_period_id,'new_date_from',v_new_date_from,'new_date_to',p_new_date_to,
    'conteggi_archiviati',coalesce((v_preview->>'conteggi_count')::integer,0),'movimenti_conservati',v_movimenti_count,
    'movimenti_archiviati_eliminati',0,'da_riportare_creati',v_transfer_count,'da_riportare_trasferiti',v_transfer_total,
    'cassa_finale_periodo',v_cassa_summary->'cassa_disponibile');
end;
$function$;
