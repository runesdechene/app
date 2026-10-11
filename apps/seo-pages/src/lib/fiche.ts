/**
 * QUOI     — la fiche d'un lieu telle que l'appli la lit (RPC fiche_lieu) : récit, photos,
 *            nature, époque, rubriques pratiques, Explorateurs, auteur.
 * POURQUOI — une seule source : la page publique dit exactement ce que dit la fiche d'Explore
 *            (Uriel, 11/10 : les pages /lieu/* au style de la V2).
 */
import { supabase } from './supabase';

export type Personne = { nom: string; avatar: string | null };

export interface Fiche {
  id: string;
  recit: string;
  adresse: string | null;
  photos: { url: string; vignette: string }[];
  type: { nom: string; icone: string | null; couleur: string | null } | null;
  faits: { epoque: string | null; annee: number | null };
  rubriques: { acces: string | null; quand: string | null; bonASavoir: string | null };
  bivouacTolere: boolean | null;
  explorateurs: { nombre: number; derniers: Personne[] };
  auteur: Personne | null;
  ajouteLe: string | null;
}

export async function getFiche(placeId: string): Promise<Fiche> {
  const { data, error } = await supabase.rpc('fiche_lieu', { p_id: placeId });
  if (error) throw error;
  if (!data) throw new Error(`fiche_lieu vide pour ${placeId}`);
  const f = data as Fiche;
  return {
    id: f.id,
    recit: f.recit ?? '',
    adresse: f.adresse ?? null,
    photos: f.photos ?? [],
    type: f.type ?? null,
    faits: { epoque: f.faits?.epoque ?? null, annee: f.faits?.annee ?? null },
    rubriques: {
      acces: f.rubriques?.acces ?? null,
      quand: f.rubriques?.quand ?? null,
      bonASavoir: f.rubriques?.bonASavoir ?? null,
    },
    bivouacTolere: f.bivouacTolere ?? null,
    explorateurs: { nombre: f.explorateurs?.nombre ?? 0, derniers: f.explorateurs?.derniers ?? [] },
    auteur: f.auteur ?? null,
    ajouteLe: f.ajouteLe ?? null,
  };
}

// Le numéro de chaque département, par son nom (geo_departements) : « Ain (01) ».
export async function getNumerosDepartements(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('geo_departements').select('code, nom');
  if (error) throw error;
  return new Map((data ?? []).map((d: { code: string; nom: string }) => [d.nom, d.code]));
}
