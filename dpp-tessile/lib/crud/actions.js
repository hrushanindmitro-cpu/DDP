"use server";
import { deleteEntity, saveEntity } from "./server";

// The entity key comes from a hidden form field and is checked against a fixed list on the server.
export async function saveEntityAction(formData) {
  return saveEntity(String(formData.get("entity") || ""), formData);
}
export async function deleteEntityAction(formData) {
  return deleteEntity(String(formData.get("entity") || ""), formData);
}
