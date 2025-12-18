import { WebSocketServer, WebSocket } from 'ws';

const PORT = 3055;

const wss = new WebSocketServer({ port: PORT });

console.log(`🚀 WebSocket server started on port ${PORT}`);
console.log(`📡 Waiting for Figma plugin connection...`);

wss.on('connection', (ws: WebSocket) => {
  console.log('✅ Figma plugin connected!');
  
  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Received:', data);
      
      // Echo back or handle the message
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Figma plugin disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'connected',
    message: 'Connected to MCP server',
    port: PORT
  }));
});

wss.on('error', (error) => {
  console.error('❌ Server error:', error);
});

console.log(`\n💡 Copy the following address when Figma plugin shows it:`);
console.log(`   ws://localhost:${PORT}\n`);


