import { ParseProfile, TextLine } from '../types';
import { safeRegex } from '../utils/regex';

// Common Regexes reused across profiles
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:Ph|Mob|Fax|Tel|ACN|ABN)[:.]?[\s\d()\-+]{8,}/i;
const COMMON_HEADER_KEYWORDS = /^(Client|Address|Job No|Item:|Date:|Page|Builder|Site:|File Ref|Printed on|Member|Notes|Size|Grade|Wide|Thick|Description|QT|Total)/i;

// --- Profile 1: Ezequote (Bone Timber) ---
export const EzequoteProfile: ParseProfile = {
    id: 'ezequote',
    name: 'Ezequote (Bone Timber)',
    description: 'Optimized for Ezequote/Bone Timber formats. Handles "#" Section headers, "qty/length" lists, and footer noise.',
    keywords: ['Ezequote', 'Bone Timber', 'ESTIMATED TIMBER QUANTITY LIST', 'GROUND FRAME', 'UPPER FRAME', 'TEMPORARY BRACE', 'CAVITY SLIDERS'],
    detect: (textLines: TextLine[]) => {
        let score = 0;
        const text = textLines.slice(0, 50).map(t => t.text).join('\n');
        
        // High confidence markers from the provided PDF
        if (/Ezequote/i.test(text)) score += 50;
        if (/Bone Timber/i.test(text)) score += 40;
        if (/ESTIMATED TIMBER QUANTITY LIST/i.test(text)) score += 30;
        if (/GROUND FRAME|UPPER FRAME/.test(text)) score += 20;

        return Math.min(score, 100);
    },
    settings: {
        sectionHeaderPatterns: [
            /^#\s+.*$/i, // Explicit support for "# GROUND FRAME" etc.
            /^(?:GROUND|UPPER|LOWER|ROOF|FLOOR)\s+(?:FRAME|TRUSSES|UPPER|FLOORING|JOISTS)$/i,
            /^EAVES\s+&\s+SOFFIT.*$/i,
            /^EXTERNAL\s+CLADDING.*$/i,
            /^TIE\s+DOWNS.*$/i,
            /^Rafter\s+-\s+CAD$/i,
            /^FLOOR\s+\+\s+FLOORING$/i,
            /^TEMPORARY\s+BRACE$/i,
            /^CAVITY\s+SLIDERS$/i
        ],
        ignorePatterns: [
            EMAIL_REGEX,
            PHONE_REGEX,
            /^Page\s+\d+\s+Quantities.*/i, // Specific footer: "Page 1 Quantities - ... .xlsm"
            /^Page\s+\d+/i,
            /^Date:/i,
            /^Address:/i,
            /^ESTIMATOR:/i,
            /^Bone Timber/i,
            /^Q:/i, // Quote reference
            /^ERRORS & OMISSIONS/i,
            /^CONSTRUCTION DETAILS/i,
            /\.xlsm$/i, // Excel filename in footer
            /Total/i // Explicitly ignore lines containing "Total" (e.g. 3 Lm Total)
        ],
        unitRules: [
            { sectionNamePattern: /Cladding|Flooring|Decking|Eaves|Soffit/i, defaultUnit: 'm2' },
            { sectionNamePattern: /Hardware|Fixings|Brackets|Tie Downs|Wall Frames|Sliders|Brace/i, defaultUnit: 'EA' }
        ]
    }
};

// --- Profile 2: Generic CAD Takeoff ---
export const GenericCADProfile: ParseProfile = {
    id: 'generic-cad',
    name: 'Generic CAD Takeoff',
    description: 'Standard format with uppercase section headers (e.g., WALL FRAME) and structured columns.',
    keywords: ['Mitek', 'Multinail', 'Pryda', 'Hyne', 'Takeoff', 'Estimate', 'Quote'],
    detect: (textLines: TextLine[]) => {
        let score = 0;
        const text = textLines.slice(0, 50).map(t => t.text).join('\n');
        
        if (/Mitek|Multinail|Pryda|Hyne/i.test(text)) score += 30;
        if (/Takeoff|Estimate|Quote/i.test(text)) score += 20;
        
        const upperHeaders = textLines.filter(l => /^[A-Z\s-]{4,}$/.test(l.text.trim()) && l.text.length < 50);
        if (upperHeaders.length > 2) score += 40;

        return Math.min(score, 100);
    },
    settings: {
        sectionHeaderPatterns: [
            // Updated Regex: Negative lookahead for product names that are often uppercase but are Items, not Sections.
            // Excludes: HARDIFLEX, VILLABOARD, JH \d
            /^(?=(?:.*[A-Z]){3,})(?!.*(?:Top|Bottom|Studs|Nogging|Lintels|Beams|Joists|Plates|Rafters|Purlins|Battens|Fascia|Posts|Hardiflex|Villaboard|JH\s+\d))[A-Z\s\d\-&.,():]+$/
        ],
        ignorePatterns: [
            EMAIL_REGEX,
            PHONE_REGEX,
            COMMON_HEADER_KEYWORDS,
            /^(?:Total|Subtotal|Summary)\s+/i,
            /crestimating@/i
        ],
        unitRules: []
    }
};

