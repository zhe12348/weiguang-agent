# 微光 MVP 内测 Supabase 表结构

在 Supabase SQL Editor 中执行以下 SQL。

## 1. 完整聊天记录：conversations

优先复用现有 `conversations` 表。以下 SQL 会在表不存在时创建，并补齐本次内测需要的字段。

```sql
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id text not null unique,
  first_user_text text,
  messages jsonb,
  ended boolean default false,
  feedback text,
  message_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table conversations
  add column if not exists user_id text,
  add column if not exists conversation_id text,
  add column if not exists first_user_text text,
  add column if not exists messages jsonb,
  add column if not exists ended boolean default false,
  add column if not exists feedback text,
  add column if not exists message_count integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists conversations_conversation_id_key
  on conversations (conversation_id);
```

## 2. 旧版有帮助/没帮助反馈：feedback_records

保留现有轻反馈记录。

```sql
create table if not exists feedback_records (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  conversation_id text not null,
  feedback_type text not null,
  first_user_text text,
  messages jsonb,
  message_count integer default 0,
  created_at timestamptz default now()
);

alter table feedback_records
  add column if not exists user_id text,
  add column if not exists conversation_id text,
  add column if not exists feedback_type text,
  add column if not exists first_user_text text,
  add column if not exists messages jsonb,
  add column if not exists message_count integer default 0,
  add column if not exists created_at timestamptz default now();
```

## 3. 7 天内测反馈：mvp_feedback

`feedback.html` 会写入这张表。

```sql
create table if not exists mvp_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  submitted_at timestamptz default now(),
  usage_count text not null,
  understood_score integer not null,
  helpful_quote text,
  awkward_quote text,
  feature_request text,
  reuse_intent text not null,
  created_at timestamptz default now()
);

alter table mvp_feedback
  add column if not exists user_id text,
  add column if not exists submitted_at timestamptz default now(),
  add column if not exists usage_count text,
  add column if not exists understood_score integer,
  add column if not exists helpful_quote text,
  add column if not exists awkward_quote text,
  add column if not exists feature_request text,
  add column if not exists reuse_intent text,
  add column if not exists created_at timestamptz default now();
```

## 4. RLS 说明

当前写入由后端使用 `SUPABASE_SERVICE_ROLE_KEY` 完成。Service role key 会绕过 RLS。

不要把 `SUPABASE_SERVICE_ROLE_KEY` 放进前端代码、GitHub、截图或聊天记录。
