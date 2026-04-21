import { ParsedLine, ValidationError, ValidationResult } from '../types';

export const validateData = (data: ParsedLine[]): ValidationResult => {
  const errors: ValidationError[] = [];
  const signatureMap = new Map<string, string[]>();

  data.forEach(row => {
    // 1. Missing Required Fields
    if (!row.item || row.item.trim() === '') {
      errors.push({
        rowId: row.id,
        field: 'item',
        message: 'Item description is missing',
        severity: 'error'
      });
    }

    if (!row.section || row.section.trim() === '') {
        errors.push({
          rowId: row.id,
          field: 'section',
          message: 'Section header is missing',
          severity: 'warning'
        });
    }

    // 2. Quantity Logic
    if (row.qty <= 0) {
      errors.push({
        rowId: row.id,
        field: 'qty',
        message: 'Quantity must be greater than 0',
        severity: 'error'
      });
    }

    // 3. Unit Consistency
    if (row.unit === 'L/M') {
      if (!row.length || row.length <= 0) {
        errors.push({
          rowId: row.id,
          field: 'length',
          message: 'L/M items require a valid length',
          severity: 'error'
        });
      }
    }

    if (row.unit === 'EA') {
      if (row.length && row.length > 0) {
        errors.push({
          rowId: row.id,
          field: 'unit',
          message: 'Item is "EA" but has a length value. Should this be L/M?',
          severity: 'warning'
        });
      }
    }

    // 4. Totals
    if (row.total <= 0) {
        errors.push({
            rowId: row.id,
            field: 'total',
            message: 'Total calculation results in zero or negative',
            severity: 'error'
        });
    }

    // 5. Numeric Checks
    if (isNaN(row.qty)) {
        errors.push({ rowId: row.id, field: 'qty', message: 'Invalid number', severity: 'error' });
    }

    // Duplicate Signature Generation
    // We create a composite key of all data fields + original line context
    const sig = JSON.stringify({
        s: row.section,
        ss: row.subSection,
        i: row.item,
        d: row.dimensions,
        g: row.grade,
        q: row.qty,
        l: row.length,
        u: row.unit,
        // Including originalLine is crucial for "repeated blocks" detection vs "intentional same item"
        // If originalLine is missing (manual add), we treat it as unique unless all fields match exactly
        o: row.originalLine ? row.originalLine.trim() : 'manual' 
    });
    
    if (!signatureMap.has(sig)) signatureMap.set(sig, []);
    signatureMap.get(sig)!.push(row.id);
  });

  // 6. Duplicate Content Check
  signatureMap.forEach((ids) => {
      if (ids.length > 1) {
          ids.forEach(id => {
              errors.push({
                  rowId: id,
                  field: 'general',
                  message: 'Potential duplicate item (identical content detected)',
                  severity: 'warning'
              });
          });
      }
  });

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors
  };
};