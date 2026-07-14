-- Allow admins to set a member's cuota as a percentage of the group total.
-- When custom_pct is set, it overrides custom_amount: the member pays
-- (total_bs * custom_pct / 100) each month, recalculated at that month's rate.
alter table group_participants
  add column custom_pct numeric check (custom_pct > 0 and custom_pct <= 100);
