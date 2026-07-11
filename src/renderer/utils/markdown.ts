export function markdownToHtml(md: string): string {
  let html = md;

  html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  html = html.replace(/^---+\s*$/gm, '<hr>');

  html = html.replace(/^\|(.+)\|$/gm, (line) => {
    const cells = line.slice(1, -1).split('|').map(c => c.trim());
    const isHeader = /^[-: ]+$/.test(cells[0]);
    if (isHeader) return '';
    const tag = 'td';
    return `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
  });

  const lines = html.split('\n');
  const result: string[] = [];
  let inParagraph = false;
  let inList = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

    if (!line) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      if (inList && !nextLine.startsWith('<li>') && !nextLine.startsWith('<tr>')) {
        result.push('</ul>'); inList = false;
      }
      continue;
    }

    if (line.startsWith('<h') || line.startsWith('<pre') || line.startsWith('<hr') || line.startsWith('<tr')) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(line);
      if (line.startsWith('<tr')) inTable = true;
      if (line.startsWith('</table>')) inTable = false;
      continue;
    }

    if (line.startsWith('<li>')) {
      if (inParagraph) { result.push('</p>'); inParagraph = false; }
      if (!inList) { result.push('<ul>'); inList = true; }
      result.push(line);
      continue;
    }

    if (!inParagraph && !inList && !inTable) {
      result.push('<p>');
      inParagraph = true;
    }

    if (inParagraph) {
      result.push(line);
      if (!nextLine || nextLine.startsWith('<h') || nextLine.startsWith('<pre') || nextLine.startsWith('<hr') || nextLine.startsWith('<li>') || nextLine.startsWith('<tr>')) {
        result.push('</p>');
        inParagraph = false;
      }
    }
  }

  if (inParagraph) result.push('</p>');
  if (inList) result.push('</ul>');

  return result.join('\n');
}
