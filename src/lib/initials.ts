/**
 * Les initiales de l'avatar : deux lettres au plus.
 *
 * Le nom peut être une adresse e-mail — c'est ce que la coque reçoit quand le
 * compte n'a pas encore de nom. On ne garde alors que ce qui précède l'arobase,
 * sinon tout le monde s'appellerait « G » comme gmail.
 */
export function initials(name: string | null): string {
  const source = (name ?? "").split("@")[0].trim();
  if (!source) return "·";

  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[1][0];
}
