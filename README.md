# TME — Devis & Factures V3

Application responsive de devis/facturation TME avec :
- devis et factures, modification, suppression avec confirmation ;
- catalogue de prestations, clients et TVA par ligne ;
- conversion devis → facture ;
- paiements partiels et historique des encaissements ;
- signature dessinée sur écran tactile ;
- impression / PDF et préparation d'email ;
- connexion email/mot de passe et synchronisation multi-appareils via Supabase ;
- export/import JSON de sauvegarde.

## Démarrage
La V3 nécessite une configuration Supabase. Voir `INSTALLATION-V3.md`.
1. Configurer `supabase-config.js`.
2. Exécuter `supabase-schema.sql` dans Supabase SQL Editor.
3. Publier le contenu à la racine de GitHub Pages.

Sans configuration Supabase, l'application affiche l'écran de connexion et ne peut pas démarrer en mode cloud.

## Sécurité
Les données sont stockées dans `tme_workspace` sous forme JSONB. Les politiques Row Level Security (RLS) restreignent chaque ligne à son propriétaire authentifié. N'expose jamais la clé `service_role`. La clé anon/public peut être visible côté navigateur lorsque RLS est correctement activé.

## Sauvegardes et limites
Exporter régulièrement un JSON. Les modifications sont synchronisées sous forme d'instantané global ; éviter les modifications simultanées sur plusieurs appareils. Le courriel préparé n'attache pas automatiquement le PDF. La signature dessinée n'est pas une signature électronique qualifiée.

Consulter `INSTALLATION-V3.md` pour le paramétrage détaillé.
