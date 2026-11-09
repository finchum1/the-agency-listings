-- Attach an email template to a deal's checklist task.
-- null = automatic: the task's wording decides (src/lib/dealEmails.js, taskEmailKey), so "Send Buyer Welcome and next steps email" offers the
-- welcome email with no setup. '' = this task has no email. Anything else = the key of a starter template or the id of the person's own.
alter table public.transaction_tasks add column if not exists email_template text;
