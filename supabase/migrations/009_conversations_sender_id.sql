-- supabase/migrations/009_conversations_sender_id.sql
-- Add last_message_sender_id to conversations so the inbox can show "You: ..." prefix
-- Also backfill from the most recent message for each conversation.

-- Drop the old trigger from migration 006 to prevent double-firing
drop trigger if exists messages_update_conversation on messages;

-- Step 1: Add the column (nullable FK to profiles)
alter table conversations
  add column if not exists last_message_sender_id uuid references profiles(id) on delete set null;

-- Step 2: Backfill from the latest message per conversation
update conversations c
set last_message_sender_id = (
  select m.sender_id
  from messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
);

-- Step 3: Update the message insert trigger to also cache sender_id
-- (replaces/creates the trigger function that caches message preview)
create or replace function cache_last_message()
returns trigger language plpgsql as $$
begin
  update conversations
  set
    last_message_at      = new.created_at,
    last_message_preview = left(new.content, 100),
    last_message_sender_id = new.sender_id,
    unread_count_p1 = case
      when new.sender_id = participant1_id then unread_count_p1
      else unread_count_p1 + 1
    end,
    unread_count_p2 = case
      when new.sender_id = participant2_id then unread_count_p2
      else unread_count_p2 + 1
    end
  where id = new.conversation_id;
  return new;
end;
$$;

-- Drop old trigger if exists, then recreate
drop trigger if exists messages_cache_last on messages;

create trigger messages_cache_last
  after insert on messages
  for each row execute function cache_last_message();
