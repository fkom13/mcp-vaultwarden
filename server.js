import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from './src/tools/definitions.js';
import dotenv from 'dotenv';

dotenv.config();

const server = new McpServer({
    name: "vaultwarden-mcp",
    version: "1.0.0",
    description: "Un MCP pour interagir avec une instance Vaultwarden via la CLI Bitwarden (bw)."
});

// Register all tools from definitions
for (const toolName in tools) {
    const tool = tools[toolName];

    const inputSchemaLiteral = {};
    if (tool.schema && tool.schema.shape) {
        for (const key in tool.schema.shape) {
            inputSchemaLiteral[key] = tool.schema.shape[key];
        }
    }

    server.registerTool(toolName, {
        title: tool.title || toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: tool.description,
        inputSchema: inputSchemaLiteral,
    }, async (params) => {
        try {
            const result = await tool.execute(params);
            if (result.error) {
                return { content: [{ type: "text", text: `ERREUR: ${result.error}` }], isError: true };
            }
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error) {
            return { content: [{ type: "text", text: `ERREUR: ${error.message}` }], isError: true };
        }
    });
}

async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("MCP Vaultwarden démarré et connecté.");
    } catch (error) {
        console.error(`Erreur fatale au démarrage du MCP: ${error.message}`);
        process.exit(1);
    }
}

main();
