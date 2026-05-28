import type {
  ManufacturerId,
  ProductionExportColumn,
  ProductionExportValidation,
  ProductionExportValidationIssue,
  ProductionRow,
} from "@/src/types/production";

type ActiveManufacturer = Exclude<ManufacturerId, "needs_review">;
type OpinionExportSection = "FLAGS" | "BANNERS";

const standardProductionExportColumns: ProductionExportColumn[] = [
  { key: "material", label: "MATERIAL", getValue: (row) => row.material },
  { key: "finishing", label: "CONFEKTION", getValue: (row) => row.finishing },
  { key: "printFile", label: "PRINT FILE", getValue: (row) => row.printFile.fileName || "missing" },
  { key: "size", label: "SIZE", getValue: (row) => row.size },
  { key: "quantity", label: "QUANTITY", getValue: (row) => row.quantity },
  { key: "orderId", label: "BESTELLNUMMER", getValue: (row) => row.orderId },
  { key: "customer", label: "NAME", getValue: (row) => row.customer },
];

export const productionExportSchemas: Record<ActiveManufacturer, ProductionExportColumn[]> = {
  opinion: standardProductionExportColumns,
  logo_pl: standardProductionExportColumns,
  mph_maciej: standardProductionExportColumns,
  wmd: standardProductionExportColumns,
};

function compareText(a: string, b: string) {
  return a.localeCompare(b, "de", { sensitivity: "base", numeric: true });
}

export function sortProductionRowsForExport(manufacturer: ActiveManufacturer, rows: ProductionRow[]) {
  return [...rows].sort((a, b) => {
    if (manufacturer === "opinion") {
      return (
        compareText(a.productName, b.productName) ||
        compareText(a.material, b.material) ||
        compareText(a.size, b.size) ||
        compareText(a.orderId, b.orderId)
      );
    }

    if (manufacturer === "logo_pl") {
      return compareText(a.material, b.material) || compareText(a.deadline, b.deadline) || compareText(a.orderId, b.orderId);
    }

    return compareText(a.deadline, b.deadline) || compareText(a.orderId, b.orderId);
  });
}

function getOpinionExportSection(row: ProductionRow): OpinionExportSection {
  const haystack = `${row.productName} ${row.material} ${row.sku}`.toLowerCase();
  return haystack.includes("banner") ? "BANNERS" : "FLAGS";
}

export function validateProductionRowsForExport(
  rows: ProductionRow[],
  options: { allowReceivedFiles: boolean }
): ProductionExportValidation {
  const issues: ProductionExportValidationIssue[] = [];

  for (const row of rows) {
    if (!row.printFile.fileName.trim()) {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Missing print file name",
      });
    }

    if (row.printFile.status === "missing") {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Print file is missing",
      });
    }

    if (row.printFile.status === "problem") {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Print file has a problem",
      });
    }

    if (row.printFile.status === "received" && !options.allowReceivedFiles) {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Print file is received but not approved",
      });
    }

    const isDoubleSided = row.finishing.toLowerCase().includes("beidseitig");
    const backPrintFile = row.printFiles?.find((file) => file.side === "back");

    if (isDoubleSided && !backPrintFile?.fileName.trim()) {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Back-side print file is missing",
      });
    }

    if (isDoubleSided && backPrintFile?.status === "problem") {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Back-side print file has a problem",
      });
    }

    if (isDoubleSided && backPrintFile?.status === "received" && !options.allowReceivedFiles) {
      issues.push({
        rowId: row.id,
        severity: "blocker",
        reason: "Back-side print file is received but not approved",
      });
    }
  }

  const blockedRowIds = new Set(issues.filter((issue) => issue.severity === "blocker").map((issue) => issue.rowId));

  return {
    readyRows: rows.length - blockedRowIds.size,
    blockedRows: blockedRowIds.size,
    issues,
  };
}

