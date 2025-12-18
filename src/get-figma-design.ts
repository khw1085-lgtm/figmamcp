import WebSocket from 'ws';

const CHANNEL = 'yurxgkel';
const WS_URL = 'ws://localhost:3055';
const MAX_RETRIES = 10;
const RETRY_DELAY = 1000;

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Array<{ type: string; color?: { r: number; g: number; b: number; a: number } }>;
  backgroundColor?: { r: number; g: number; b: number; a: number };
  children?: FigmaNode[];
  style?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    textAlign?: string;
    letterSpacing?: number;
    lineHeight?: number;
  };
  characters?: string;
  cornerRadius?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  opacity?: number;
  effects?: Array<{ type: string; color?: { r: number; g: number; b: number; a: number }; offset?: { x: number; y: number }; radius?: number }>;
}

interface FigmaResponse {
  type: string;
  channel?: string;
  data?: {
    selection?: FigmaNode[];
    nodes?: FigmaNode[];
    node?: FigmaNode;
  };
  error?: string;
}

function rgbaToCss(r: number, g: number, b: number, a: number = 1): string {
  const red = Math.round(r * 255);
  const green = Math.round(g * 255);
  const blue = Math.round(b * 255);
  return `rgba(${red}, ${green}, ${blue}, ${a})`;
}

function getBackgroundColor(node: FigmaNode): string {
  if (node.backgroundColor) {
    return rgbaToCss(
      node.backgroundColor.r,
      node.backgroundColor.g,
      node.backgroundColor.b,
      node.backgroundColor.a
    );
  }
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.color) {
      return rgbaToCss(fill.color.r, fill.color.g, fill.color.b, fill.color.a);
    }
  }
  return 'transparent';
}

function getTextStyle(node: FigmaNode): string {
  if (!node.style) return '';
  
  const styles: string[] = [];
  if (node.style.fontFamily) {
    styles.push(`font-family: '${node.style.fontFamily}', sans-serif`);
  }
  if (node.style.fontSize) {
    styles.push(`font-size: ${node.style.fontSize}px`);
  }
  if (node.style.fontWeight) {
    styles.push(`font-weight: ${node.style.fontWeight}`);
  }
  if (node.style.textAlign) {
    styles.push(`text-align: ${node.style.textAlign}`);
  }
  if (node.style.letterSpacing !== undefined) {
    styles.push(`letter-spacing: ${node.style.letterSpacing}px`);
  }
  if (node.style.lineHeight) {
    styles.push(`line-height: ${node.style.lineHeight}`);
  }
  
  return styles.join('; ');
}

