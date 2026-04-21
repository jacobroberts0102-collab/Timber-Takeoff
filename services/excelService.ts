import * as XLSX from 'xlsx';
import { ParsedLine, ExportTemplate, ExportColumn, TextLine, FileMetadata } from '../types';

// --- Import / Extraction Logic ---

export const extractTextFromExcel = async (file: File): Promise<{ textLines: TextLine[]; pageCount: number; info: any }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const allLines: TextLine[] = [];
        let pageIndex = 1;

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          // Get data as array of arrays to preserve row structure
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

          rows.forEach((row, rowIndex) => {
            // Join cells with triple space to simulate visual column spacing found in PDFs
            // This allows the existing Regex parser to treat them as text lines
            const lineText = row
              .filter((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '')
              .map((cell: any) => String(cell).trim())
              .join('   '); 

            if (lineText) {
              allLines.push({
                text: lineText,
                page: pageIndex,
                // Mock rect coordinates [x, y, w, h] - simulate linear flow down the page
                rect: [10, rowIndex * 12, 500, 10]
              });
            }
          });
          pageIndex++;
        });

        resolve({
          textLines: allLines,
          pageCount: workbook.SheetNames.length,
          info: { Title: file.name, Author: 'Excel Import' }
        });
      } catch (err) {
        console.error("Excel extraction failed", err);
        reject(new Error("Failed to parse Excel file"));
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

// --- Default Templates ---

const GENERIC_TEMPLATE: ExportTemplate = {
    id: 'generic',
    name: 'Generic CSV',
    isDefault: false,
    columns: [
        { id: '1', header: 'Section', field: 'section', transform: 'none' },
        { id: '2', header: 'Sub Section', field: 'subSection', transform: 'none' },
        { id: '3', header: 'Item Name', field: 'item', transform: 'none' },
        { id: '4', header: 'Description', field: 'description', transform: 'none' },
        { id: '5', header: 'Dims', field: 'dimensions', transform: 'none' },
        { id: '6', header: 'Grade', field: 'grade', transform: 'none' },
        { id: '7', header: 'Qty', field: 'qty', transform: 'number_0' },
        { id: '8', header: 'Len (m)', field: 'length', transform: 'number_2' },
        { id: '9', header: 'Unit', field: 'unit', transform: 'none' },
        { id: '10', header: 'Total', field: 'total', transform: 'number_2' },
    ]
};

const SPRUCE_TEMPLATE: ExportTemplate = {
    id: 'spruce_erp',
    name: 'Spruce / ERP Import',
    isDefault: true,
    columns: [
        { id: '1', header: 'ProductCode', field: 'spruceItemNo', transform: 'none' },
        { id: '2', header: 'ProductDesc', field: 'spruceDescription', transform: 'none' },
        { id: '3', header: 'Description', field: 'item', transform: 'uppercase', validations: [{ type: 'required' }, { type: 'max_length', value: 50 }] },
        { id: '4', header: 'Dimensions', field: 'dimensions', transform: 'none' },
        { id: '5', header: 'Quantity', field: 'qty', transform: 'number_0', validations: [{ type: 'numeric_only' }] },
        { id: '6', header: 'UM', field: 'unit', transform: 'none' },
        { id: '7', header: 'Length', field: 'length', transform: 'number_2' },
        { id: '8', header: 'Location', field: 'section', transform: 'uppercase', validations: [{ type: 'max_length', value: 30 }] },
        { id: '9', header: 'SubLocation', field: 'subSection', transform: 'uppercase' },
    ]
};

const STORAGE_KEY = 'export_templates_v2'; // Bumped version for isDefault support

// --- Template Repository ---

export const templateService = {
    getTemplates: (): ExportTemplate[] => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                // Try to migrate from v1 if exists
                const v1 = localStorage.getItem('export_templates_v1');
                if (v1) {
                    const parsed = JSON.parse(v1);
                    // Ensure Spruce is marked as default in migration
                    const migrated = parsed.map((t: any) => ({
                        ...t,
                        isDefault: t.id === 'spruce_erp'
                    }));
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                    return migrated;
                }
                // Initialize with defaults if storage is empty
                const defaults = [SPRUCE_TEMPLATE, GENERIC_TEMPLATE];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
                return defaults;
            }
            const templates: ExportTemplate[] = JSON.parse(stored);
            
            let changed = false;

            // Ensure Spruce is default if no default exists (sanity check)
            if (!templates.some(t => t.isDefault)) {
                const spruce = templates.find(t => t.id === 'spruce_erp');
                if (spruce) {
                    spruce.isDefault = true;
                    changed = true;
                }
            }

            // Forced migration/fix: Remove "TakeoffApp" fixed column from Spruce template if it exists
            const spruce = templates.find(t => t.id === 'spruce_erp');
            if (spruce) {
                const initialLen = spruce.columns.length;
                spruce.columns = spruce.columns.filter(c => c.customValue !== 'TakeoffApp');
                if (spruce.columns.length !== initialLen) {
                    changed = true;
                }
            }
            
            if (changed) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
            }
            
            return templates;
        } catch (e) {
            console.error("Failed to load templates", e);
            return [SPRUCE_TEMPLATE, GENERIC_TEMPLATE];
        }
    },

    saveTemplate: (template: ExportTemplate) => {
        let current = templateService.getTemplates();
        
        // If this one is marked as default, unset all others
        if (template.isDefault) {
            current = current.map(t => ({ ...t, isDefault: false }));
        }

        const index = current.findIndex(t => t.id === template.id);
        if (index >= 0) {
            current[index] = template;
        } else {
            current.push(template);
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    },

    deleteTemplate: (id: string) => {
        const current = templateService.getTemplates();
        const filtered = current.filter(t => t.id !== id);
        
        // If we deleted the default, make the first remaining one default or Spruce
        if (current.find(t => t.id === id)?.isDefault && filtered.length > 0) {
            filtered[0].isDefault = true;
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    },

    setDefault: (id: string) => {
        const current = templateService.getTemplates();
        const updated = current.map(t => ({
            ...t,
            isDefault: t.id === id
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
};

// --- Transformation Logic ---

const processValue = (row: ParsedLine, col: ExportColumn, metadata?: FileMetadata | null): string | number | null => {
    if (!row) return '';
    let value: any;

    // 1. Get Base Value
    if (col.field === 'custom_text') {
        value = col.customValue || '';
    } else if (col.field === 'empty') {
        value = '';
    } else if (String(col.field).startsWith('meta_')) {
        // Metadata Injection
        if (!metadata) return '';
        switch (col.field) {
            case 'meta_builder': value = metadata.builder; break;
            case 'meta_site': value = metadata.address; break;
            case 'meta_job': value = metadata.jobNumber; break;
            case 'meta_date': value = metadata.dateStr; break;
            default: value = '';
        }
    } else {
        value = row[col.field as keyof ParsedLine];
    }

    if (value === null || value === undefined) return '';

    // 2. Apply Transform
    switch (col.transform) {
        case 'uppercase':
            return String(value).toUpperCase();
        case 'lowercase':
            return String(value).toLowerCase();
        case 'trim':
            return String(value).trim();
        case 'number_0': {
            const n0 = parseFloat(value);
            return isNaN(n0) ? 0 : Math.round(n0);
        }
        case 'number_2': {
            const n2 = parseFloat(value);
            return isNaN(n2) ? 0.00 : parseFloat(n2.toFixed(2));
        }
        case 'default_val':
            return (!value || value === '') ? (col.customValue || '') : value;
        default:
            return value;
    }
};

export const applyTemplate = (data: ParsedLine[], template: ExportTemplate, metadata?: FileMetadata | null): any[] => {
    return data.filter(row => !!row).map(row => {
        const exportRow: Record<string, any> = {};
        template.columns.forEach(col => {
            exportRow[col.header] = processValue(row, col, metadata);
        });
        return exportRow;
    });
};

export const validateExportData = (data: ParsedLine[], template: ExportTemplate, metadata?: FileMetadata | null): string[] => {
    const errors: string[] = [];
    const validData = data.filter(row => !!row);
    const exportData = applyTemplate(validData, template, metadata);

    for (let i = 0; i < exportData.length; i++) {
        const row = exportData[i];
        const originalRow = validData[i];

        for (const col of template.columns) {
            if (!col.validations || col.validations.length === 0) continue;

            const value = row[col.header];
            const strVal = String(value === null || value === undefined ? '' : value);

            for (const rule of col.validations) {
                if (rule.type === 'required') {
                    if (!strVal || strVal.trim() === '') {
                        errors.push(`Row ${i + 1} (${originalRow.item}): Field '${col.header}' is required but empty.`);
                    }
                }
                else if (rule.type === 'max_length' && rule.value) {
                    if (strVal.length > rule.value) {
                        errors.push(`Row ${i + 1} (${originalRow.item}): Field '${col.header}' exceeds ${rule.value} characters (Found ${strVal.length}).`);
                    }
                }
                else if (rule.type === 'numeric_only') {
                    // Allow empty if not required, check number if present
                    if (strVal && isNaN(Number(value))) {
                        errors.push(`Row ${i + 1} (${originalRow.item}): Field '${col.header}' must be numeric (Found "${strVal}").`);
                    }
                }
                else if (rule.type === 'no_spaces') {
                    if (strVal.includes(' ')) {
                        errors.push(`Row ${i + 1} (${originalRow.item}): Field '${col.header}' cannot contain spaces.`);
                    }
                }
            }
            if (errors.length > 20) return [...errors, "...and more validation errors."];
        }
    }

    return errors;
};

export const exportToCsv = (
    data: ParsedLine[], 
    originalFilename?: string, 
    template: ExportTemplate = SPRUCE_TEMPLATE, 
    metadata?: FileMetadata | null
) => {
  // 1. Prepare Data using Template
  const sheetData = applyTemplate(data, template, metadata);

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  
  // 2. Create Workbook with single sheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Timber Takeoff");

  // 3. Determine Filename and Download
  let exportFilename = "Timber_Takeoff_Export.csv";
  if (originalFilename) {
    // Strip extension
    const namePart = originalFilename.lastIndexOf('.') !== -1 
      ? originalFilename.substring(0, originalFilename.lastIndexOf('.')) 
      : originalFilename;
    // Sanitize template name for filename
    const suffix = template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    exportFilename = `${namePart}_${suffix}.csv`;
  }

  // Force CSV output
  XLSX.writeFile(workbook, exportFilename, { bookType: 'csv' });
};

export const exportToJson = (
    data: ParsedLine[], 
    originalFilename?: string, 
    template: ExportTemplate, 
    metadata?: any | null
) => {
    const sheetData = applyTemplate(data, template, metadata);
    const jsonString = JSON.stringify(sheetData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = originalFilename ? originalFilename.split('.')[0] : 'takeoff';
    link.download = `${name}_export.json`;
    link.click();
};

export const exportToXml = (
    data: ParsedLine[], 
    originalFilename?: string, 
    template: ExportTemplate, 
    metadata?: any | null
) => {
    const sheetData = applyTemplate(data, template, metadata);
    let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n<TakeoffExport>\n';
    
    sheetData.forEach((row, index) => {
        xmlString += `  <Item id="${index + 1}">\n`;
        Object.entries(row).forEach(([key, value]) => {
            const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
            xmlString += `    <${safeKey}>${value}</${safeKey}>\n`;
        });
        xmlString += '  </Item>\n';
    });
    
    xmlString += '</TakeoffExport>';
    
    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = originalFilename ? originalFilename.split('.')[0] : 'takeoff';
    link.download = `${name}_export.xml`;
    link.click();
};
