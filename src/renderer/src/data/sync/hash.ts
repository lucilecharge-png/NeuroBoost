// Empreinte SHA-256 d'un blob, en hexadécimal. Sert à détecter un changement
// de contenu de la base sans instrumenter chaque écriture.
export async function sha256(bytes: Uint8Array): Promise<string> {
  // Copie dans un ArrayBuffer frais : satisfait le typage BufferSource et reste
  // correct quelle que soit la provenance du Uint8Array.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
