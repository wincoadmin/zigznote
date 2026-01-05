/**
 * Base email template with common styles
 */

export const styles = {
  container: `
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1f2937;
    line-height: 1.6;
  `.replace(/\s+/g, ' ').trim(),

  heading: `
    color: #111827;
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 16px;
  `.replace(/\s+/g, ' ').trim(),

  button: `
    background: #6366f1;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    text-decoration: none;
    display: inline-block;
    font-weight: 500;
  `.replace(/\s+/g, ' ').trim(),

  buttonSecondary: `
    background: #f3f4f6;
    color: #374151;
    padding: 12px 24px;
    border-radius: 6px;
    text-decoration: none;
    display: inline-block;
    font-weight: 500;
  `.replace(/\s+/g, ' ').trim(),

  card: `
    background: #f8fafc;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  `.replace(/\s+/g, ' ').trim(),

  actionItem: `
    background: #f8fafc;
    border-left: 4px solid #6366f1;
    padding: 16px;
    margin: 16px 0;
    border-radius: 0 8px 8px 0;
  `.replace(/\s+/g, ' ').trim(),

  alert: `
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
  `.replace(/\s+/g, ' ').trim(),

  alertWarning: `
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
  `.replace(/\s+/g, ' ').trim(),

  message: `
    background: #eff6ff;
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
    font-style: italic;
  `.replace(/\s+/g, ' ').trim(),

  footer: `
    color: #64748b;
    font-size: 12px;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
  `.replace(/\s+/g, ' ').trim(),

  footerLink: `
    color: #6366f1;
    text-decoration: none;
  `.replace(/\s+/g, ' ').trim(),

  mutedText: `
    color: #64748b;
    font-size: 14px;
  `.replace(/\s+/g, ' ').trim(),

  logo: `
    font-size: 20px;
    font-weight: 700;
    color: #6366f1;
    text-decoration: none;
  `.replace(/\s+/g, ' ').trim(),
};

export function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>zigznote</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f9fafb;">
    <div style="${styles.container}">
      <div style="margin-bottom: 24px;">
        <a href="https://zigznote.com" style="${styles.logo}">zigznote</a>
      </div>
      ${content}
    </div>
  </body>
</html>
  `.trim();
}

export function escapeHtml(text: string | undefined | null): string {
  if (text == null) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
