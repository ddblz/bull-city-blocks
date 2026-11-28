/** Original line icons for the card faces (#57): one stroked path each, in a 24 × 24 box. No icon font. */
export const ICON_PATHS = {
  property: "M3 11 L12 4 L21 11 M5 10 V20 H19 V10 M10 20 V14 H14 V20",
  wild: "M4 8 H18 M14 4 L18 8 L14 12 M20 16 H6 M10 12 L6 16 L10 20",
  landmark: "M3 9 L12 4 L21 9 Z M6 11 V18 M10 11 V18 M14 11 V18 M18 11 V18 M3 20 H21",
  icon: "M12 3 L14.6 9 L21 9.6 L16.2 13.8 L17.7 20 L12 16.7 L6.3 20 L7.8 13.8 L3 9.6 L9.4 9 Z",
  cash: "M12 3 a9 9 0 1 0 0.01 0 Z M12 7 V17 M9.5 9.5 C9.5 8 14.5 8 14.5 10 C14.5 12 9.5 12 9.5 14 C9.5 16 14.5 16 14.5 14.5",
  rent: "M5 4 H19 V20 L16 18 L12 20 L8 18 L5 20 Z M8.5 9 H15.5 M8.5 13 H15.5",
  walkOffWin: "M12 3 a9 9 0 1 0 0.01 0 Z M5 6 C9 9 9 15 5 18 M19 6 C15 9 15 15 19 18",
  foodTruckRodeo:
    "M2 7 H14 V16 H2 Z M14 10 H19 L22 13 V16 H14 M6.5 19 a1.5 1.5 0 1 0 0.01 0 M17.5 19 a1.5 1.5 0 1 0 0.01 0",
  assessment: "M7 4 H17 V20 H7 Z M10 3 H14 V6 H10 Z M9.5 10 H14.5 M9.5 14 H14.5",
  buyout: "M4 12 H15 M11 8 L15 12 L11 16 M17 5 H20 V19 H17",
  swapMeet: "M4 8 H18 M14 4 L18 8 L14 12 M20 16 H6 M10 12 L6 16 L10 20",
  hostileTakeover: "M6 21 V4 M6 5 H18 L15 9 L18 13 H6",
  appeal: "M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z",
  constructionDelay: "M6 3 H18 M6 21 H18 M7 3 C7 9 17 9 17 3 M7 21 C7 15 17 15 17 21",
  rentHike: "M12 20 V5 M6 11 L12 5 L18 11",
} as const;

export type IconName = keyof typeof ICON_PATHS;
