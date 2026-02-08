# Notes

- The certificat.crt file is required to connect to the digital ocean database.

# Exposer l'api local sur le web via une URL

- Lancer le serveur en local
- Se faire un compte sur Pinggy.io (https://dashboard.pinggy.io/)
- Pinggy va créer un tunnel SSH entre ses serveurs et votre env local
- la commande qui être run par pinggy est la suivante : `ssh -p 443 -R0:127.0.0.1:80 -L4300:127.0.0.1:4300 -o StrictHostKeyChecking=no -o ServerAliveInterval=30 <HASH>@free.pinggy.io`
- Executer cette commande en local (dans un autre terminal) (un terminal fait tourner le serveur, l'autre la commande pinggy)
- Une url HTTPS sera affichée dans le terminal (format : `https://lesev-92-151-136-117.a.free.pinggy.link`). Cette url là est utilisable par le web pour se connecter au serveur local
