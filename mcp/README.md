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

**Cursor** (`~/.cursor/mcp.json`) **et Hermes** (sa configuration MCP)

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

## Développement

```bash
npm install
npm run build           # compile vers dist/
GOT_THE_REF_URL=http://localhost:3000 node dist/index.js
```
