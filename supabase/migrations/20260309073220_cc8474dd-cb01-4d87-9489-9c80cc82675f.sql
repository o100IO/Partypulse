-- Venue owners can update (pin) chat messages for events at their venue
CREATE POLICY "Venue owners can update chat messages"
ON public.event_chat_messages FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.id = event_chat_messages.event_id
  AND v.owner_id = auth.uid()
));

-- Venue owners can delete chat messages for events at their venue
CREATE POLICY "Venue owners can delete chat messages"
ON public.event_chat_messages FOR DELETE
USING (EXISTS (
  SELECT 1 FROM events e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.id = event_chat_messages.event_id
  AND v.owner_id = auth.uid()
));