// --- Profile 3: Typed Manual Takeoff ---
export const TypedManualProfile: ParseProfile = {
    id: 'typed-manual',
    name: 'Typed Manual Takeoff',
    description: 'Simpler lists, often typed manually. Supports mixed-case headers and inferred units.',
    keywords: ['Manual', 'List', 'Timber'],
    detect: (textLines: TextLine[]) => {
        let score = 0;
        const text = textLines.slice(0, 50).map(t => t.text).join('\n');

        if (!/Mitek|Multinail|Pryda/.test(text)) score += 20;
        
        const mixedHeaders = textLines.filter(l => /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*$/.test(l.text.trim()));
        if (mixedHeaders.length > 3) score += 40;

        return Math.min(score, 100);
    },
    settings: {
        sectionHeaderPatterns: [
            /^[A-Z][a-zA-Z\s\d-&]+$/,
            /^[A-Z\s\d-]+$/
        ],
        ignorePatterns: [
            /Page\s+\d+/i,
            /^Date:/i
        ],
        unitRules: [
            { sectionNamePattern: /Cladding|Flooring|Decking/i, defaultUnit: 'm2' },
            { sectionNamePattern: /Hardware|Fixings|Brackets/i, defaultUnit: 'EA' }
        ]
    }
};

// --- Profile 4: C&R Estimating ---
export const CREstimatingProfile: ParseProfile = {
    id: 'cr-estimating',
    name: 'C&R Estimating',
    description: 'Optimized for C&R Estimating formats. Handles horizontal grids with alternating QT and L/M columns.',
    keywords: ['C&R Estimating', 'QT', 'L/M', 'Screen framing'],
    detect: (textLines: TextLine[]) => {
        let score = 0;
        const text = textLines.slice(0, 50).map(t => t.text).join('\n');
        
        if (/C&R Estimating/i.test(text)) score += 50;
        if (/QT\s+L\/M\s+QT\s+L\/M/i.test(text)) score += 40;

        return Math.min(score, 100);
    },
    settings: {
        sectionHeaderPatterns: [
            /^[A-Z][a-zA-Z\s\d-&]+$/,
            /^[A-Z\s\d-]+$/
        ],
        ignorePatterns: [
            EMAIL_REGEX,
            PHONE_REGEX,
            /Page\s+\d+/i,
            /^Date:/i,
            /QT\s+L\/M/i
        ],
        unitRules: []
    },
    sectionHandlers: [
        {
            header: /ESTIMATOR\s+NOTES/i,
            process: (lines, startIndex) => {
                const notesArr: string[] = [];
                let consumedLines = 0;
                
                for (let i = startIndex + 1; i < lines.length; i++) {
                    const lineText = lines[i].text.trim();
                    
                    // Stop Conditions
                    if (lineText.startsWith('#')) break;
                    if (/Page\s+\d+/i.test(lineText)) break;
                    if (/^[A-Z][a-zA-Z\s\d\-&]+$/.test(lineText) && lines[i].rect && lines[i].rect[0] < 120) break;
                    
                    // Check for standard timber item (e.g. contains quantity and triple space)
                    if (/\s{3,}/.test(lineText) && /\d/.test(lineText)) break;
                    
                    consumedLines++; // Only increment if we didn't break
                    
                    // Skip empty lines or standard ignores
                    if (!lineText || /^Date:/i.test(lineText)) continue;
                    
                    notesArr.push(lineText);
                }
                
                return {
                    notes: notesArr.join(' ').replace(/\s+/g, ' ').trim(),
                    consumedLines
                };
            }
        }
    ]
};

