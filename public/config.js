/* ============================================================
   NEXTLI · Configuración central
   Edita este archivo para cambiar datos de contacto, la firma
   del certificado o la contraseña del panel de inventario.
   ============================================================ */
window.NEXTLI_CONFIG = {
  // WhatsApp de NEXTLI (con lada de país, sin "+")
  WA_NUMBER: '525521889698',

  // Invitación al Grupo NEXTLI (WhatsApp no permite prellenar texto en un enlace de grupo,
  // por eso la app copia el mensaje y abre el grupo para pegarlo).
  GROUP_URL: 'https://chat.whatsapp.com/KBc1dBIEJQHCoBTmrG96mi?s=cl&p=a&mlu=4&ilr=4',

  // Respaldo de imágenes si alguna no carga desde el mismo sitio
  IMAGE_BASE: 'https://nextli-stroks15s-projects.vercel.app/images/',

  // Firma del médico veterinario en el certificado
  DOCTOR: { name: 'Carlos Chávez', title: 'M.V.Z' },

  // ----- Inventario compartido (Supabase) -----
  // La URL y la clave pública (publishable) son seguras de publicar: solo permiten LEER el inventario.
  // Escribir exige la contraseña del panel, que se valida en el servidor.
  SUPABASE_URL: 'https://gzdoqxhvwiivwqmkxcem.supabase.co',
  SUPABASE_KEY: 'sb_publishable_QvTHUHAfwKdQ446LUc97sQ_z2ssLHDQ',

  // ----- Panel de inventario del Modo Trabajador -----
  // Respaldo SIN conexión: hash SHA-256 de la contraseña (no la contraseña en texto plano).
  // Debe corresponder a la misma contraseña que está guardada en Supabase.
  // Para generar otro hash: en la consola del navegador ejecuta  nextliHash('nueva-contraseña')
  ADMIN_PASSWORD_HASH: 'fe106380d6dcaf823a3f47452f85606bacac08114b281e7745441edcec2ee1b0'
};
