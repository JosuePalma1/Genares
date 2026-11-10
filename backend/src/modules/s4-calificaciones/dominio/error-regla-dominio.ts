export class ErrorReglaDominio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorReglaDominio';
  }
}