function escapeXml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number) {
  let name = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function headerCells(columns: ProductionExportColumn[], rowNumber: number) {
  return columns
    .map((column, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowNumber}`;
      return `<c r="${ref}" s="1" t="inlineStr"><is><t>${escapeXml(column.label)}</t></is></c>`;
    })
    .join("");
}

function dataCells(row: ProductionRow, columns: ProductionExportColumn[], rowNumber: number, rowIndex: number) {
  return columns
    .map((column, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowNumber}`;
      const value = column.getValue(row, rowIndex);

      if (typeof value === "number") {
        return `<c r="${ref}" s="2"><v>${value}</v></c>`;
      }

      return `<c r="${ref}" s="2" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    })
    .join("");
}

function sectionTitleRow(title: OpinionExportSection, rowNumber: number, columns: ProductionExportColumn[]) {
  const emptyCells = columns
    .slice(1)
    .map((_column, columnIndex) => `<c r="${columnName(columnIndex + 1)}${rowNumber}" s="3"/>`)
    .join("");

  return `<row r="${rowNumber}" ht="24" customHeight="1"><c r="A${rowNumber}" s="3" t="inlineStr"><is><t>${title}</t></is></c>${emptyCells}</row>`;
}

function getSheetRows(rows: ProductionRow[], columns: ProductionExportColumn[], manufacturer: ActiveManufacturer) {
  let rowNumber = 1;
  let dataRowIndex = 0;
  const sheetRows: string[] = [];
  const mergeRefs: string[] = [];

  if (manufacturer !== "opinion") {
    sheetRows.push(`<row r="${rowNumber}">${headerCells(columns, rowNumber)}</row>`);

    for (const row of rows) {
      rowNumber += 1;
      sheetRows.push(`<row r="${rowNumber}">${dataCells(row, columns, rowNumber, dataRowIndex)}</row>`);
      dataRowIndex += 1;
    }

    return { sheetRows, mergeRefs, rowCount: rowNumber };
  }

  for (const section of ["FLAGS", "BANNERS"] as const) {
    const sectionRows = rows.filter((row) => getOpinionExportSection(row) === section);
    const sectionTitleRef = `A${rowNumber}:${columnName(columns.length - 1)}${rowNumber}`;

    sheetRows.push(sectionTitleRow(section, rowNumber, columns));
    mergeRefs.push(sectionTitleRef);
    rowNumber += 1;
    sheetRows.push(`<row r="${rowNumber}">${headerCells(columns, rowNumber)}</row>`);

    for (const row of sectionRows) {
      rowNumber += 1;
      sheetRows.push(`<row r="${rowNumber}">${dataCells(row, columns, rowNumber, dataRowIndex)}</row>`);
      dataRowIndex += 1;
    }

    rowNumber += 1;
  }

  return { sheetRows, mergeRefs, rowCount: rowNumber - 1 };
}

function sheetXml(rows: ProductionRow[], columns: ProductionExportColumn[], sheetTitle: string, manufacturer: ActiveManufacturer) {
  const { sheetRows, mergeRefs, rowCount } = getSheetRows(rows, columns, manufacturer);

  const colDefs = columns.map((_column, index) => `<col min="${index + 1}" max="${index + 1}" width="22" customWidth="1"/>`).join("");
  const mergeCells = mergeRefs.length
    ? `<mergeCells count="${mergeRefs.length}">${mergeRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${columnName(columns.length - 1)}${rowCount}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colDefs}</cols>
  <sheetData>
    ${sheetRows.join("\n    ")}
  </sheetData>
  ${mergeCells}
  <pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
  <headerFooter><oddHeader>&amp;C${escapeXml(sheetTitle)}</oddHeader></headerFooter>
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const crcTable = Array.from({ length: 256 }, (_item, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function createZip(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const encodedFiles = files.map((file) => ({
    ...file,
    nameBytes: encoder.encode(file.path),
    contentBytes: encoder.encode(file.content),
  }));

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of encodedFiles) {
    const checksum = crc32(file.contentBytes);
    const localHeader = new Uint8Array(30 + file.nameBytes.length);

    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, checksum);
    writeUint32(localHeader, 18, file.contentBytes.length);
    writeUint32(localHeader, 22, file.contentBytes.length);
    writeUint16(localHeader, 26, file.nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(file.nameBytes, 30);

    const centralHeader = new Uint8Array(46 + file.nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, checksum);
    writeUint32(centralHeader, 20, file.contentBytes.length);
    writeUint32(centralHeader, 24, file.contentBytes.length);
    writeUint16(centralHeader, 28, file.nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(file.nameBytes, 46);

    localParts.push(localHeader, file.contentBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + file.contentBytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 4, 0);
  writeUint16(endRecord, 6, 0);
  writeUint16(endRecord, 8, encodedFiles.length);
  writeUint16(endRecord, 10, encodedFiles.length);
  writeUint32(endRecord, 12, centralSize);
  writeUint32(endRecord, 16, centralOffset);
  writeUint16(endRecord, 20, 0);

  const zipParts = [...localParts, ...centralParts, endRecord];
  const zipSize = zipParts.reduce((sum, part) => sum + part.byteLength, 0);
  const zipBytes = new Uint8Array(zipSize);
  let cursor = 0;

  for (const part of zipParts) {
    zipBytes.set(part, cursor);
    cursor += part.byteLength;
  }

  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);

  return new Blob([zipBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function createProductionXlsxBlob(manufacturer: ActiveManufacturer, rows: ProductionRow[]) {
  const columns = productionExportSchemas[manufacturer];
  const sortedRows = sortProductionRowsForExport(manufacturer, rows);
  const sheetTitle = `Weltflagge ${manufacturer}`;
  const files = [
    {
      path: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    },
    {
      path: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      path: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Batch" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    {
      path: "xl/styles.xml",
      content: stylesXml(),
    },
    {
      path: "xl/worksheets/sheet1.xml",
      content: sheetXml(sortedRows, columns, sheetTitle, manufacturer),
    },
  ];

  return createZip(files);
}

export function downloadProductionXlsx(manufacturer: ActiveManufacturer, rows: ProductionRow[], date: string) {
  const blob = createProductionXlsxBlob(manufacturer, rows);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `weltflagge_${manufacturer}_${date}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
