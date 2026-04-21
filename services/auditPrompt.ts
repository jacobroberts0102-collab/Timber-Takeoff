export const generateAuditPrompt = (appFiles: string) => {
    // Escape backticks in the source code to prevent breaking the template literal
    const escapedFiles = appFiles.replace(/`/g, '\\`').replace(/\${/g, '\\${');
    
    return `
### MASTER AUDIT INSTRUCTION
Act as a Product Manager, QA Engineer, UX Reviewer, and Parsing Engineer. Your goal is to perform a deep technical and user-experience audit of the "Timber Takeoff Converter" application.

---

### INPUT CHECKLIST
1. **App Purpose:** Convert complex timber takeoff lists (PDF/Excel) into clean, mapped CSV exports for ERP system import.
2. **Current Workflow:**
   - User uploads PDF/Excel files.
   - App detects "Estimator Profile".
   - App extracts text and parses line items.
   - **Catalog Mapping:** App matches items to a Product Catalog (3,000+ items).
3. **Parsing & Mapping Rules:** Uses Regex logic in \`services/parser.ts\` for extraction.

---

### REQUIRED OUTPUT STRUCTURE
1. Feature Inventory
2. UX and Workflow Review
3. Parsing & Mapping Pipeline Review
4. Failure Mode Map
5. Improvement Backlog
6. Testing Plan

### APPLICATION CODEBASE FOR REVIEW
${escapedFiles}
`.trim();
};