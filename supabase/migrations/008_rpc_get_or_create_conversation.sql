-- supabase/migrations/008_rpc_get_or_create_conversation.sql
-- ─────────────────────────────────────────────
-- RPC: get_or_create_conversation
-- Ensure a single, deduplicated conversation row exists for a pair of UUIDs.
-- participant1_id is strictly less than participant2_id to prevent duplicates.
-- ─────────────────────────────────────────────

create or replace function get_or_create_conversation(user_a uuid, user_b uuid)
returns uuid
language plpgsql security definer
as $$
declare
  v_p1 uuid;
  v_p2 uuid;
  v_conv_id uuid;
begin
  -- Enforce ordering
  if user_a < user_b then
    v_p1 := user_a;
    v_p2 := user_b;
  else
    v_p1 := user_b;
    v_p2 := user_a;
  end if;

  -- Attempt to select existing
  select id into v_conv_id
  from conversations
  where participant1_id = v_p1 and participant2_id = v_p2
  limit 1;

  -- Create if missing
  if v_conv_id is null then
    insert into conversations (participant1_id, participant2_id, unread_count_p1, unread_count_p2)
    values (v_p1, v_p2, 0, 0)
    returning id into v_conv_id;
  end if;

  return v_conv_id;
end;
$$;
