import WebSocket from 'ws';

const CHANNEL = 'yurxgkel';
const WS_URL = 'ws://localhost:3055';

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
}

interface FigmaResponse {
  type: string;
  channel?: string;
  data?: {
    selection?: FigmaNode[];
    nodes?: FigmaNode[];
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
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
  if (node.style.letterSpacing) {
    styles.push(`letter-spacing: ${node.style.letterSpacing}px`);
  }
  if (node.style.lineHeight) {
    styles.push(`line-height: ${node.style.lineHeight}`);
  }
  
  return styles.join('; ');
}

function nodeToHTML(node: FigmaNode, depth: number = 0): string {
  const indent = '  '.repeat(depth);
  const tagName = node.type === 'TEXT' ? 'p' : 
                  node.type === 'RECTANGLE' || node.type === 'FRAME' ? 'div' :
                  node.type === 'GROUP' ? 'div' : 'div';
  
  const styles: string[] = [];
  
  if (node.width) styles.push(`width: ${node.width}px`);
  if (node.height) styles.push(`height: ${node.height}px`);
  if (node.x !== undefined && node.y !== undefined) {
    styles.push(`position: absolute`);
    styles.push(`left: ${node.x}px`);
    styles.push(`top: ${node.y}px`);
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
  
  if (node.type === 'TEXT' && node.style) {
    const textStyle = getTextStyle(node);
    if (textStyle) {
      styles.push(textStyle);
    }
  }
  
  const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
  const className = `figma-${node.type.toLowerCase()} ${node.name.toLowerCase().replace(/\s+/g, '-')}`;
  
  let content = '';
  if (node.characters) {
    content = node.characters;
  } else if (node.children && node.children.length > 0) {
    content = '\n' + node.children.map(child => nodeToHTML(child, depth + 1)).join('\n') + '\n' + indent;
  }
  
  return `${indent}<${tagName} class="${className}"${styleAttr}>${content}</${tagName}>`;
}

function generateHTML(nodes: FigmaNode[]): string {
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
      padding: 20px;
    }
    
    .container {
      position: relative;
      background-color: white;
      margin: 0 auto;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .figma-text {
      margin: 0;
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

async function connectToFigma() {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('✅ Connected to Figma WebSocket server');
      
      // Join the channel
      ws.send(JSON.stringify({
        type: 'join',
        channel: CHANNEL
      }));
      
      // Request selected nodes
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'getSelection',
          channel: CHANNEL
        }));
      }, 500);
      
      resolve(ws);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      reject(error);
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        const message: FigmaResponse = JSON.parse(data.toString());
        console.log('📨 Received:', message.type);
        
        if (message.type === 'selection' || message.type === 'nodes') {
          const nodes = message.data?.selection || message.data?.nodes || [];
          
          if (nodes.length > 0) {
            console.log(`✅ Received ${nodes.length} node(s) from Figma`);
            const html = generateHTML(nodes);
            
            // Write to index.html
            Bun.write('index.html', html);
            console.log('✅ HTML file generated: index.html');
            
            ws.close();
            process.exit(0);
          } else {
            console.log('⚠️  No nodes received. Make sure you have selected elements in Figma.');
          }
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error);
      }
    });
  });
}

console.log(`🔌 Connecting to Figma WebSocket server at ${WS_URL}...`);
console.log(`📡 Joining channel: ${CHANNEL}`);
console.log('💡 Make sure you have selected elements in Figma!\n');

connectToFigma().catch((error) => {
  console.error('❌ Failed to connect:', error);
  process.exit(1);
});

