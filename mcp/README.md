# got_the_ref — serveur MCP

Connecte l'agent IA d'un client (Claude Code, Codex, Cursor, Hermes) à son compte
got_the_ref, et lui fait appliquer les correctifs décidés par la plateforme — et
rien d'autre.

Il remplace le prompt qu'on copiait à la main : l'agent va chercher lui-même le
statut du compte puis les correctifs, avec les textes exacts à poser.

## Installation

**Claude Code**

```bash
claude mcp add got_the_ref -- npx -y got-the-ref-mcp
```

**Codex**

```bash
codex mcp add got_the_ref -- npx -y got-the-ref-mcp
```

**Cursor** — l'éditeur n'a pas de sous-commande `mcp add` : il a un lien
d'installation, que la modale de la plateforme donne cliquable.

```text
cursor://anysphere.cursor-deeplink/mcp/install?name=got_the_ref&config=<configuration en base64>
```

**Cursor à la main** (`~/.cursor/mcp.json`) **et Hermes** (sa configuration MCP)

```json
{
  "mcpServers": {
    "got_the_ref": {
      "command": "npx",
      "args": ["-y", "got-the-ref-mcp"]
    }
  }
}
```

Puis, dans l'agent :

> Connecte-toi à got_the_ref et applique mes correctifs.

Un code s'affiche. Le client l'ouvre dans son navigateur, le confirme, et l'agent
reçoit sa clé. Une seule fois par poste.

## Ce que l'agent peut faire

| Outil | Rôle |
| --- | --- |
| `got_the_ref_connexion` | Appaire l'agent au compte (code à confirmer dans le navigateur). |
| `got_the_ref_statut` | Offre du compte, site suivi, dernière analyse, chantiers ouverts. |
| `got_the_ref_correctifs` | Les correctifs à appliquer, avec les textes exacts. |
| `got_the_ref_expliquer` | Explique l'analyse et les correctifs. |
| `got_the_ref_signaler` | Rapporte à la plateforme ce qui a été posé. |
| `got_the_ref_deconnexion` | Révoque la clé et efface le fichier local. |

Le prompt MCP `got_the_ref` active l'agent avec sa charte.

## Ce qu'il ne peut pas faire

Le serveur ne sert que trois choses : un statut, des correctifs, une explication
de l'analyse. Il n'écrit pas de code sans rapport, ne rédige pas de texte libre,
ne répond à aucune question générale. Ce n'est pas une consigne qu'on demande à
l'agent de respecter : c'est tout ce que l'API sait produire.

Les chantiers que l'offre du compte ne couvre pas arrivent nommés et **vides** —
il n'y a rien à reconstituer.

## Configuration

| Variable | Rôle |
| --- | --- |
| `GOT_THE_REF_URL` | Adresse de la plateforme. Par défaut `https://gottheref.com`. |
| `GOT_THE_REF_TOKEN` | Clé fournie directement, sans appairage. Pour l'intégration continue. |
| `GOT_THE_REF_CLIENT` | Nom montré au client sur l'écran d'autorisation. |

La clé est rangée dans `~/.got_the_ref/credentials.json`, en `0600`.

## Distribution

Les commandes ci-dessus tiennent sur une ligne parce que `npx` reçoit un nom
court. Ce nom vient de npm — c'est la seule raison de publier.

**1. npm (ce qui donne la commande courte)**

```bash
npm run mcp:build
cd mcp && npm publish --access public
```

Le nom `got-the-ref-mcp` doit être libre. S'il ne l'est pas, on passe au nom
d'organisation (`@gottheref/mcp`) et les commandes s'allongent d'autant.

**2. Archive servie par le site (sans npm)**

`npx` accepte aussi bien un nom qu'une URL de tarball.

```bash
npm run mcp:pack        # dépose public/mcp/got-the-ref-mcp.tgz
```

Puis, côté plateforme :

```bash
NEXT_PUBLIC_MCP_SOURCE=https://gottheref.com/mcp/got-the-ref-mcp.tgz
```

Les commandes affichées dans la modale pointent alors sur l'archive. Elles
fonctionnent, mais elles sont longues : c'est un canal de transition.

**3. Chemin local (pour développer)**

```bash
npm run mcp:build
claude mcp add got_the_ref -- node /chemin/absolu/vers/mcp/dist/index.js
```

## Développement

```bash
npm install
npm run build           # compile vers dist/
GOT_THE_REF_URL=http://localhost:3000 node dist/index.js
```
