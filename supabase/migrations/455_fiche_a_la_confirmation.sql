-- WHY: « Confirm email » était coupé : demander un code pour une adresse inconnue créait aussitôt un
--      compte confirmé et, par on_auth_user_created, sa fiche Explorateur — une faute de frappe
--      laissait un fantôme (« Explorateur 4DDF », 07/10), et ce compte récupérait la fiche existante
--      au même e-mail (ancien compte, client Shopify) sans preuve que l'adresse lui appartient.
--      Avant d'activer la confirmation, la fiche ne naît plus qu'avec un compte confirmé : à sa
--      création s'il l'est d'emblée (fournisseur externe), sinon quand il le devient (code saisi).
--      handle_new_user ne change pas : elle ne lit que NEW et chaque insertion est idempotente
--      (ON CONFLICT (id) DO NOTHING, mig 257).
-- SCHEMA CHECKED (08/10/2026, relu en prod) : un seul déclencheur sur auth.users,
--      `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE
--      FUNCTION handle_new_user()` (créé hors migration) ; auth.users.email_confirmed_at ;
--      aucune fiche dont le compte n'est pas confirmé (0).

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();
