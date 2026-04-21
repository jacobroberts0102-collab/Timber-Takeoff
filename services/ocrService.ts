import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import { PDF_WORKER_URL } from '../constants';
import { TextLine } from '../types';
import { aiService } from './aiService';
import { Type } from "@google/genai";

// Handle potentially different import structures (ESM vs CJS interop)
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize worker
if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}

export const performOCR = async (
  file: File, 
  pageRange: number[] | null, 
  onProgress: (progress: number, status: string) => void
): Promise<TextLine[]> => {
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const pagesToProcess = pageRange || Array.from({ length: totalPages }, (_, i) => i + 1);

    const worker = await createWorker('eng', 1, {
      logger: m => {
          if (m.status === 'recognizing text') {
             // Tesseract progress for a single page (0-1)
          }
      }
    });

    const results: TextLine[] = [];
    
    for (let i = 0; i < pagesToProcess.length; i++) {
        const pageNum = pagesToProcess[i];
        if (pageNum > totalPages) continue;

        onProgress((i / pagesToProcess.length) * 100, `Processing page ${pageNum} of ${totalPages}...`);

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // Scale 2.0 for better OCR accuracy
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) continue;

        await page.render({ canvasContext: ctx, viewport }).promise;
        
        // Convert canvas to image data url or blob
        const image = canvas.toDataURL('image/png');
        
        const { data } = await worker.recognize(image);
        
        data.lines.forEach(line => {
            if (line.text.trim().length > 0) {
                const topLeft = viewport.convertToPdfPoint(line.bbox.x0, line.bbox.y0);
                const bottomRight = viewport.convertToPdfPoint(line.bbox.x1, line.bbox.y1);
                
                const rX = Math.min(topLeft[0], bottomRight[0]);
                const rY = Math.min(topLeft[1], bottomRight[1]);
                const rW = Math.abs(bottomRight[0] - topLeft[0]);
                const rH = Math.abs(bottomRight[1] - topLeft[1]);

                results.push({
                    text: line.text.trim(),
                    page: pageNum,
                    rect: [rX, rY, rW, rH],
                    formattedWords: []
                });
            }
        });
    }
    
    await worker.terminate();
    onProgress(100, 'OCR Complete');
    return results;
};

export const performAiOCR = async (
  file: File,
  pageRange: number[] | null,
  onProgress: (progress: number, status: string) => void
): Promise<TextLine[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    const pagesToProcess = pageRange || Array.from({ length: totalPages }, (_, i) => i + 1);

    const results: TextLine[] = [];
    let completedPages = 0;

    // Parallelize processing up to a reasonable limit (e.g., 5 pages at a time)
    const BATCH_SIZE = 5;
    for (let i = 0; i < pagesToProcess.length; i += BATCH_SIZE) {
        const batch = pagesToProcess.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (pageNum) => {
            if (pageNum > totalPages) return [];

            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return [];

            await page.render({ canvasContext: ctx, viewport }).promise;
            const base64Data = canvas.toDataURL('image/png').split(',')[1];

            const prompt = `
                Extract all text from this timber takeoff document. 
                Format the output as a JSON array of objects, where each object has a "text" property.
                Preserve the structure and sequence of the text as it appears on the page.
                Only return the JSON.
            `;

            const response = await aiService.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: 'image/png', data: base64Data } }
                        ]
                    }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING }
                            },
                            required: ["text"]
                        }
                    }
                }
            });

            const pageResults: TextLine[] = [];
            try {
                const extracted = JSON.parse(response.text);
                if (Array.isArray(extracted)) {
                    extracted.forEach((item: any) => {
                        if (item.text) {
                            pageResults.push({
                                text: item.text.trim(),
                                page: pageNum,
                                rect: [0, 0, 0, 0],
                                formattedWords: []
                            });
                        }
                    });
                }
            } catch (e) {
                console.error(`Failed to parse AI OCR response for page ${pageNum}`, e);
            }

            completedPages++;
            onProgress((completedPages / pagesToProcess.length) * 100, `AI analyzed page ${completedPages} of ${totalPages}...`);
            return pageResults;
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(r => results.push(...r));
    }

    onProgress(100, 'AI OCR Complete');
    return results;
};
