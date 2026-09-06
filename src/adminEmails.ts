// Fonte unica dos administradores do sistema.
// Quem estiver nesta lista ve o menu USUARIOS e aprova/pausa/nega cadastros.
// Para adicionar ou remover um admin, edite APENAS este arquivo.
export const ADMIN_EMAILS = [
  'credplusemp@gmail.com',
  'lellisflavio@gmail.com',
];

export const isAdminEmail = (email?: string | null): boolean =>
  !!email && ADMIN_EMAILS.includes(email.trim().toLowerCase());
