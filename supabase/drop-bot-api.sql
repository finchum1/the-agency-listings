-- The bot API (/v1) was retired in favour of the AI connection (api/mcp.js). Its tokens, webhook settings and the functions that managed them are gone.
-- api_audit_log stays: the AI connection records every change there (with no token).
drop function if exists public.set_token_webhook(uuid, text);
drop function if exists public.create_api_token(text, text[]);
drop function if exists public.revoke_api_token(uuid);
drop table if exists public.api_token_webhooks;
drop table if exists public.api_tokens cascade;
