# Prof Ingé

Tuteur IA pour le cycle ingénieur : importe tes cours (PDF, Word, photos), obtiens des explications avec exemples, envoie des exercices en photo, génère des fiches de révision et des QCM.

**Site :** https://erickyouness-code.github.io/prof-inge1/

## Utilisation

1. Ouvre le site et clique sur « Ajouter ma clé API ».
2. Colle une clé API Anthropic (à créer sur https://console.anthropic.com/settings/keys, après avoir ajouté du crédit).
3. La clé reste uniquement dans ton navigateur. Tes cours et discussions sont enregistrés sur l'appareil.

## Structure

- `src.html` : le code source de l'application
- `standalone/shim.js` : connexion à l'API Claude avec ta clé (version site)
- `vendor/` : bibliothèques intégrées (MathJax, math.js, marked, DOMPurify, SDK Anthropic)
- `build.py` : génère `docs/index.html` (le site GitHub Pages) et `index.html` (version artifact claude.ai)

Après une modification de `src.html`, lance `python3 build.py`.
