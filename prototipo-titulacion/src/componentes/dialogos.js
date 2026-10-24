import SweetAlert from 'sweetalert2';

export const CONFIGURACION_DIALOGOS = Object.freeze({
  buttonsStyling: false,
  returnFocus: true,
  didOpen: (popup) => {
    popup.querySelector('.swal2-icon')?.setAttribute('aria-hidden', 'true');
  },
  customClass: Object.freeze({
    popup: 'genares-dialog',
    title: 'genares-dialog-title',
    htmlContainer: 'genares-dialog-content',
    actions: 'genares-dialog-actions',
    confirmButton: 'button button-primary genares-dialog-confirm',
    cancelButton: 'button button-outline genares-dialog-cancel',
    denyButton: 'button button-danger genares-dialog-deny',
    input: 'genares-dialog-input',
  }),
});

// El mixin conserva el contrato y el resultado de Swal.fire; solamente centraliza
// la presentación visual y mantiene la restauración de foco de SweetAlert2.
export const DialogoGenares = SweetAlert.mixin(CONFIGURACION_DIALOGOS);
