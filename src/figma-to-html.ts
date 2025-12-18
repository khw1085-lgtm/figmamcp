import WebSocket from 'ws';

// Extract node ID from Figma URL
// URL format: https://www.figma.com/design/...?node-id=840-30364
const FIGMA_URL = 'https://www.figma.com/design/q5aXhPa1WrnmsqcrQn3l5n/Billy_Sprint?node-id=840-30364&t=WnGQYJ11SWgdC6pL-4';
const NODE_ID = '840-30364'; // Extracted from URL
const CHANNEL = 'fel5fwnz'; // Use the same channel
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
  strokes?: Array<{ type: string; color?: { r: number; g: number; b: number; a: number } }>;
  strokeWeight?: number;
  layoutMode?: string;
  layoutWrap?: string;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  itemSpacing?: number;
}

interface FigmaResponse {
  type: string;
  channel?: string;
  data?: any;
  message?: {
    id?: string;
    result?: any;
    error?: string;
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
  // Check backgroundColor first
  if (node.backgroundColor) {
    const bg = node.backgroundColor;
    if (typeof bg === 'object' && 'r' in bg && 'g' in bg && 'b' in bg) {
      return rgbaToCss(bg.r, bg.g, bg.b, bg.a || 1);
    }
  }
  
  // Check fills array
  if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill && typeof fill === 'object') {
      // Handle different fill structures
      if (fill.type === 'SOLID' && fill.color) {
        const color = fill.color;
        if (typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
          return rgbaToCss(color.r, color.g, color.b, color.a || 1);
        }
      }
      // Sometimes color is directly in fill
      if ('r' in fill && 'g' in fill && 'b' in fill) {
        return rgbaToCss(fill.r, fill.g, fill.b, fill.a || 1);
      }
    }
  }
  
  return 'transparent';
}

function getTextColor(node: FigmaNode): string {
  if (node.fills && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill && typeof fill === 'object') {
      if (fill.type === 'SOLID' && fill.color) {
        const color = fill.color;
        if (typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
          return rgbaToCss(color.r, color.g, color.b, color.a || 1);
        }
      }
      // Sometimes color is directly in fill
      if ('r' in fill && 'g' in fill && 'b' in fill) {
        return rgbaToCss(fill.r, fill.g, fill.b, fill.a || 1);
      }
    }
  }
  return '#000000';
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

function getBorder(node: FigmaNode): string {
  if (!node.strokes || node.strokes.length === 0 || !node.strokeWeight) return '';
  
  const stroke = node.strokes[0];
  const color = stroke.color 
    ? rgbaToCss(stroke.color.r, stroke.color.g, stroke.color.b, stroke.color.a)
    : '#000000';
  
  return `${node.strokeWeight}px solid ${color}`;
}

function nodeToHTML(node: FigmaNode | null | undefined, depth: number = 0, parentX: number = 0, parentY: number = 0): string {
  if (!node) return '';
  
  const indent = '  '.repeat(depth);
  const nodeType = node.type || 'UNKNOWN';
  const tagName = nodeType === 'TEXT' ? 'p' : 
                  nodeType === 'FRAME' || nodeType === 'GROUP' ? 'div' :
                  nodeType === 'RECTANGLE' ? 'div' :
                  'div';
  
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
  
  const border = getBorder(node);
  if (border) {
    styles.push(`border: ${border}`);
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
  
  // Layout properties for frames
  if (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL') {
    styles.push(`display: flex`);
    styles.push(`flex-direction: ${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'}`);
    
    if (node.primaryAxisAlignItems) {
      const alignMap: Record<string, string> = {
        'MIN': 'flex-start',
        'CENTER': 'center',
        'MAX': 'flex-end',
        'SPACE_BETWEEN': 'space-between'
      };
      styles.push(`justify-content: ${alignMap[node.primaryAxisAlignItems] || 'flex-start'}`);
    }
    
    if (node.counterAxisAlignItems) {
      const alignMap: Record<string, string> = {
        'MIN': 'flex-start',
        'CENTER': 'center',
        'MAX': 'flex-end',
        'STRETCH': 'stretch'
      };
      styles.push(`align-items: ${alignMap[node.counterAxisAlignItems] || 'flex-start'}`);
    }
    
    if (node.itemSpacing) {
      styles.push(`gap: ${node.itemSpacing}px`);
    }
  }
  
  if (node.type === 'TEXT' && node.style) {
    const textStyle = getTextStyle(node);
    if (textStyle) {
      styles.push(textStyle);
    }
    styles.push(`color: ${getTextColor(node)}`);
  }
  
  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
  const nodeName = node.name || 'unnamed';
  const className = `figma-${nodeType.toLowerCase()} ${nodeName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  
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

function generateHTML(node: FigmaNode): string {
  if (!node) {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Figma Design</title>
</head>
<body>
  <p>No design data available.</p>
</body>
</html>`;
  }
  
  // Find the bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  function traverse(n: FigmaNode, offsetX: number = 0, offsetY: number = 0) {
    const x = (n.x || 0) + offsetX;
    const y = (n.y || 0) + offsetY;
    const width = n.width || 0;
    const height = n.height || 0;
    
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
    
    if (n.children) {
      n.children.forEach(child => traverse(child, x, y));
    }
  }
  
  traverse(node);
  
  const containerWidth = maxX - minX || node.width || 800;
  const containerHeight = maxY - minY || node.height || 600;
  
  const htmlNode = nodeToHTML(node, 2);
  
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${node.name || 'Figma Design'}</title>
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
      align-items: flex-start;
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
      white-space: pre-wrap;
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
${htmlNode}
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

