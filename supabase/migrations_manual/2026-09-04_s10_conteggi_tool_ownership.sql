begin;

drop policy if exists conteggi_tool_delete_selected_giro on public.conteggi_tool;
drop policy if exists conteggi_tool_update_selected_giro on public.conteggi_tool;

drop policy if exists conteggi_tool_admin_delete on public.conteggi_tool;
create policy conteggi_tool_admin_delete
  on public.conteggi_tool
  for delete
  to authenticated
  using ((select public.is_play_money_admin_secure()));

drop policy if exists conteggi_tool_admin_update on public.conteggi_tool;
create policy conteggi_tool_admin_update
  on public.conteggi_tool
  for update
  to authenticated
  using ((select public.is_play_money_admin_secure()))
  with check ((select public.is_play_money_admin_secure()));

commit;
