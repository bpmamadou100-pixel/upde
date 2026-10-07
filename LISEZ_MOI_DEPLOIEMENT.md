# UPDe — Mise en ligne gratuite avec GitHub Pages + Supabase

Cette version remplace le serveur Node.js local (`server.js`) par Supabase.
Elle fonctionne donc avec GitHub Pages.

## Pourquoi l'ancienne version affichait "Unexpected token '<' ... is not valid JSON" ?

L'ancien `app.js` appelait `/api/login`, `/api/register`, etc.
Ces routes existaient seulement quand `server.js` tournait sur ton ordinateur.
GitHub Pages héberge uniquement des fichiers statiques et renvoyait une page HTML
à la place du JSON attendu.

## Étape 1 — Créer Supabase

1. Va sur https://supabase.com
2. Crée un compte puis un projet gratuit.
3. Attends que le projet soit prêt.

Supabase propose actuellement un plan Free avec notamment une base de données,
l'authentification et du stockage. Pour cette petite plateforme, c'est adapté au démarrage.

## Étape 2 — Créer la base et les règles de sécurité

1. Dans Supabase, ouvre **SQL Editor**.
2. Clique **New query**.
3. Ouvre le fichier `SUPABASE_SETUP.sql`.
4. Copie TOUT le contenu dans l'éditeur SQL.
5. Clique **Run**.

Le script crée :
- `profiles` pour les étudiants/professeur ;
- `documents` pour les métadonnées ;
- un bucket privé `documents` pour les PDF ;
- les règles RLS pour empêcher un étudiant d'ajouter/supprimer des PDF.

## Étape 3 — Mettre l'URL et la clé Supabase

Dans Supabase, va dans **Project Settings > API** (ou le bouton **Connect**).

Copie :
- **Project URL**
- **Publishable key** (ou l'ancienne `anon key`)

Ouvre `config.js` et remplace :

```js
window.UPDE_SUPABASE_URL = "COLLER_ICI_LE_PROJECT_URL";
window.UPDE_SUPABASE_KEY = "COLLER_ICI_LA_PUBLISHABLE_KEY";
```

IMPORTANT :
- La Publishable key / anon key est faite pour le navigateur avec RLS.
- Ne mets JAMAIS la `service_role key` dans GitHub.

## Étape 4 — Configurer l'URL du site dans Supabase

Dans **Authentication > URL Configuration** :

Site URL :
`https://bpmamadou100-pixel.github.io/upde/`

Ajoute aussi cette même URL dans les **Redirect URLs**.

## Étape 5 — Créer le compte professeur

Méthode simple :

1. Ouvre ton site et inscris le professeur avec son VRAI email.
2. Confirme l'email si Supabase le demande.
3. Dans Supabase > SQL Editor, exécute :

```sql
update public.profiles
set role = 'prof', level = ''
where lower(email) = lower('TON_VRAI_EMAIL');
```

Remplace `TON_VRAI_EMAIL` par le vrai email du professeur.

Les étudiants peuvent ensuite s'inscrire normalement depuis le site.
Ils reçoivent toujours le rôle `student`.

## Étape 6 — Remplacer les fichiers sur GitHub

Dans le dépôt GitHub `upde`, remplace les anciens fichiers par :

- `index.html`
- `style.css`
- `app.js`
- `config.js`

Les fichiers `server.js`, `package.json`, `node_modules` et `data/db.json`
ne sont plus nécessaires pour GitHub Pages.

## Étape 7 — Attendre le déploiement

Dans GitHub :
- **Actions**
- attendre le rond vert ✅

Puis recharge :
`https://bpmamadou100-pixel.github.io/upde/`

## Sécurité

Les mots de passe ne sont plus enregistrés en clair dans `db.json`.
Supabase Auth gère les mots de passe.
Les étudiants peuvent lire les documents mais seuls les profils marqués `prof`
peuvent publier, modifier ou supprimer des PDF.