export const HarroldKiteProfile: ParseProfile = {
    id: 'harrold-kite',
    name: 'HARROLD&KITE',
    description: 'Optimized for HARROLD&KITE format. Handles specific section headers and item formats.',
    keywords: ['HARROLD&KITE', 'Timber Take Off', 'HARROLD & KITE'],
    detect: (textLines: TextLine[]) => {
        let score = 0;
        const text = textLines.slice(0, 50).map(t => t.text).join('\n');
        
        if (/HARROLD\s*&\s*KITE/i.test(text)) score += 50;
        if (/Timber Take Off/i.test(text)) score += 40;

        return Math.min(score, 100);
    },
    settings: {
        sectionHeaderPatterns: [
            /^[A-Z].*Room$/i,
            /^Section \d+/i,
            /^Roofing/i,
            /^First Floor/i,
            /^Ground Floor/i,
            /^Master Ensuite/i,
            /^Kitchen/i,
            /^Loggia/i,
            /^Dwg \d+/i,
            /^WD-\d+-\d+/i,
            /^Lift Framing/i,
            /^Floor Repairs/i,
            /^Timber studwork/i,
            /^Wall types/i,
            /^Picture Rails/i,
            /^Guest House/i,
            /^Existing Hay Loft/i,
            /^Level \d+/i
        ],
        ignorePatterns: [
            EMAIL_REGEX,
            PHONE_REGEX,
            /Typical details sheet/i,
            /Please allow timber sections/i,
            /The client is prepared/i,
            /Thank you/i,
            /End\./i,
            /New Scotia profile/i,
            /Allow for infill timber framing/i,
            /Allow for new tiedowns fixings/i,
            /Photograph and record existing/i,
            /Manufacture new picture rail/i
        ],
        unitRules: [
            { sectionNamePattern: /Flooring|Decking/i, defaultUnit: 'm2' },
            { sectionNamePattern: /Hardware|Fixings|Brackets/i, defaultUnit: 'EA' }
        ],
        lineCleanupRules: [
            { pattern: /\s+[-.]\s+to cut\s+[\d/,\s]+/i, replacement: "" },
            { pattern: /\s+[-.]\s+[\d.]+\/[\d.]+\s*x\s*[\d.]+m/i, replacement: "" },
            { pattern: /\s+[-.]\s+[\d.]+\/[\d.]+/i, replacement: "" },
            { pattern: /(?:^|\s+)(?:fixed\s+)?with\s+[^0-9]*\d+g\s*x\s*\d+mm(?:\s*[-.]\s*[\d.]+\/[\d.]+)?/i, replacement: "" },
            { pattern: /\s+[-.]\s+[\d.]+\/[\d.]+\s*=\s*[\d.]+(?:\s*x[\d.]+)?/i, replacement: "" },
            { pattern: /\s+[-.]\s+[\d.]+\*\d+\s*[\d.]*/i, replacement: "" }
        ]
    }
};

// --- Profile 5: Revit CSV Export ---
export const RevitCSVProfile: ParseProfile = {
    id: 'revit-csv',
    name: 'Revit CSV Export',
    description: 'Handles CSV/Excel exports from Revit with "Number of Items" and "Cut Lengths" columns.',
    keywords: ['Level Name', 'Instance Number', 'Number of Items', 'Material', 'Member Type', 'Cut Lengths'],
    detect: (textLines: TextLine[]) => {
        let score = 0;
        const text = textLines.slice(0, 10).map(t => t.text).join('\n');
        
        if (/Number of Items/i.test(text)) score += 40;
        if (/Cut Lengths/i.test(text)) score += 30;
        if (/Level Name/i.test(text)) score += 30;

        return Math.min(score, 100);
    },
    settings: {
        sectionHeaderPatterns: [
            /^[A-Z\s\d-]+$/
        ],
        ignorePatterns: [
            /^Level Name/i,
            /Instance Number/i,
            /Material/i
        ],
        unitRules: []
    }
};

const DEFAULT_PROFILES = [EzequoteProfile, GenericCADProfile, TypedManualProfile, CREstimatingProfile, HarroldKiteProfile, RevitCSVProfile];
const PROFILE_STORAGE_KEY = 'custom_profiles_v1';

