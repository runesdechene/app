import mjml from 'mjml';
import { IEmailRenderer } from './renderer.js';

export abstract class MJMLRenderer<Props> implements IEmailRenderer<Props> {
  abstract template(props: Props): string;

  async render(props: Props): Promise<string> {
    const { html } = mjml(this.template(props));
    return html;
  }

  protected head() {
    return /* xml */ `
      <mj-head>
        <mj-font name="Archivo" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&display=swap" />
      </mj-head>
    `;
  }

  protected intro(props: { subject: string }) {
    return /* xml */ `
      <mj-image width="40px" src="https://guildedesvoyageurs.fr/wp-content/uploads/2023/10/Logo-Rune.png" align="left" />
      <mj-text font-size="16px" color="#1a1a1a" font-family="Archivo, Arial" font-weight="bold">
        ${props.subject}
      </mj-text>
    `;
  }

  protected text(props: { children: string }) {
    return /* xml */ `
      <mj-text font-size="14px" color="#535353" font-family="Archivo">
        ${props.children}
      </mj-text>
    `;
  }

  protected footNote(props: { children: string }) {
    return /* xml */ `
      <mj-text font-size="12px" color="#909090" font-family="Archivo">
        ${props.children}
      </mj-text>
    `;
  }
}
