/**
 * Middleware Express para validar body/params/query com schemas Zod.
 */
export function validateZod(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join(' ')
      return res.status(422).json({ msg })
    }
    req[source] = result.data
    next()
  }
}
