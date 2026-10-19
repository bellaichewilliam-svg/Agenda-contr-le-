# ✉️ Envoi automatique des reçus par mail

Quand une de **vos** courses est **livrée et payée**, la base de données lui donne un numéro de reçu (1, 2, 3… sans trou, comme la loi le demande). Le client reçoit alors automatiquement son reçu (קבלה) par mail, envoyé **depuis votre Gmail**, si il a indiqué son email dans la commande.

Il vous faut d'abord le mode en ligne (Supabase, voir `../README.md`). Ensuite, environ 10 minutes :

## 1. Le script Google (gratuit)

1. Ouvrez https://script.google.com avec votre compte Gmail, puis **Nouveau projet**.
2. Effacez le contenu, collez tout le fichier `recu-gmail.gs`.
3. En haut du fichier, remplacez `CHANGEZ-MOI` par un mot secret à vous (ex. `hop-7391-netanya`), et votre numéro de téléphone.
4. Choisissez la fonction `testEnvoi` en haut, mettez votre email dans le code, cliquez sur **Exécuter** et acceptez les autorisations. Vous devez recevoir un reçu de test.
5. **Déployer → Nouveau déploiement → Type : Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
6. Copiez l'**URL de l'application Web** (elle finit par `/exec`).

## 2. Le déclencheur Supabase

1. Dans Supabase : **Database → Webhooks → Create a new hook**.
2. Table : `orders`, événement : **Update**.
3. Type : **HTTP Request**, méthode **POST**, URL : l'adresse copiée + `?secret=` + votre mot secret
   (ex. `https://script.google.com/macros/s/XXXX/exec?secret=hop-7391-netanya`).
4. Enregistrez. C'est tout : à la prochaine course livrée et payée, le reçu part tout seul.

## Bon à savoir

- Gmail permet environ 100 mails automatiques par jour avec un compte gratuit.
- Les courses des **livreurs partenaires** n'ont pas de reçu à votre nom : c'est le livreur qui encaisse, c'est donc à lui de remettre son propre reçu.
- Sans email client, ou en mode démo, utilisez le bouton **✉️ Reçu par mail** ou **💬 Client** dans votre espace patron.
- Faites valider le format du reçu par votre comptable (mentions obligatoires, numérotation, conservation des copies).

# ✉️ Mail « Confirmez votre email » aux couleurs HOP!

À l'inscription d'un livreur, Supabase envoie un mail de confirmation. Pour qu'il soit à l'image de HOP! et que le lien ramène sur le site :

## 1. L'adresse du site (sinon le lien ouvre « localhost:3000 »)

Dans Supabase : **Authentication → URL Configuration**.

- **Site URL** : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/coursier.html`
- **Redirect URLs → Add URL** : `https://bellaichewilliam-svg.github.io/Agenda-contr-le-/livraison/**`
- **Save**.

## 2. Le mail HOP!

**Authentication → Emails → Templates → Confirm signup** :

- **Subject** : `HOP! · Confirmez votre email pour finir votre inscription`
- **Message body** : effacez tout, collez le contenu du fichier `confirmation-inscription.html`, puis **Save**.

## 3. (Facultatif) Expéditeur « HOP! Livraison »

Sans réglage, l'expéditeur reste « Supabase Auth » et Supabase n'envoie que quelques mails par heure. Pour afficher « HOP! Livraison » et envoyer sans limite gênante, branchez un service d'envoi gratuit (par exemple Brevo, 300 mails par jour) dans **Authentication → Emails → SMTP Settings** : nom de l'expéditeur `HOP! Livraison`, et l'adresse, le serveur et le mot de passe donnés par le service.
