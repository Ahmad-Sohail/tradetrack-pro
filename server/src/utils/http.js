export class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) {
    const fields = {};
    for (const i of r.error.issues) fields[i.path.join(".") || "_"] = fields[i.path.join(".") || "_"] || i.message;
    throw new HttpError(400, "Please fix the highlighted fields.", fields);
  }
  return r.data;
};
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const isId = (id) => /^[a-f\d]{24}$/i.test(String(id));
export const assertId = (id) => { if (!isId(id)) throw new HttpError(400, "Invalid id."); };
