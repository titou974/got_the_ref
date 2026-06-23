// Échelle de couleurs partagée pour les scores 0-100.

// Famille émeraude/teal pour les bons scores, ambre/rouge pour les alertes.
export const ACCENT = "#11b48c"; // émeraude principale (≈ accent portfolio)

export function scoreColor(score: number): string {
  if (score >= 75) return "#11b48c"; // émeraude
  if (score >= 55) return "#3fd6ad"; // teal clair
  if (score >= 40) return "#f5a524"; // ambre
  return "#e5484d"; // rouge
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "Excellent";
  if (score >= 55) return "Correct";
  if (score >= 40) return "À améliorer";
  return "Critique";
}

export function visibilityColor(
  visibility: "forte" | "moyenne" | "faible" | "absente",
): string {
  switch (visibility) {
    case "forte":
      return "#11b48c";
    case "moyenne":
      return "#3fd6ad";
    case "faible":
      return "#f5a524";
    case "absente":
      return "#e5484d";
  }
}

export function priorityColor(
  priority: "critique" | "haute" | "moyenne" | "basse",
): string {
  switch (priority) {
    case "critique":
      return "#e5484d";
    case "haute":
      return "#f5a524";
    case "moyenne":
      return "#3fd6ad";
    case "basse":
      return "#94a3b8";
  }
}
