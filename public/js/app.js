const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#main-nav');

if (menuButton) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(isOpen));
    navigation.classList.toggle('is-open', isOpen);
  });
}

const dismissButton = document.querySelector('.dismiss-flash');

if (dismissButton) {
  dismissButton.addEventListener('click', () => {
    dismissButton.closest('.flash').remove();
  });
}

const dialog = document.querySelector('#delete-dialog');
const deleteMessage = document.querySelector('#delete-message');
let pendingForm = null;

// Wait for the confirmation dialog before submitting a delete form.
for (const form of document.querySelectorAll('form[data-confirm]')) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    pendingForm = form;
    deleteMessage.textContent = form.dataset.confirm;
    dialog.showModal();
  });
}

dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'delete' && pendingForm) {
    pendingForm.submit();
  }

  pendingForm = null;
});
