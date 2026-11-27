const fs = require('fs');

class PDFBuilder {
  constructor() {
    this.pages = [];
    this.currentPage = null;
    this.width = 595.28;  // A4 points
    this.height = 841.89; // A4 points
    this.marginLeft = 45;
    this.marginRight = 45;
    this.marginTop = 45;
    this.marginBottom = 50;
    this.contentWidth = this.width - this.marginLeft - this.marginRight;
    this.y = this.height - this.marginTop;
    this.newPage();
  }

  newPage() {
    this.currentPage = { ops: [] };
    this.pages.push(this.currentPage);
    this.y = this.height - this.marginTop - 15;
  }

  checkSpace(needed) {
    if (this.y - needed < this.marginBottom) {
      this.newPage();
    }
  }

  escape(str) {
    return String(str || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/\r/g, '')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' '); // Keep printable Latin-1
  }

  setColor(r, g, b, isStroke = false) {
    const rf = (r / 255).toFixed(3);
    const gf = (g / 255).toFixed(3);
    const bf = (b / 255).toFixed(3);
    if (isStroke) {
      this.currentPage.ops.push(`${rf} ${gf} ${bf} RG`);
    } else {
      this.currentPage.ops.push(`${rf} ${gf} ${bf} rg`);
    }
  }

  rect(x, y, w, h, fill = true, stroke = false, lineWidth = 1) {
    if (stroke) {
      this.currentPage.ops.push(`${lineWidth} w`);
    }
    const op = (fill && stroke) ? 'B' : (fill ? 'f' : 'S');
    this.currentPage.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`);
  }

  line(x1, y1, x2, y2, lineWidth = 1) {
    this.currentPage.ops.push(`${lineWidth} w`);
    this.currentPage.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  addText(str, x, y, font = 'F1', size = 10) {
    const escaped = this.escape(str);
    this.currentPage.ops.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escaped}) Tj ET`);
  }

  addBanner(title, subtitle, meta = []) {
    this.checkSpace(80);
    // Top banner
    this.setColor(40, 42, 38); // Deep charcoal #282A26
    this.rect(this.marginLeft, this.y - 70, this.contentWidth, 75, true, false);
    
    // Accent gold line on top
    this.setColor(184, 155, 112); // Gold #B89B70
    this.rect(this.marginLeft, this.y + 5, this.contentWidth, 4, true, false);

    // Title
    this.setColor(244, 239, 230); // Warm cream
    this.addText(title, this.marginLeft + 12, this.y - 14, 'F2', 13.5);

    // Subtitle
    this.setColor(214, 200, 174); // Soft beige
    this.addText(subtitle, this.marginLeft + 12, this.y - 28, 'F1', 8.5);

    // Thin separator line
    this.setColor(184, 155, 112, true);
    this.line(this.marginLeft + 12, this.y - 36, this.marginLeft + this.contentWidth - 12, this.y - 36, 0.5);

    // Meta grid
    let col1X = this.marginLeft + 12;
    let col2X = this.marginLeft + this.contentWidth / 2 + 10;
    let curY = this.y - 48;

    for (let i = 0; i < meta.length; i += 2) {
      const p1 = meta[i];
      if (p1) {
        const k = Array.isArray(p1) ? p1[0] : (p1.label || '');
        const v = Array.isArray(p1) ? p1[1] : (p1.val || '');
        this.setColor(184, 155, 112);
        this.addText(`${k}: `, col1X, curY, 'F2', 7.5);
        this.setColor(244, 239, 230);
        this.addText(v, col1X + k.length * 4.5 + 10, curY, 'F1', 7.5);
      }
      const p2 = meta[i + 1];
      if (p2) {
        const k = Array.isArray(p2) ? p2[0] : (p2.label || '');
        const v = Array.isArray(p2) ? p2[1] : (p2.val || '');
        this.setColor(184, 155, 112);
        this.addText(`${k}: `, col2X, curY, 'F2', 7.5);
        this.setColor(244, 239, 230);
        this.addText(v, col2X + k.length * 4.5 + 10, curY, 'F1', 7.5);
      }
      curY -= 12;
    }

    this.y -= 82;
  }

  addDocHeader(title, subtitle, meta = []) {
    return this.addBanner(title, subtitle, meta);
  }

  addHeading1(text) {
    this.checkSpace(36);
    this.y -= 8;
    this.setColor(184, 155, 112); // Zen Luxe Gold banner
    this.rect(this.marginLeft, this.y - 4, this.contentWidth, 22, true, false);
    this.setColor(30, 33, 30); // Soft black text
    this.addText(text.toUpperCase(), this.marginLeft + 8, this.y + 3, 'F2', 11);
    this.y -= 24;
  }

  addHeading2(text) {
    this.checkSpace(28);
    this.y -= 6;
    this.setColor(184, 155, 112); // Gold text
    this.addText(text, this.marginLeft, this.y, 'F2', 11);
    this.setColor(184, 155, 112, true);
    this.line(this.marginLeft, this.y - 3, this.marginLeft + this.contentWidth, this.y - 3, 0.75);
    this.y -= 14;
  }

  addHeading3(text) {
    this.checkSpace(20);
    this.setColor(50, 52, 48);
    this.addText(text, this.marginLeft, this.y, 'F2', 9.5);
    this.y -= 13;
  }

  addParagraph(text, font = 'F1', size = 9, lineHeight = 12.5, color = [40, 42, 38]) {
    this.setColor(color[0], color[1], color[2]);
    const maxChars = Math.floor(this.contentWidth / (size * 0.52));
    const words = text.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > maxChars) {
        this.checkSpace(lineHeight);
        this.addText(currentLine, this.marginLeft, this.y, font, size);
        this.y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      this.checkSpace(lineHeight);
      this.addText(currentLine, this.marginLeft, this.y, font, size);
      this.y -= lineHeight;
    }
    this.y -= 3;
  }

  addBullet(title, text, font = 'F1', size = 8.5, lineHeight = 12) {
    if (text === undefined) {
      text = title;
      title = '';
    }
    this.checkSpace(lineHeight * 2);
    this.setColor(184, 155, 112); // Gold bullet
    this.addText('\x95', this.marginLeft + 4, this.y, 'F2', 10);
    
    let xOffset = this.marginLeft + 14;
    if (title) {
      this.setColor(40, 42, 38);
      this.addText(title + ' ', xOffset, this.y, 'F2', size);
      xOffset += (title.length * size * 0.52) + 4;
    }

    this.setColor(55, 58, 54);
    const maxChars = Math.floor((this.contentWidth - (xOffset - this.marginLeft)) / (size * 0.52));
    const words = text.split(' ');
    let currentLine = '';
    let isFirst = true;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const targetChars = isFirst ? maxChars : Math.floor((this.contentWidth - 14) / (size * 0.52));
      if (testLine.length > targetChars) {
        this.checkSpace(lineHeight);
        this.addText(currentLine, isFirst ? xOffset : this.marginLeft + 14, this.y, font, size);
        this.y -= lineHeight;
        currentLine = word;
        isFirst = false;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      this.checkSpace(lineHeight);
      this.addText(currentLine, isFirst ? xOffset : this.marginLeft + 14, this.y, font, size);
      this.y -= lineHeight;
    }
    this.y -= 2;
  }

  addCodeBlock(lines) {
    const boxHeight = lines.length * 11 + 10;
    this.checkSpace(boxHeight + 4);
    
    // Background
    this.setColor(30, 33, 30); // Soft black
    this.rect(this.marginLeft, this.y - boxHeight + 8, this.contentWidth, boxHeight, true, false);

    // Left gold border
    this.setColor(184, 155, 112);
    this.rect(this.marginLeft, this.y - boxHeight + 8, 3, boxHeight, true, false);

    let curY = this.y - 3;
    this.setColor(214, 200, 174); // Soft beige monospace font F4 (Courier)
    for (const line of lines) {
      this.addText(line, this.marginLeft + 10, curY, 'F4', 7.5);
      curY -= 11;
    }
    this.y -= boxHeight + 4;
  }

  addCallout(title, lines, type = 'info') {
    const totalLines = lines.length + 1;
    const boxHeight = totalLines * 12 + 10;
    this.checkSpace(boxHeight + 4);

    if (type === 'error') {
      this.setColor(254, 242, 242);
      this.setColor(239, 68, 68, true);
    } else if (type === 'success') {
      this.setColor(240, 253, 244);
      this.setColor(34, 197, 94, true);
    } else {
      this.setColor(248, 246, 240);
      this.setColor(184, 155, 112, true);
    }
    this.rect(this.marginLeft, this.y - boxHeight + 8, this.contentWidth, boxHeight, true, true, 0.75);

    let curY = this.y - 2;
    this.setColor(40, 42, 38);
    this.addText(title, this.marginLeft + 10, curY, 'F2', 8.5);
    curY -= 12;

    this.setColor(60, 62, 58);
    for (const l of lines) {
      this.addText(l, this.marginLeft + 10, curY, 'F1', 7.8);
      curY -= 11.5;
    }
    this.y -= boxHeight + 4;
  }

  addTable(headers, rows, colWidths) {
    const rowHeight = 16;
    const totalWidth = colWidths.reduce((a, b) => a + b, 0);

    // Header row
    this.checkSpace(rowHeight + 6);
    this.setColor(40, 42, 38); // Deep charcoal
    this.rect(this.marginLeft, this.y - 11, totalWidth, rowHeight, true, false);
    
    this.setColor(244, 239, 230); // Cream text
    let curX = this.marginLeft;
    for (let c = 0; c < headers.length; c++) {
      this.addText(headers[c], curX + 5, this.y - 7, 'F2', 8);
      curX += colWidths[c];
    }
    this.y -= rowHeight;

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      this.checkSpace(rowHeight);
      const isAlt = (r % 2 === 1);
      if (isAlt) {
        this.setColor(248, 246, 240);
        this.rect(this.marginLeft, this.y - 11, totalWidth, rowHeight, true, false);
      }
      
      this.setColor(214, 200, 174, true);
      this.line(this.marginLeft, this.y - 11, this.marginLeft + totalWidth, this.y - 11, 0.5);

      curX = this.marginLeft;
      for (let c = 0; c < rows[r].length; c++) {
        const cellText = String(rows[r][c]);
        const isStatus = (cellText === 'PASS' || cellText === 'PASSED' || cellText === 'Completed' || cellText === '100%');
        if (isStatus) {
          this.setColor(34, 139, 34); // Forest green
        } else if (cellText === 'FAIL' || cellText === 'Pending') {
          this.setColor(180, 50, 50);
        } else {
          this.setColor(40, 42, 38);
        }
        this.addText(cellText, curX + 5, this.y - 7, isStatus ? 'F2' : 'F1', 7.5);
        curX += colWidths[c];
      }
      this.y -= rowHeight;
    }
    this.y -= 6;
  }

  build(documentTitle) {
    const totalPages = this.pages.length;
    this.pages.forEach((p, idx) => {
      // Header line
      p.ops.push('0.722 0.608 0.439 RG 0.75 w'); // Gold line
      p.ops.push(`45 ${this.height - 35} m ${this.width - 45} ${this.height - 35} l S`);
      p.ops.push('0.4 0.4 0.4 rg');
      p.ops.push(`BT /F1 7.5 Tf 45 ${this.height - 30} Td (${this.escape(documentTitle)}) Tj ET`);
      p.ops.push(`BT /F1 7.5 Tf ${this.width - 165} ${this.height - 30} Td (MemberPass Internship Pack) Tj ET`);

      // Footer line
      p.ops.push('0.722 0.608 0.439 RG 0.5 w');
      p.ops.push(`45 38 m ${this.width - 45} 38 l S`);
      p.ops.push('0.45 0.45 0.45 rg');
      p.ops.push(`BT /F1 7.5 Tf 45 26 Td (Confidential & Evaluated - MemberPass | Eswaraprasadh A) Tj ET`);
      p.ops.push(`BT /F2 8 Tf ${this.width - 105} 26 Td (Page ${idx + 1} of ${totalPages}) Tj ET`);
    });

    const fontRegular = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    const fontBold = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    const fontItalic = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
    const fontMono = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';

    const pageObjRefs = [];
    const pageAndContentObjs = [];
    let currentObjId = 7;

    for (let i = 0; i < this.pages.length; i++) {
      const pageId = currentObjId++;
      const contentId = currentObjId++;
      pageObjRefs.push(`${pageId} 0 R`);

      const streamContent = this.pages[i].ops.join('\n');
      const streamLen = Buffer.byteLength(streamContent, 'latin1');
      const contentObj = `<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream`;
      const pageObj = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ${contentId} 0 R >>`;

      pageAndContentObjs.push({ id: pageId, str: pageObj });
      pageAndContentObjs.push({ id: contentId, str: contentObj });
    }

    const catalogObj = '<< /Type /Catalog /Pages 2 0 R >>';
    const pagesObj = `<< /Type /Pages /Kids [${pageObjRefs.join(' ')}] /Count ${this.pages.length} >>`;

    const all = [
      { id: 1, str: catalogObj },
      { id: 2, str: pagesObj },
      { id: 3, str: fontRegular },
      { id: 4, str: fontBold },
      { id: 5, str: fontItalic },
      { id: 6, str: fontMono },
      ...pageAndContentObjs
    ];

    all.sort((a, b) => a.id - b.id);

    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [];
    all.forEach(item => {
      offsets[item.id] = Buffer.byteLength(out, 'latin1');
      out += `${item.id} 0 obj\n${item.str}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${all.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= all.length; i++) {
      out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    out += `trailer\n<< /Size ${all.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  }
}

module.exports = PDFBuilder;
