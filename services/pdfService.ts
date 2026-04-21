import * as pdfjsLib from 'pdfjs-dist';
import { PDF_WORKER_URL } from '../constants';
import { TextLine } from '../types';

// Handle potentially different import structures (ESM vs CJS interop)
// In some environments, the default export contains the library methods.
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize worker
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}

export const extractTextFromPdf = async (file: File): Promise<{ textLines: TextLine[]; pageCount: number; info: any }> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Use the resolved pdfjs object
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    
    // Get Metadata
    const metadataResult = await pdf.getMetadata().catch(() => ({ info: {} }));
    
    const allTextLines: TextLine[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];
      const styles = textContent.styles;
      
      // Group items by Y coordinate (row) with tolerance
      const tolerance = 5; // Reduced tolerance slightly to avoid merging tight lines
      const linesMap = new Map<number, { x: number, y: number, width: number, height: number, text: string, isFormatted: boolean }[]>();
      
      for (const item of items) {
        const transform = item.transform;
        const x = transform[4];
        const y = transform[5]; // PDF Y is usually bottom-up
        const width = item.width;
        const height = item.height;
        
        // Font Analysis for Bold/Italic
        let isFormatted = false;
        if (styles && item.fontName && styles[item.fontName]) {
            const font = styles[item.fontName];
            
            // Check multiple properties for bold/italic indicators
            const fontFamily = (font.fontFamily || "").toLowerCase();
            const fontName = (font.name || item.fontName || "").toLowerCase();
            
            // Keywords that indicate formatting
            const formatKeywords = ['bold', 'italic', 'black', 'heavy', 'oblique', 'demi', 'med'];
            
            isFormatted = formatKeywords.some(kw => fontFamily.includes(kw) || fontName.includes(kw));
            
            // Also check font weight if available (numeric)
            // Note: pdf.js sometimes puts this in descriptor
            if (!isFormatted && font.descent !== undefined) {
               // Heuristic: sometimes purely bold fonts don't have typical names but rely on descriptor flags
               // We rely on name mostly for pdf.js textContent
            }
        }

        // Find existing bucket
        let bucketY = y;
        let found = false;
        
        for (const existingY of linesMap.keys()) {
            if (Math.abs(existingY - y) < tolerance) {
                bucketY = existingY;
                found = true;
                break;
            }
        }
        
        if (!found) {
            linesMap.set(y, []);
            bucketY = y;
        }
        
        linesMap.get(bucketY)?.push({ x, y, width, height, text: item.str, isFormatted });
      }

      // Sort rows top to bottom (PDF Y is bottom-up, so higher Y is higher on page)
      const sortedY = Array.from(linesMap.keys()).sort((a, b) => b - a);
      
      for (const y of sortedY) {
          // Sort items left to right
          const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
          
          let lineText = '';
          let lastXEnd = -100;
          const formattedWords: string[] = [];

          // Calculate bounding box for the whole line
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          
          for (const item of lineItems) {
              // Update Bounds
              if (item.x < minX) minX = item.x;
              if (item.x + item.width > maxX) maxX = item.x + item.width;
              if (item.y < minY) minY = item.y;
              if (item.y + item.height > maxY) maxY = item.y + item.height;

              // Capture formatted words
              if (item.isFormatted && item.text.trim().length > 0) {
                  formattedWords.push(item.text);
              }

              // Join Text logic
              // Detect column gaps (heuristic) and insert delimiter
              if (lastXEnd > 0) {
                  const gap = item.x - lastXEnd;
                  // Reduced threshold from 15 to 9 to catch tighter columns (e.g. "LOWER TIE DOWNS" vs "SCREWBOLT")
                  if (gap > 9) {
                      lineText += '   '; // Triple space for column break
                  } else if (gap > 5) {
                      lineText += ' ';
                  } else if (gap > 0.5) {
                      if (item.text.trim().length > 0) {
                          lineText += ' '; 
                      }
                  }
              }
              
              lineText += item.text;
              lastXEnd = item.x + item.width;
          }
          
          if (lineText.trim()) {
            allTextLines.push({
                text: lineText.trim(),
                page: i,
                rect: [minX, minY, maxX - minX, maxY - minY], // [x, y, w, h]
                formattedWords
            });
          }
      }
    }
    
    return {
      textLines: allTextLines,
      pageCount: pdf.numPages,
      info: metadataResult.info
    };
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error('Could not extract text from PDF. It might be scanned or image-based.', { cause: error });
  }
};
