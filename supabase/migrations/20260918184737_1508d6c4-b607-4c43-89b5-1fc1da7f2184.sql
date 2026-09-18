alter policy conv_participant_update on public.conversations
  using ((auth.uid() = participant_1_id) OR (auth.uid() = participant_2_id))
  with check ((auth.uid() = participant_1_id) OR (auth.uid() = participant_2_id));

alter policy lf_update_own on public.looking_for_posts
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter policy roommate_profiles_update_own on public.roommate_profiles
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter policy roommate_interests_update_participant on public.roommate_interests
  using ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id))
  with check ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id));

alter policy "Parties update own bookings" on public.tour_bookings
  using ((auth.uid() = poster_id) OR (auth.uid() = subletter_id))
  with check ((auth.uid() = poster_id) OR (auth.uid() = subletter_id));