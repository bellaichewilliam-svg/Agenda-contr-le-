// Icônes des tampons (trait, 24 × 24), une par type de commerce. Même liste dans supabase/functions/fid-wallet/index.ts.
(function (g) {
  const c = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const I = {
    cafe: "M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z M16 11h1.5a2.5 2.5 0 0 1 0 5H16 M8.5 3.5c-1 1 1 2 0 3 M12.5 3.5c-1 1 1 2 0 3",
    pizza: "M12 21 3.5 6.5a14 14 0 0 1 17 0z M5.6 10a11 11 0 0 1 12.8 0 " + c(10, 12.5, 1) + " " + c(14, 13.5, 1) + " " + c(12, 16.5, 1),
    burger: "M4 11a8 6 0 0 1 16 0z M3 14.5h18 M5 17.5h14a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5z M9 8h.01 M13 7h.01",
    sushi: "M4 9a8 3 0 0 0 16 0a8 3 0 0 0-16 0v6a8 3 0 0 0 16 0V9 M9 9a3 1 0 0 0 6 0",
    bakery: "M3 15c2-6 5-9 9-9s7 3 9 9c-2 1-4 1-5-1-1 3-7 3-8 0-1 2-3 2-5 1z M9.5 9l1 5 M14.5 9l-1 5",
    beauty: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
    barber: c(6, 6, 2.8) + " " + c(6, 18, 2.8) + " M8.3 7.7 20 19 M8.3 16.3 20 5",
    flower: c(12, 6.5, 3) + " " + c(17.5, 12, 3) + " " + c(12, 17.5, 3) + " " + c(6.5, 12, 3) + " " + c(12, 12, 1.8),
    shop: "M5 8h14l-1.2 12H6.2z M9 8V6.5a3 3 0 0 1 6 0V8",
    sport: "M6.5 7v10 M17.5 7v10 M3.5 9.5v5 M20.5 9.5v5 M6.5 12h11",
    pet: c(12, 15.5, 3.6) + " " + c(6.5, 10.5, 1.8) + " " + c(9.8, 6.5, 1.8) + " " + c(14.2, 6.5, 1.8) + " " + c(17.5, 10.5, 1.8),
    heart: "M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z",
    gift: "M4.5 10.5h15V20h-15z M3.5 7.5h17v3h-17z M12 7.5V20 M12 7.5C10 3.5 6 4.5 8 7.5 M12 7.5c2-4 6-3 4 0",
  };
  // Couleur conseillée par thème (pastels profonds : le texte blanc reste lisible)
  const COLORS = { cafe: "#8A5A3C", pizza: "#E2574C", burger: "#E0803A", sushi: "#2F7D6D", bakery: "#C98B3E", beauty: "#D9668F",
    barber: "#3D5A80", flower: "#B05FA8", shop: "#5B6CF0", sport: "#2D9C6A", pet: "#E08A4F", heart: "#E25775" };
  g.FIcons = { I, COLORS, svg: (k, size, color, sw) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw || 1.9}" stroke-linecap="round" stroke-linejoin="round"><path d="${I[k] || I.heart}"/></svg>` };
})(typeof window !== "undefined" ? window : globalThis);
