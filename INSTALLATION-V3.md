# TME Devis & Factures V3 — Installation du cloud

Cette V3 ajoute une connexion par email/mot de passe et une synchronisation des données entre appareils via Supabase.

## 1. Créer le projet Supabase
1. Va sur https://supabase.com/ et crée un compte puis un projet.
2. Choisis un mot de passe fort pour la base de données et conserve-le.
3. Dans **Project Settings > API**, récupère :
   - **Project URL**
   - **anon / public key** (ou publishable key si ton tableau de bord l'affiche et que la version du client la prend en charge)
4. N'utilise jamais la clé `service_role` dans le site web.

## 2. Créer la table sécurisée
1. Dans Supabase, ouvre **SQL Editor**.
2. Ouvre le fichier `supabase-schema.sql` de ce projet.
3. Copie-colle tout son contenu dans SQL Editor puis clique sur **Run**.
4. La table `tme_workspace` et ses règles RLS isolent les données par compte utilisateur.

## 3. Renseigner les clés publiques
1. Ouvre `supabase-config.js`.
2. Remplace `COLLER_URL_SUPABASE_ICI` par le Project URL.
3. Remplace `COLLER_CLE_ANON_PUBLIQUE_ICI` par la clé anon/public.
4. Enregistre le fichier.

Ces deux valeurs sont des paramètres publics destinés au navigateur. La sécurité repose sur l'authentification et les politiques RLS ; ne mets aucune clé secrète ou service_role dans le dépôt.

## 4. Publier sur GitHub Pages
1. Dépose tous les fichiers du projet à la racine de ton dépôt GitHub.
2. Ouvre **Settings > Pages**.
3. Choisis **Deploy from a branch**, branche `main`, dossier `/ (root)`.
4. Enregistre et attends la publication.
5. Ouvre l'adresse GitHub Pages de ton projet.

## 5. Créer ton compte TME
1. À l'écran de connexion, saisis ton email et un mot de passe d'au moins 8 caractères.
2. Clique sur **Créer mon compte**.
3. Si Supabase demande une confirmation, ouvre l'email reçu et confirme ton adresse.
4. Reviens sur l'application et connecte-toi.
5. La première connexion copie les données locales présentes dans ce navigateur vers ton espace cloud. Sur un nouvel appareil, connecte-toi au même compte pour récupérer ces données.

## 6. Utilisation et précautions
- La synchronisation cloud se déclenche après les modifications enregistrées.
- Utilise toujours le même compte TME sur tes appareils.
- Continue d'exporter régulièrement un JSON depuis Paramètres comme sauvegarde indépendante.
- Évite de modifier simultanément les mêmes documents sur plusieurs appareils : cette V3 enregistre un instantané global du dossier et ne fait pas de fusion champ par champ.
- La suppression d'un devis, d'une facture ou d'un client reste une action sensible ; vérifie les confirmations avant de supprimer.
- Les documents PDF sont générés par l'impression du navigateur. L'action email ouvre ton logiciel de messagerie ; joins toi-même le PDF enregistré.

## Limites fonctionnelles
- Pas de récupération de mot de passe personnalisée dans l'interface : utilise le flux de réinitialisation Supabase si nécessaire.
- Pas de signature électronique qualifiée : la signature tactile dessinée n'est pas un service de certification.
- Le dépôt GitHub Pages est public si le dépôt l'est. Les données client restent dans Supabase, mais le code de l'application et les clés publiques sont visibles. Ne publie aucune donnée client dans le dépôt.
- Vérifie les obligations de facturation, TVA, conservation et protection des données avec un professionnel compétent avant usage commercial.