function getBoxShadow(node: FigmaNode): string {
  if (!node.effects || node.effects.length === 0) return '';
  
  const shadows = node.effects
    .filter(effect => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW')
    .map(effect => {
      const offsetX = effect.offset?.x || 0;
      const offsetY = effect.offset?.y || 0;
      const radius = effect.radius || 0;
      const color = effect.color 
        ? rgbaToCss(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
        : 'rgba(0, 0, 0, 0.25)';
      return `${offsetX}px ${offsetY}px ${radius}px ${color}`;
    });
  
  return shadows.length > 0 ? shadows.join(', ') : '';
}

function nodeToHTML(node: FigmaNode, depth: number = 0, parentX: number = 0, parentY: number = 0): string {
  const indent = '  '.repeat(depth);
  const tagName = node.type === 'TEXT' ? 'p' : 
                  node.type === 'RECTANGLE' || node.type === 'FRAME' ? 'div' :
                  node.type === 'GROUP' ? 'div' : 'div';
  
  const styles: string[] = [];
  
  // Calculate relative position
  const relativeX = node.x !== undefined ? node.x - parentX : 0;
  const relativeY = node.y !== undefined ? node.y - parentY : 0;
  
  if (node.width) styles.push(`width: ${node.width}px`);
  if (node.height) styles.push(`height: ${node.height}px`);
  
  // Use relative positioning for children, absolute for root
  if (depth === 0) {
    if (node.x !== undefined) styles.push(`left: ${node.x}px`);
    if (node.y !== undefined) styles.push(`top: ${node.y}px`);
    styles.push(`position: absolute`);
  } else {
    if (relativeX !== 0) styles.push(`margin-left: ${relativeX}px`);
    if (relativeY !== 0) styles.push(`margin-top: ${relativeY}px`);
  }
  
  const bgColor = getBackgroundColor(node);
  if (bgColor !== 'transparent') {
    styles.push(`background-color: ${bgColor}`);
  }
  
  if (node.cornerRadius) {
    styles.push(`border-radius: ${node.cornerRadius}px`);
  }
  
  if (node.paddingLeft || node.paddingRight || node.paddingTop || node.paddingBottom) {
    const padding = [
      node.paddingTop || 0,
      node.paddingRight || 0,
      node.paddingBottom || 0,
      node.paddingLeft || 0
    ].join('px ') + 'px';
    styles.push(`padding: ${padding}`);
  }
  
  if (node.opacity !== undefined && node.opacity < 1) {
    styles.push(`opacity: ${node.opacity}`);
  }
  
  const boxShadow = getBoxShadow(node);
  if (boxShadow) {
    styles.push(`box-shadow: ${boxShadow}`);
  }
  
  if (node.type === 'TEXT' && node.style) {
    const textStyle = getTextStyle(node);
    if (textStyle) {
      styles.push(textStyle);
    }
    styles.push('color: ' + (node.fills?.[0]?.color 
      ? rgbaToCss(node.fills[0].color.r, node.fills[0].color.g, node.fills[0].color.b, node.fills[0].color.a)
      : '#000000'));
  }
  
  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
  const className = `figma-${node.type.toLowerCase()} ${node.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  
  let content = '';
  if (node.characters) {
    content = node.characters;
  } else if (node.children && node.children.length > 0) {
    const currentX = node.x !== undefined ? node.x : parentX;
    const currentY = node.y !== undefined ? node.y : parentY;
    content = '\n' + node.children.map(child => nodeToHTML(child, depth + 1, currentX, currentY)).join('\n') + '\n' + indent;
  }
  
  return `${indent}<${tagName} class="${className}"${styleAttr}>${content}</${tagName}>`;
}

function generateHTML(nodes: FigmaNode[]): string {
  if (nodes.length === 0) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Design</title>
</head>
<body>
  <p>No design elements selected in Figma.</p>
</body>
</html>`;
  }
  
  // Find the bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  function traverse(node: FigmaNode, offsetX: number = 0, offsetY: number = 0) {
    const x = (node.x || 0) + offsetX;
    const y = (node.y || 0) + offsetY;
    const width = node.width || 0;
    const height = node.height || 0;
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
    
    if (node.children) {
      node.children.forEach(child => traverse(child, x, y));
    }
  }
  
  nodes.forEach(node => traverse(node));
  
  const containerWidth = maxX - minX || 800;
  const containerHeight = maxY - minY || 600;
  
  const htmlNodes = nodes.map(node => nodeToHTML(node, 2)).join('\n');
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Design</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #f5f5f5;
      padding: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    .container {
      position: relative;
      background-color: white;
      width: ${containerWidth}px;
      min-height: ${containerHeight}px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .figma-text {
      margin: 0;
      word-wrap: break-word;
    }
    
    .figma-frame,
    .figma-rectangle,
    .figma-group {
      position: relative;
    }
  </style>
</head>
<body>
  <div class="container">
${htmlNodes}
  </div>
</body>
</html>`;
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

async function connectToFigma(): Promise<void> {
  console.log(`🔌 Connecting to Figma WebSocket server at ${WS_URL}...`);
  console.log(`📡 Channel: ${CHANNEL}`);
  console.log('💡 Make sure you have selected elements in Figma!\n');
  
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
      
      // Wait for Figma plugin to send selection automatically
      // Some plugins send selection when elements are selected in Figma
      console.log('⏳ Waiting for Figma to send selected elements...');
      console.log('💡 Please select elements in Figma. The plugin should send them automatically.');
      
      // Also try requesting after a delay
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'getSelection',
          channel: CHANNEL
        }));
        console.log('📤 Sent getSelection request...');
      }, 2000);
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
        console.log('📨 Received message type:', message.type);
        console.log('📦 Message data:', JSON.stringify(message, null, 2));
        
        // Handle various response types
        if (message.type === 'selection' || 
            message.type === 'nodes' || 
            message.type === 'node' ||
            message.type === 'figma-selection' ||
            message.type === 'selected-nodes') {
          const nodes = message.data?.selection || 
                       message.data?.nodes || 
                       message.data?.selectedNodes ||
                       (message.data?.node ? [message.data.node] : [])
                       || (Array.isArray(message.data) ? message.data : [])
                       || (message.selection ? message.selection : [])
                       || (message.nodes ? message.nodes : []);
          
          if (nodes.length > 0) {
            console.log(`✅ Received ${nodes.length} node(s) from Figma`);
            console.log(`📝 Generating HTML...`);
            
            const html = generateHTML(nodes);
            Bun.write('index.html', html);
            
            console.log('✅ HTML file generated: index.html');
            console.log('🎉 Open index.html in your browser to see the design!');
            
            if (!resolved) {
              resolved = true;
              ws.close();
              resolve();
            }
          } else {
            console.log('⚠️  No nodes received. Make sure you have selected elements in Figma.');
            console.log('💡 Try selecting some elements in Figma and run this command again.');
          }
        } else if (message.type === 'error') {
          console.error('❌ Error from Figma:', message.error);
        } else {
          console.log('ℹ️  Received other message type:', message.type);
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.error('❌ Timeout: No response from Figma');
        console.error('💡 Make sure:');
        console.error('   1. WebSocket server is running (bunx cursor-talk-to-figma-socket)');
        console.error('   2. Figma plugin is connected');
        console.error('   3. You have selected elements in Figma');
        ws.close();
        reject(new Error('Timeout'));
      }
      }, 30000);
  });
}

connectToFigma().catch((error) => {
  console.error('❌ Failed:', error.message);
  process.exit(1);
});

