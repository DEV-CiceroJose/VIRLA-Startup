// Tipos de anexo de chat aceitos (imagens + PDF). Fonte única da whitelist,
// usada tanto pelo fileFilter do multer quanto pela derivação de tipo no controller.
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const ATTACHMENT_MIMES = [...IMAGE_MIMES, 'application/pdf']
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 // 5MB

const IMAGE_SET = new Set(IMAGE_MIMES)

/** Classifica o mimetype num tipo de anexo, ou null se fora da whitelist. */
export function attachmentTypeFor(mimetype) {
  if (IMAGE_SET.has(mimetype)) return 'image'
  if (mimetype === 'application/pdf') return 'pdf'
  return null
}
