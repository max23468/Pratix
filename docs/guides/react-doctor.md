# React Doctor

React Doctor è un gate obbligatorio della qualità React di Pratix.

## Comando

```sh
npm run doctor
```

Il comando esegue una scansione completa con la versione fissata nel lockfile e blocca errori e warning.

## Soglia operativa

La soglia richiesta per il gate è `100/100`.

`doctor.config.json` esclude soltanto output di build e tipi Supabase generati. I finding applicativi vanno corretti alla radice.

## Uso nelle release

`npm run check`, il workflow Quality e il workflow dedicato eseguono React Doctor. Sulle pull request il workflow dedicato analizza le modifiche; sui push a `main` analizza l'intero progetto.

Il controllo non sostituisce build, test, lint e audit: ne completa il gate generale.

Il workflow non pubblica un commento riepilogativo quando non trova finding; usa
soltanto annotazioni inline quando esistono diagnostiche. Un falso positivo viene
segnalato nella PR, soppresso con il meccanismo nativo più stretto e una motivazione
committata, quindi il gate viene rieseguito: non si usano bypass amministrativi o
`continue-on-error`.