export const profileService = {
    getAll: (): ParseProfile[] => {
        try {
            if (typeof localStorage === 'undefined') return DEFAULT_PROFILES;
            const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
            let storedProfiles: any[] = stored ? JSON.parse(stored) : [];
            
            // Automatically remove any profile named "New Custom Profile" as requested
            const initialLength = storedProfiles.length;
            storedProfiles = storedProfiles.filter(p => p.name !== 'New Custom Profile');
            if (storedProfiles.length !== initialLength) {
                localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(storedProfiles));
            }
            
            // Migration/Initialization: Ensure defaults exist in storage so they are editable
            let changed = false;
            const existingIds = new Set(storedProfiles.map(p => p.id));
            
            DEFAULT_PROFILES.forEach(def => {
                if (!existingIds.has(def.id)) {
                    // Serialize default profile to storage format
                    storedProfiles.push({
                        id: def.id,
                        name: def.name,
                        description: def.description,
                        isCustom: true, // Now everything is treated as custom/editable
                        keywords: def.keywords || [],
                        serializedSettings: {
                            sectionHeaderPatterns: def.settings.sectionHeaderPatterns.map(r => r.source),
                            ignorePatterns: def.settings.ignorePatterns.map(r => r.source),
                            unitRules: def.settings.unitRules.map(u => ({
                                sectionNamePattern: u.sectionNamePattern.source,
                                defaultUnit: u.defaultUnit
                            })),
                            lineCleanupRules: def.settings.lineCleanupRules?.map(r => ({
                                pattern: r.pattern.source,
                                replacement: r.replacement
                            }))
                        }
                    });
                    changed = true;
                }
            });

            if (changed) {
                localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(storedProfiles));
            }

            // Hydrate profiles from storage
            return storedProfiles.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                isCustom: true,
                keywords: p.keywords || [],
                settings: {
                    sectionHeaderPatterns: p.serializedSettings.sectionHeaderPatterns.map((s: string) => safeRegex(s)),
                    ignorePatterns: p.serializedSettings.ignorePatterns.map((s: string) => safeRegex(s, 'i')),
                    unitRules: (p.serializedSettings.unitRules || []).map((u: any) => ({
                        sectionNamePattern: safeRegex(u.sectionNamePattern, 'i'),
                        defaultUnit: u.defaultUnit
                    })),
                    lineCleanupRules: (p.serializedSettings.lineCleanupRules || []).map((r: any) => ({
                        pattern: safeRegex(r.pattern, 'i'),
                        replacement: r.replacement
                    })),
                    columnHints: {}
                },
                serializedSettings: p.serializedSettings,
                detect: (textLines: TextLine[]) => {
                     // Generic detection based on keywords since functions can't be stored
                     if (!p.keywords || p.keywords.length === 0) return 0;
                     const text = textLines.slice(0, 50).map(t => t.text).join('\n').toLowerCase();
                     let hits = 0;
                     for (const kw of p.keywords) {
                         if (text.includes(kw.toLowerCase())) hits++;
                     }
                     return Math.min(hits * 25, 100);
                }
            }));
        } catch (e) {
            console.error("Failed to load profiles", e);
            return DEFAULT_PROFILES;
        }
    },

    save: (profile: ParseProfile) => {
        // Prepare for storage (Strip functions, Regex -> string)
        const storageObj = {
            id: profile.id,
            name: profile.name,
            description: profile.description,
            keywords: profile.keywords,
            serializedSettings: {
                sectionHeaderPatterns: profile.settings.sectionHeaderPatterns.map(r => r.source),
                ignorePatterns: profile.settings.ignorePatterns.map(r => r.source),
                unitRules: profile.settings.unitRules.map(u => ({
                    sectionNamePattern: u.sectionNamePattern.source,
                    defaultUnit: u.defaultUnit
                })),
                lineCleanupRules: profile.settings.lineCleanupRules?.map(r => ({
                    pattern: r.pattern.source,
                    replacement: r.replacement
                }))
            }
        };

        const existingStored = localStorage.getItem(PROFILE_STORAGE_KEY);
        const storedArray = existingStored ? JSON.parse(existingStored) : [];
        
        const index = storedArray.findIndex((p: any) => p.id === profile.id);
        
        if (index >= 0) {
            storedArray[index] = storageObj;
        } else {
            storedArray.push(storageObj);
        }
        
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(storedArray));
    },

    delete: (id: string) => {
        const existingStored = localStorage.getItem(PROFILE_STORAGE_KEY);
        const storedArray = existingStored ? JSON.parse(existingStored) : [];
        const filtered = storedArray.filter((p: any) => p.id !== id);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(filtered));
    }
};

export const PROFILES = profileService.getAll(); // Initial load

export const detectProfile = (textLines: TextLine[]): ParseProfile => {
    // Reload to ensure fresh state
    const allProfiles = profileService.getAll();
    let bestProfile = EzequoteProfile; // Fallback
    let maxScore = -1;

    for (const profile of allProfiles) {
        const score = profile.detect(textLines);
        if (score > maxScore) {
            maxScore = score;
            bestProfile = profile;
        }
    }
    
    return bestProfile;
};