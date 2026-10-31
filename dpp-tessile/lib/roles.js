// k() only marks a string as an i18n key so scripts/check-i18n.js can see it.
const k = (key) => key;

export const ROLE_LABEL_KEYS = {
  owner: k("role.owner"),
  admin: k("role.admin"),
  employee: k("role.employee"),
  passport_author: k("role.passport_author"),
  document_specialist: k("role.document_specialist"),
  approver: k("role.approver"),
  supplier: k("role.supplier"),
  auditor: k("role.auditor")
};
