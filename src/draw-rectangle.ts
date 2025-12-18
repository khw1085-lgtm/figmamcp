import WebSocket from 'ws';

const CHANNEL = 'fel5fwnz';
const WS_URL = 'ws://localhost:3055';
const MAX_RETRIES = 10;
const RETRY_DELAY = 1000;

interface FigmaResponse {
  type: string;
  channel?: string;
  data?: any;
  error?: string;
}

async function waitForServer(retries: number = MAX_RETRIES): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const ws = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Timeout'));
        }, 1000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });
        
        ws.on('error', () => {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        });
      });
      return true;
    } catch (error) {
      if (i < retries - 1) {
        console.log(`⏳ Waiting for server... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  return false;
}

async function drawRectangle(): Promise<void> {
  console.log(`🔌 Connecting to Figma WebSocket server at ${WS_URL}...`);
  console.log(`📡 Channel: ${CHANNEL}`);
  console.log('🎨 Drawing rectangle in Figma...\n');
  
  // Wait for server to be available
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.error('❌ WebSocket server is not running!');
    console.error('💡 Please run: bunx cursor-talk-to-figma-socket');
    process.exit(1);
  }
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let resolved = false;
    
    ws.on('open', () => {
      console.log('✅ Connected to Figma WebSocket server');
      
      // Join the channel
      ws.send(JSON.stringify({
        type: 'join',
        channel: CHANNEL
      }));
      
      // Wait a bit then send rectangle creation command
      setTimeout(() => {
        // Generate unique ID for the command
        const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const request = {
          id: commandId,
          type: 'message',
          channel: CHANNEL,
          message: {
            id: commandId,
            command: 'create_rectangle',
            params: {
              x: 100,
              y: 100,
              width: 200,
              height: 150,
              name: 'Rectangle',
              commandId: commandId
            }
          }
        };
        
        ws.send(JSON.stringify(request));
        console.log('📤 Sent create_rectangle command to Figma');
        console.log('📋 Parameters:', JSON.stringify(request.message.params, null, 2));
      }, 1000);
    });
    
    ws.on('error', (error) => {
      if (!resolved) {
        console.error('❌ WebSocket error:', error);
        reject(error);
        resolved = true;
      }
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message: FigmaResponse = JSON.parse(data.toString());
        console.log('📨 Received:', message.type);
        
        // Handle response messages
        if (message.type === 'broadcast' && message.message?.result) {
          const result = message.message.result;
          console.log('✅ Rectangle created successfully!');
          console.log(`📐 Rectangle ID: ${result.id}`);
          console.log(`📍 Position: (${result.x}, ${result.y})`);
          console.log(`📏 Size: ${result.width} x ${result.height}`);
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve();
          }
        } else if (message.type === 'response' || message.type === 'message') {
          const responseData = message.data || message.result || message;
          if (responseData.id || responseData.command === 'create_rectangle') {
            console.log('✅ Rectangle created successfully!');
            console.log('📦 Response:', JSON.stringify(message, null, 2));
            if (!resolved) {
              resolved = true;
              ws.close();
              resolve();
            }
          } else {
            console.log('📦 Response:', JSON.stringify(message, null, 2));
          }
        } else if (message.type === 'error') {
          console.error('❌ Error from Figma:', message.error || message.message);
        } else if (message.type === 'system') {
          // System messages, ignore
        } else {
          console.log('📦 Response:', JSON.stringify(message, null, 2));
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });
    
    // Timeout after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('⏱️  Timeout reached. The command may have been sent.');
        console.log('💡 Check Figma to see if the rectangle was created.');
        ws.close();
        resolve();
      }
    }, 15000);
  });
}

drawRectangle().catch((error) => {
  console.error('❌ Failed:', error.message);
  process.exit(1);
});

