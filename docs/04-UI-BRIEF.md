# Brief UX/UI : AgentClass
Date : 2026-10-20 · Statut : brouillon

## Direction visuelle
- Ambiance : chaleureuse, ludique, lisible. Une vraie salle de classe vue en isométrique, pas un dashboard générique.
- Palette restreinte : ardoise verte pour le tableau, bois clair pour le mobilier, craie pour les textes du tableau, rouge et vert seulement pour l'aller et le retour.
- Polices : Schibsted Grotesk pour l'interface, IBM Plex Mono pour les noms de fichiers.
- Densité moyenne : la salle occupe l'écran, les détails s'ouvrent dans un panneau.
- Animations riches mais légères : points qui voyagent, chaises qui s'allument. `prefers-reduced-motion` respecté.
- Décision du 2026-10-20 (retour sur la maquette à plat) : la salle est une maquette 3D dans une boîte, vue isométrique de trois quarts, qu'on fait tourner à la souris. Un bouton en haut de la page bascule entre « 3D » et « Dessus » (vue de dessus). Rendu en CSS 3D, sans bibliothèque. Dès le lot 2.
- Élèves : un petit personnage pixel art (style jeu rétro, inspiré de la mascotte de l'IA sans la copier) assis à chaque table, un par agent connu. Agent inactif : yeux fermés, « Z z z » animés au-dessus. Agent actif : yeux ouverts, clignement, petite activité sur la table. Chaque élève a un accessoire distinct (bonnet, nœud, casque…) pour le reconnaître. Le prof (agent principal) est plus grand, avec des lunettes.
- Classes : une classe par couple IA + projet (deux projets de Claude = deux classes). Le projet se choisit dans la barre du haut de la classe. La teinte des murs dépend du projet.
- Galerie : le bouton « + » réduit la classe ouverte en vignette (View Transitions) et montre toutes les classes en cartes (plan vu de dessus, nom de l'IA, projet, agents actifs). Une carte « + » ouvre la liste des IA trouvées sur le PC ; les IA sans plugin sont grisées. Ajouter une IA lance la lecture de ses agents (état « Recherche des agents… »).
- Salle à 4 murs. Les murs tournés vers la caméra s'abaissent automatiquement ; rotation libre sur 360°, plus des boutons de rotation et de recentrage au clavier. Chaque mur a une zone `.wall-slot` pour ajouter un décor (tableau au nord, fenêtres à l'ouest, horloge et étagère à l'est, porte au sud).
- Thème : bascule soleil / lune avec pastille glissante dans la barre du haut ; mémorisée, sinon celle du système. La salle garde ses couleurs dans les deux thèmes.
- Toutes les IA peuvent être ajoutées, même sans plugin installé : la classe affiche 3 places libres, le prof dort, et la barre d’état dit que la classe se remplira à l’installation du plugin.
- Placement des tables automatique : 4 au plus par rangée, rangées équilibrées et centrées, la salle s’allonge s’il faut plus de rangées. Jamais de table contre un mur.
- Langue : sélecteur FR | EN dans la barre du haut, mémorisé, sinon la langue du navigateur.
- Mode stream (bouton « Stream », œil) : chemins réduits au nom de fichier, noms de projets remplacés par « Projet A, B… », bandeau visible tant qu’il est actif.
- Logo AgentClass dans la barre du haut, à côté du nom.
- Maquette de référence : `docs/maquettes/salle-iso.html`.

## Palette
| Rôle | Clair | Sombre | Contraste vérifié |
|---|---|---|---|
| Fond de page | `#F2F0E9` craie | `#141A17` | — |
| Surface (panneaux) | `#FFFFFF` | `#1E2622` | — |
| Texte | `#1E2B25` | `#ECEAE3` | à mesurer, cible ≥ 4,5:1 |
| Texte secondaire | `#4A5751` | `#A9B3AD` | à mesurer, cible ≥ 4,5:1 |
| Tableau | `#2F4A3F` ardoise | `#24392F` | — |
| Texte craie sur le tableau | `#F2F0E9` | `#ECEAE3` | à mesurer, cible ≥ 4,5:1 |
| Mobilier | `#C89B6D` bois | `#A87E55` | décor seulement |
| Aller (requête) | `#E5484D` | `#FF6B6B` | sur l'ardoise, `#E5484D` est probablement sous 3:1 : liseré craie ou teinte plus claire, à mesurer |
| Retour (résultat) | `#30A46C` | `#4CC38A` | à mesurer, cible ≥ 3:1 sur l'ardoise |
| Agent actif | halo bois clair plus pictogramme | idem | ne repose pas sur la couleur seule |

Rouge et vert ne suffisent jamais seuls. Aller : point plein avec une flèche. Retour : losange avec une coche.

## Typographie
| Usage | Police | Taille | Graisse |
|---|---|---|---|
| Titres, onglets | Schibsted Grotesk | 18–22 px | 600 |
| Interface | Schibsted Grotesk | 14–16 px | 400–500 |
| Fichiers, chemins, durées | IBM Plex Mono | 12–14 px | 400, chiffres tabulaires |

Schibsted Grotesk : ronde et nette, elle a du caractère sans faire « template ». Plex Mono rend les chemins lisibles et aligne les durées.

## Espacements, rayons, ombres
- Échelle d'espacement : 4, 8, 12, 16, 24, 32.
- Rayons : 6 px pour les contrôles, 10 px pour les panneaux. Rayon intérieur = rayon extérieur moins le padding.
- Ombres : une seule, légère, pour les panneaux. Le décor isométrique utilise des faces plus sombres, pas des ombres floues.

## Composants
- Onglet de session : normal, survol, actif, focus visible, session terminée (grisé).
- Chaise et agent : vide, inactif, actif (halo, pictogramme), alerte de boucle (badge), focus visible.
- Bureau du prof : endormi, actif, avec l'écran du logo.
- Tableau : liste de fichiers ou graphe, zone « hors graphe », points d'aller et de retour.
- Panneau latéral : ouverture, fermeture, fermeture par Échap, focus piégé à l'intérieur.
- Bascules (langue, thème, mode stream), curseur de vitesse : normal, survol, focus, actif, désactivé.
- Bannière de connexion : reconnexion en cours, erreur.

## Écran par écran
### Salle de classe
- Au fond : le tableau, l'élément le plus grand de l'écran.
- Devant : le bureau du prof, avec son petit écran et le logo de l'IA.
- Au centre : les rangées de chaises. Une chaise s'ajoute quand un agent apparaît. Au-delà d'un seuil, les chaises inactives sont regroupées.
- Ce qui doit ressortir : qui est actif, et le trajet des points.
- Sous 768 px : vue « Dessus » par défaut, sans défilement horizontal.

### Panneau agent
Nom, description courte, état, durée, dernier outil utilisé, nombre de fichiers lus.

## Icônes et images
- Icônes : Tabler, via Iconify, licence MIT.
- Logos Claude et OpenAI : kits officiels, sous réserve de leurs règles de marque. Repli : icône neutre et nom de l'IA.
- Décor de la salle : faces CSS 3D (sol, murs, tables en boîtes). Personnages : sprites pixel art générés depuis des grilles de pixels, pas d'illustration dessinée à la main. Référence visuelle : images générées par l'utilisateur le 2026-10-20 (salle isométrique et vue de dessus).

## Animations
- Trajet d'un point : 400 à 700 ms, réglable par le curseur de vitesse. Courbe ease-out.
- Chaise qui s'allume : fondu de 200 ms.
- Jamais de `transition: all`. Avec `prefers-reduced-motion`, pas de trajet : les nœuds clignotent une fois.
- Pas d'animation au scroll.

## Ton des textes
Tutoiement, détendu, phrases courtes. Exemple : « Pas encore de graphe. Lance `/graphify` dans ton projet. »

## Accessibilité
- WCAG AA, et des formes en plus des couleurs.
- Navigation complète au clavier : onglets, chaises, nœuds, panneaux.
- Une région `aria-live` discrète résume l'activité (« 2 agents actifs »).
- Zones de clic d'au moins 44 × 44 px sur mobile.

## Questions ouvertes
- Contrastes réels du rouge et du vert sur l'ardoise : à mesurer au lot 4, teintes ajustables.
- Seuil de chaises à partir duquel on regroupe les inactives.
- Police « craie » pour les titres du tableau : non retenue pour l'instant.
