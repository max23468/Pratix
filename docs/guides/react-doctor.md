# React Doctor

React Doctor e il controllo di qualita React usato da Pratix prima delle release major.

## Comando

```sh
npm run quality:react-doctor
```

Il comando esegue una scansione completa, offline, sul progetto `tanstack_start_ts`.

## Soglia operativa

La soglia richiesta per il gate e `100/100`.

Per rendere il punteggio stabile e utile, `react-doctor.config.json` separa:

- i fix meccanici o a basso rischio, che vanno corretti nel codice;
- il debito di refactor gia noto, che non deve bloccare una major finche non viene pianificato;
- i componenti shadcn/Radix, che mantengono `forwardRef` per compatibilita interna anche se React 19 lo considera non piu necessario;
- superfici generate o riusabili, come tipi Supabase e componenti UI esportati ma non ancora usati.

Quando una regola ignorata diventa oggetto di bonifica, rimuovi prima l'ignore dal config, correggi il codice e poi verifica di nuovo il punteggio.

## Uso nelle release

`scripts/release.mjs` esegue React Doctor solo quando la release effettiva e major, ad esempio `1.0.0` o `2.0.0`.

Il controllo non sostituisce build, test, lint e audit: resta un gate aggiuntivo per evitare di arrivare a una major con nuove diagnostiche React non governate.
