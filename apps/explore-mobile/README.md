# Welcome to your Expo app 👋

## To recover

Compte admin de test?
Compte admin global?
Compte de tests?
API de staging/de test?

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npm run start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Utiliser un serveur local

- Suivre `Exposer l'api local sur le web via une URL` depuis le README de gdv-api
- Récupérer l'url HTTPS pinggy et la copier dans le .env de gdv-mobile (EXPO_PUBLIC_API_URL=<URL_PINGGY>)
- lancer gdv-mobile via `npm run start`

## Build l'app

- Aller sur `https://expo.dev/accounts/runes-de-chene/projects/guilde-des-voyageurs` avec le compte tech de chênes
- cliquer sur `Build from github`
- Platform : All
- environment : Production
- EAS submit: check

## Deploy l'app

- Une fois les jobs Expo fini, aller sur google pour déployer l'app (section terter et publier) ou sur apple connect
