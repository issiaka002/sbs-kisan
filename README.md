# SBS × Kisan · maquette de démonstration

Maquette **non officielle** d'un site pour SBS (Socitech Business Solutions,
Abidjan), distributeur des automates de dépôt d'espèces et compteuses de billets
Kisan. Construite comme test avec le skill
[scroll-craft](https://github.com/nateherkai/scroll-craft). Le formulaire
n'envoie rien.

## Ce que montre la page

- la KD100 dans le noir, avec des billets dessinés qui volent vers la trémie ;
- une photo de terrain qui s'ouvre et s'approche au défilement ;
- quatre photos de situation qui bougent dans leur cadre ;
- un banc de comptage : le défilement devient une minute, deux machines comptent
  côte à côte à leur cadence nominale ;
- la gamme KD100, KD10, KD20, KDL-100 et Newton 3 ;
- un reçu qui s'imprime avec les machines cochées.

## Lancer en local

```bash
python3 -m http.server 4510
```

Puis ouvrir http://localhost:4510.

## Sources et droits

- Données techniques : présentation SBS d'octobre 2025, sauf deux valeurs
  issues de fiches revendeurs et marquées sur la page. Détail dans [CREDITS.md](CREDITS.md).
- Visuels des machines et photos : Kisan Electronics et SBS. Logo : Socitech
  Business Solutions. Ils sont utilisés ici pour une maquette et **ne sont pas
  libres de droits**.
- Moteur `scrollcraft.js` / `scrollcraft.css` : MIT, voir [LICENSE-scrollcraft.txt](LICENSE-scrollcraft.txt).
- Polices : Archivo, Geist et Geist Mono, SIL Open Font License 1.1.
