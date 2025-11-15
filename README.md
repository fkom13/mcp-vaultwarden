# 🔐 MCP Vaultwarden Server

[![NPM Version](https://img.shields.io/npm/v/mcp-vaultwarden-server.svg)](https://www.npmjs.com/package/mcp-vaultwarden-server) [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)

Un serveur MCP (Model-Context-Protocol) qui expose une interface simple et robuste pour interagir avec une instance **Vaultwarden** auto-hébergée. Il agit comme un wrapper autour de la CLI officielle de Bitwarden (`bw`), permettant à des agents IA ou des scripts d'automatisation de gérer des secrets de manière programmatique.

## 🤔 Pourquoi ce projet ?

Vaultwarden est une alternative populaire et légère à Bitwarden, mais son automatisation peut être complexe. La CLI officielle (`bw`) nécessite une gestion manuelle de la session (login, unlock, etc.), ce qui n'est pas idéal pour une utilisation par des agents IA ou dans des scripts non-interactifs.

Ce MCP résout ce problème en :
- **Gérant automatiquement la session :** Il déverrouille le coffre à la demande et maintient la session active en cache.
- **Exposant des outils simples :** Fournit des fonctions claires (`get_secret`, `list_secrets`, etc.) via le protocole MCP.
- **Prévenant les blocages :** Intègre des timeouts et un système de verrouillage pour gérer les accès concurrents de manière fiable.

## ✨ Fonctionnalités

- **Auto-déverrouillage :** Le coffre est déverrouillé à la première requête et la clé de session est mise en cache.
- **Gestion des Conflits :** Un mécanisme de "lock" empêche les déverrouillages multiples et concurrents.
- **API Complète :** Supporte la lecture, la création, la mise à jour et la suppression de secrets.
- **Modèles de Secrets :** Fournit des templates JSON pour créer de nouveaux éléments facilement.
- **Sécurité :** S'appuie sur la CLI `bw` officielle pour toutes les opérations cryptographiques.

---

## ⚠️ Prérequis

Pour que ce serveur fonctionne, la machine qui l'exécute **doit avoir la CLI Bitwarden (`bw`) installée** et accessible dans le `PATH`.

Suivez les instructions d'installation officielles : [Installer la CLI Bitwarden](https://bitwarden.com/help/cli/).

---

## 📦 Installation

### Méthode 1 : Via NPM (Recommandé)

C'est la méthode la plus simple pour une utilisation avec un client MCP comme `gemini-cli`.

Configurez votre client pour qu'il lance le serveur via `npx` :

```json
{
  "mcpServers": {
    "vaultwarden": {
      "command": "npx",
      "args": [
        "mcp-vaultwarden-server"
      ],
      "env": {
        "BITWARDEN_HOST": "https://votre-instance.vaultwarden.com",
        "BW_CLIENTID": "user.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        "BW_CLIENTSECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "BW_MASTER_PASSWORD": "votre-mot-de-passe-maitre"
      }
    }
  }
}
```

### Méthode 2 : Depuis les Sources (Git)

1.  **Clonez le dépôt :**
    ```bash
    git clone https://github.com/fkom13/mcp-vaultwarden.git
    cd mcp-vaultwarden
    ```

2.  **Installez les dépendances :**
    ```bash
    npm install
    ```

3.  **Configurez et lancez :**
    Créez un fichier `.env` à partir de `.env.example` et remplissez-le, puis lancez le serveur.
    ```bash
    cp .env.example .env
    nano .env
    node server.js
    ```

---

## 🔒 Configuration & Sécurité

La configuration se fait via des variables d'environnement.

- `BITWARDEN_HOST`: L'URL de votre instance Vaultwarden.
- `BW_CLIENTID`: Votre Client ID d'API.
- `BW_CLIENTSECRET`: Votre Client Secret d'API.
- `BW_MASTER_PASSWORD`: Votre mot de passe principal.

**AVERTISSEMENT DE SÉCURITÉ :**
La gestion du `BW_MASTER_PASSWORD` est critique.
- **Ne jamais commiter** votre fichier `.env` ou vos secrets dans un dépôt Git.
- Pour une utilisation en production, préférez des méthodes de gestion de secrets plus robustes, comme les secrets de votre orchestrateur (Kubernetes Secrets, Docker Secrets) ou un service dédié (HashiCorp Vault).
- Ce MCP est conçu pour être exécuté dans un environnement contrôlé et sécurisé.

---

## 🧰 Référence des Outils (API)

Voici les outils exposés par ce MCP, avec des exemples d'appels.

### `get_secret`
Récupère un secret par son nom ou son ID.

```json
{
  "tool": "get_secret",
  "arguments": {
    "name": "API Key - OpenAI"
  }
}
```

### `list_secrets`
Recherche des secrets contenant un terme.

```json
{
  "tool": "list_secrets",
  "arguments": {
    "search_term": "database"
  }
}
```

### `get_secret_template`
Obtient un modèle JSON pour créer un nouveau secret.

```json
{
  "tool": "get_secret_template",
  "arguments": {
    "type": "login"
  }
}
```
*Types valides : `login`, `note`, `card`, `identity`.*

### `create_secret`
Crée un nouvel élément. Utilisez d'abord `get_secret_template`.

```json
{
  "tool": "create_secret",
  "arguments": {
    "item_json": "{\\\"type\\\":1,\\\"name\\\":\\\"Mon Nouveau Login\\\",\\\"notes\\\":\\\"Ceci est une note secrète.\\\",\\\"favorite\\\":false,\\\"login\\\":{\\\"username\\\":\\\"monuser\\\",\\\"password\\\":\\\"MonP@ssw0rd!\\\",\\\"uris\\\":[{\\\"uri\\\":\\\"https://example.com\\\"}]}}"
  }
}
```
*Note : Le JSON doit être une chaîne de caractères échappée.*

### `update_secret`
Met à jour un secret existant par son ID.

```json
{
  "tool": "update_secret",
  "arguments": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "item_json": "{\\\"name\\\":\\\"Ancien Login (Mis à jour)\\\"}"
  }
}
```

### `delete_secret`
Supprime un secret par son ID.

```json
{
  "tool": "delete_secret",
  "arguments": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

### `sync`
Force la synchronisation du coffre local avec le serveur distant.

```json
{
  "tool": "sync",
  "arguments": {}
}
```

---

## 🤝 Contribution
Les contributions sont les bienvenues ! N'hésitez pas à forker le projet et à ouvrir une Pull Request.

## 📝 Licence
MIT
