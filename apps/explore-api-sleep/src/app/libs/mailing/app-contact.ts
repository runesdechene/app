import { Recipient } from './recipient.js';

export class AppContact extends Recipient {
  constructor() {
    super('Guilde des Voyageurs', 'noreply@guildedesvoyageurs.fr');
  }
}
