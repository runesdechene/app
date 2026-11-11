-- WHY: les avis repris de Judge.me vont jusqu'à 1 200 signes, et on ne coupe pas les mots d'un client.
-- Le formulaire public garde sa limite de 500 (EtapeAvis) ; la base accepte 2 000.
-- SCHEMA CHECKED (2026-11-11) : hub_photo_submissions_message_check = CHECK (char_length(message) <= 500)

ALTER TABLE public.hub_photo_submissions
  DROP CONSTRAINT hub_photo_submissions_message_check,
  ADD CONSTRAINT hub_photo_submissions_message_check CHECK (char_length(message) <= 2000);
