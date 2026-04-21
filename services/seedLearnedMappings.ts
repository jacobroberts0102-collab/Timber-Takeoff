export interface SeedMapping {
  takeoffItemName: string; 
  dimensions?: string; 
  itemNo: string;
  description: string;
}

/**
 * MASTER SEED MAPPINGS
 * Add manual mappings here to persist them across codebase resets or cleared browser storage.
 */
export const SEED_LEARNED_MAPPINGS: SeedMapping[] = [
  {
    takeoffItemName: 'ANCHOR MASONRY ANKASCREW: WFH 10X100 GAL AS10100WGM EA',
    itemNo: 'AS10100H',
    description: 'Masonry Screw Bolt 10x100 Hex'
  },
  {
    takeoffItemName: 'MULTI-TENSIONER C/W WINGNUT AND WASHER (TA0424)',
    itemNo: 'SBT',
    description: 'Strap Brace Tensioner T-Nuts & Bolts 10-Pack (Wingnut)'
  },
  {
    takeoffItemName: 'ROLLS STRAP BRACE WITH NO',
    dimensions: '30X1.0X30M',
    itemNo: 'SB1',
    description: 'H/Gauge 1.0mm Perf Strap Brace 30 x 1.0 x 30mm'
  },
  {
    takeoffItemName: 'ROLLS TENSION BRACE ()',
    dimensions: '30X1.0X30M',
    itemNo: 'SB1',
    description: 'H/Gauge 1.0mm Perf Strap Brace 30 x 1.0 x 30mm'
  },
  {
    takeoffItemName: 'WASHER SQUARE HOBSON 50X50X3 WSMSGM10050030 EA',
    dimensions: 'M10',
    itemNo: 'SW50',
    description: 'Square Washers 10mm 50x50x3mm Galv'
  },
  {
    takeoffItemName: 'HITCH (TA010)',
    itemNo: 'PH0',
    description: 'Internal Wall Bracket 120x40x46x1mm'
  },
  {
    takeoffItemName: 'R/Sawn Droppers Length',
    dimensions: '38X38',
    itemNo: 'OAOS038038',
    description: '38x38 Oak Sawn'
  },
  {
    takeoffItemName: 'R/Sawn Trimmer Lengths',
    dimensions: '38X38',
    itemNo: 'OAOS038038',
    description: '38x38 Oak Sawn'
  },
  {
    takeoffItemName: 'Quad Eaves Bead 5.4m',
    dimensions: '18X18',
    itemNo: 'LOSP1818',
    description: '18x18 LOSP H3 Primed Pine 5.4m'
  },
  {
    takeoffItemName: 'F7',
    dimensions: '280X65',
    itemNo: 'PIDRRDM',
    description: 'N/A'
  },
  {
    takeoffItemName: 'Brackets (LVSIA)',
    itemNo: 'BALVSIA',
    description: 'Variable Skew Bracket 75x50x150'
  },
  {
    takeoffItemName: 'Cyclone Ties (CT900mm)',
    itemNo: 'HIS',
    description: 'Cyclone Strap - 600mm'
  }
];