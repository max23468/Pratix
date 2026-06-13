# React Doctor

React Doctor è il controllo di qualità React usato da Pratix prima delle release major/minor o modifiche React trasversali.

## Comando

```sh
npm run quality:react-doctor
```

Il comando esegue una scansione completa con la versione latest di React Doctor.

## Soglia operativa

La soglia richiesta per il gate è `100/100`.

Per rendere il punteggio stabile e utile, `doctor.config.json` separa:

- i fix meccanici o a basso rischio, che vanno corretti nel codice;
- il debito di refactor già noto, che non deve bloccare una release major/minor finché non viene pianificato;
- i componenti shadcn/Radix, che mantengono `forwardRef` per compatibilità interna anche se React 19 lo considera non più necessario;
- superfici generate o riusabili, come tipi Supabase e componenti UI esportati ma non ancora usati.

Quando una regola ignorata diventa oggetto di bonifica, rimuovi prima l'ignore dal config, correggi il codice e poi verifica di nuovo il punteggio.

## Uso nelle release

`scripts/release.mjs` esegue React Doctor quando la release effettiva cambia `X` o `Y` nello schema `X.Y.Z`, quindi per release major/minor e non per semplici patch.

Il controllo non sostituisce build, test, lint e audit: resta un gate aggiuntivo per evitare di arrivare a una release major/minor con nuove diagnostiche React non governate.
