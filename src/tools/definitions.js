import { z } from "zod";
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const TIMEOUT = 40000; // 40 secondes

// --- Session Cache ---
let session = {
    key: null,
    expires: 0,
};
let isUnlocking = false;

// Helper function to get the master password from environment variables
const getMasterPassword = () => {
    const masterPassword = process.env.BW_MASTER_PASSWORD;
    if (!masterPassword) {
        throw new Error("La variable d\\'environnement BW_MASTER_PASSWORD n\\'est pas définie.");
    }
    return masterPassword;
};

// Helper function to get a valid session key, using a cache and a lock
const _getSessionKey = async () => {
    while (isUnlocking) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Wait if another process is already unlocking
    }

    if (session.key && session.expires > Date.now()) {
        return session.key;
    }

    isUnlocking = true;
    try {
        const masterPassword = getMasterPassword();
        const command = `export BW_PASSWORD='${masterPassword}' && bw unlock --passwordenv BW_PASSWORD --raw`;
        const { stdout: sessionKey, stderr: unlockErr } = await execAsync(command, { timeout: TIMEOUT });

        if (unlockErr && !sessionKey) {
            throw new Error(`Erreur lors du déverrouillage: ${unlockErr}`);
        }
        if (!sessionKey) {
            throw new Error("Impossible d'obtenir la clé de session.");
        }

        session.key = sessionKey.trim();
        session.expires = Date.now() + 60000; // Cache the key for 60 seconds

        return session.key;
    } finally {
        isUnlocking = false;
    }
};

const get_secret = {
    title: "Récupérer un secret",
    description: "Récupère les détails d'un secret par son nom ou son ID. Le déverrouillage est automatique.",
    schema: z.object({
        name: z.string().describe("Le nom ou l\\'ID du secret à récupérer."),
    }),
    execute: async (params) => {
        const sessionKey = await _getSessionKey();
        const command = `bw get item "${params.name}" --session "${sessionKey}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: TIMEOUT });
        if (stderr) throw new Error(`Erreur lors de la récupération: ${stderr}`);
        return JSON.parse(stdout);
    }
};

const list_secrets = {
    title: "Lister les secrets",
    description: "Recherche et liste les secrets. Le déverrouillage est automatique.",
    schema: z.object({
        search_term: z.string().describe("Le terme à rechercher dans le nom des secrets."),
    }),
    execute: async (params) => {
        const sessionKey = await _getSessionKey();
        const command = `bw list items --search "${params.search_term}" --session "${sessionKey}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: TIMEOUT });
        if (stderr) throw new Error(`Erreur lors de la recherche: ${stderr}`);
        return JSON.parse(stdout);
    }
};

const create_secret = {
    title: "Créer un secret",
    description: "Crée un nouvel élément dans le coffre-fort. Le déverrouillage est automatique. Il est fortement recommandé d'utiliser l'outil 'get_secret_template' pour obtenir la structure JSON correcte.",
    schema: z.object({
        item_json: z.string().describe("L\\'objet de l\\'élément à créer, au format JSON."),
    }),
    execute: async (params) => {
        const sessionKey = await _getSessionKey();
        const encodedItem = Buffer.from(params.item_json).toString('base64');
        const command = `echo '${encodedItem}' | base64 -d | bw encode | bw create item --session "${sessionKey}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: TIMEOUT });
        if (stderr) throw new Error(`Erreur lors de la création: ${stderr}`);
        return JSON.parse(stdout);
    }
};

const update_secret = {
    title: "Mettre à jour un secret",
    description: "Met à jour un élément existant. Le déverrouillage est automatique.",
    schema: z.object({
        id: z.string().describe("L\\'ID de l\\'élément à mettre à jour."),
        item_json: z.string().describe("L\\'objet de l\\'élément mis à jour, au format JSON."),
    }),
    execute: async (params) => {
        const sessionKey = await _getSessionKey();
        const encodedItem = Buffer.from(params.item_json).toString('base64');
        const command = `echo '${encodedItem}' | base64 -d | bw encode | bw edit item ${params.id} --session "${sessionKey}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: TIMEOUT });
        if (stderr) throw new Error(`Erreur lors de la mise à jour: ${stderr}`);
        return JSON.parse(stdout);
    }
};

const delete_secret = {
    title: "Supprimer un secret",
    description: "Supprime un élément du coffre-fort. Le déverrouillage est automatique.",
    schema: z.object({
        id: z.string().describe("L\\'ID de l\\'élément à supprimer."),
    }),
    execute: async (params) => {
        const sessionKey = await _getSessionKey();
        const command = `bw delete item ${params.id} --session "${sessionKey}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: TIMEOUT });
        if (stderr) throw new Error(`Erreur lors de la suppression: ${stderr}`);
        return { success: true, message: stdout || "Élément supprimé avec succès." };
    }
};

const get_secret_template = {
    title: "Obtenir un modèle de secret",
    description: "Récupère la structure JSON pour un type de secret spécifique (login, note, card, identity).",
    schema: z.object({
        type: z.enum(["login", "note", "card", "identity"]).describe("Le type de secret pour lequel obtenir le modèle."),
    }),
    execute: async (params) => {
        const templates = {
            login: {
                name: "Nom de l\\'élément",
                type: 1,
                login: {
                    uris: [{ match: null, uri: "https://example.com" }],
                    username: "nom_utilisateur",
                    password: "mot_de_passe"
                }
            },
            note: {
                name: "Nom de la note",
                type: 2,
                secureNote: {
                    type: 0
                },
                notes: "Contenu de la note."
            },
            card: {
                name: "Nom de la carte",
                type: 3,
                card: {
                    cardholderName: "",
                    brand: "",
                    number: "",
                    expMonth: "",
                    expYear: "",
                    code: ""
                }
            },
            identity: {
                name: "Nom de l\\'identité",
                type: 4,
                identity: {
                    title: "",
                    firstName: "",
                    middleName: "",
                    lastName: "",
                    address1: "",
                    city: "",
                    state: "",
                    postalCode: "",
                    country: "",
                    company: "",
                    email: "",
                    phone: ""
                }
            }
        };
        const template = templates[params.type];
        if (!template) {
            throw new Error(`Type de modèle inconnu: ${params.type}`);
        }
        return template;
    }
};

const sync = {
    title: "Synchroniser le coffre-fort",
    description: "Force la synchronisation de la base de données locale du coffre-fort avec le serveur distant. Le déverrouillage est automatique.",
    schema: z.object({}),
    execute: async () => {
        const sessionKey = await _getSessionKey();
        const command = `bw sync --session "${sessionKey}"`;
        const { stdout, stderr } = await execAsync(command, { timeout: TIMEOUT });
        if (stderr) throw new Error(`Erreur lors de la synchronisation: ${stderr}`);
        return { success: true, message: stdout || "Synchronisation terminée avec succès." };
    }
};

export const tools = { get_secret, list_secrets, create_secret, update_secret, delete_secret, get_secret_template, sync };