import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

console.log('🔧 Setting up Figma MCP Plugin...\n');

// Create MCP config directory if it doesn't exist
const mcpConfigPath = join(homedir(), '.cursor', 'mcp.json');

// Check if Cursor config directory exists
const cursorConfigDir = join(homedir(), '.cursor');
if (!existsSync(cursorConfigDir)) {
  console.log('📁 Creating Cursor config directory...');
  mkdirSync(cursorConfigDir, { recursive: true });
}

// Read existing config if it exists
let mcpConfig: any = { mcpServers: {} };

if (existsSync(mcpConfigPath)) {
  try {
    const existingConfig = Bun.file(mcpConfigPath);
    mcpConfig = await existingConfig.json();
    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }
  } catch (error) {
    console.log('⚠️  Could not read existing config, creating new one...');
  }
}

// Add Figma MCP server configuration
mcpConfig.mcpServers.figma = {
  command: 'bun',
  args: ['run', 'src/socket.ts'],
  env: {}
};

// Write config file
writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));

console.log('✅ MCP configuration saved to:', mcpConfigPath);
console.log('\n📋 Next steps:');
console.log('   1. Run "bun socket" to start the WebSocket server');
console.log('   2. Install "Cursor Talk To Figma MCP Plugin" in Figma');
console.log('   3. Run the plugin in Figma and enable "Use localhost"');
console.log('   4. Copy the address shown in Figma plugin');
console.log('   5. Use it in Cursor to connect to Figma\n');