async function getFigmaNode(): Promise<void> {
  console.log(`🔌 Connecting to Figma WebSocket server at ${WS_URL}...`);
  console.log(`📡 Channel: ${CHANNEL}`);
  console.log(`🎨 Fetching node: ${NODE_ID}`);
  console.log(`📄 Figma URL: ${FIGMA_URL}\n`);
  
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
      
      // Wait a bit then request node info
      setTimeout(() => {
        const commandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Try different node ID formats
        const nodeIdFormats = [
          NODE_ID,                    // Original: 840-30364
          NODE_ID.replace('-', ':'),  // With colon: 840:30364
          `I${NODE_ID.replace('-', ':')}`, // With I prefix: I840:30364
        ];
        
        // First try to get selection (if user has selected the node)
        const selectionCommandId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const selectionRequest = {
          id: selectionCommandId,
          type: 'message',
          channel: CHANNEL,
          message: {
            id: selectionCommandId,
            command: 'get_selection',
            params: {
              commandId: selectionCommandId
            }
          }
        };
        
        ws.send(JSON.stringify(selectionRequest));
        console.log('📤 Sent get_selection command to Figma');
        console.log('💡 Please select the node in Figma, or we will try node ID formats...');
        
        // Then try different node ID formats
        nodeIdFormats.forEach((nodeId, index) => {
          setTimeout(() => {
            const cmdId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const request = {
              id: cmdId,
              type: 'message',
              channel: CHANNEL,
              message: {
                id: cmdId,
                command: 'get_node_info',
                params: {
                  nodeId: nodeId,
                  commandId: cmdId
                }
              }
            };
            
            ws.send(JSON.stringify(request));
            console.log(`📤 Trying node ID format: ${nodeId}`);
          }, (index + 1) * 2000);
        });
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
        
        if (message.type === 'broadcast' && message.message) {
          const msg = message.message;
          
          // Check for errors first
          if (msg.error) {
            console.log(`⚠️  Error: ${msg.error}`);
            // Continue waiting for other responses
            return;
          }
          
          if (msg.result) {
            const nodeData = msg.result;
            console.log('✅ Received node data from Figma');
            
            // Handle different response structures
            let actualNode: FigmaNode | null = null;
            let nodes: FigmaNode[] = [];
            
            // Handle selection response (array of nodes)
            if (Array.isArray(nodeData)) {
              nodes = nodeData;
              if (nodes.length > 0) {
                actualNode = nodes[0]; // Use first selected node
                console.log(`📝 Found ${nodes.length} selected node(s), using the first one`);
              }
            }
            // Check if result has document property (from exportAsync)
            else if (nodeData.document) {
              actualNode = nodeData.document as FigmaNode;
            } 
            // Check if it's a wrapped structure with nodeId
            else if (nodeData.nodeId && nodeData.document) {
              actualNode = nodeData.document as FigmaNode;
            }
            // Direct node structure
            else if (nodeData.type || nodeData.name) {
              actualNode = nodeData as FigmaNode;
            }
            
            if (actualNode) {
              console.log(`📝 Node name: ${actualNode.name || 'Unknown'}`);
              console.log(`📐 Node type: ${actualNode.type || 'Unknown'}`);
              console.log('📦 Debug: First level data structure');
              console.log(JSON.stringify({
                hasFills: !!actualNode.fills,
                fillsType: Array.isArray(actualNode.fills) ? 'array' : typeof actualNode.fills,
                fillsLength: Array.isArray(actualNode.fills) ? actualNode.fills.length : 0,
                hasBackgroundColor: !!actualNode.backgroundColor,
                hasChildren: !!actualNode.children,
                childrenCount: Array.isArray(actualNode.children) ? actualNode.children.length : 0
              }, null, 2));
              console.log('📝 Generating HTML...\n');
              
              const html = generateHTML(actualNode);
              Bun.write('index.html', html);
              
              console.log('✅ HTML file generated: index.html');
              console.log('🎉 Open index.html in your browser to see the design!');
              
              if (!resolved) {
                resolved = true;
                ws.close();
                resolve();
              }
            } else {
              console.log('📦 Full response structure:', JSON.stringify(nodeData, null, 2));
            }
          }
        } else if (message.type === 'error' || message.message?.error) {
          console.error('❌ Error from Figma:', message.error || message.message?.error);
          console.error('💡 Make sure:');
          console.error('   1. The node ID is correct');
          console.error('   2. You have access to the Figma file');
          console.error('   3. The Figma plugin is connected');
        } else if (message.type === 'system') {
          // System messages, ignore
        } else {
          console.log('📦 Response:', JSON.stringify(message, null, 2));
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
        console.error('   3. The node ID is correct and accessible');
        ws.close();
        reject(new Error('Timeout'));
      }
    }, 30000);
  });
}

getFigmaNode().catch((error) => {
  console.error('❌ Failed:', error.message);
  process.exit(1);
});

