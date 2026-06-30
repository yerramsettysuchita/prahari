// Custom dark Google Maps style tuned to the Prahari ink palette.
// Ink base (#0E0F0D), muted geometry, restrained labels. No bright defaults.

export const PRAHARI_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0e0f0d" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b8c84" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e0f0d" }] },

  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2b26" }] },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#a9aaa1" }],
  },

  { featureType: "poi", stylers: [{ visibility: "off" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1b17" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#222319" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6f7068" }] },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#26271f" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#2f3026" }],
  },

  { featureType: "transit", stylers: [{ visibility: "off" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0b09" }] },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3a3b34" }],
  },

  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#121310" }],
  },
];

// One city. Centered on Bengaluru so reports land inside BBMP KB coverage and
// route cleanly through the grounded knowledge base.
export const CITY_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bengaluru
export const CITY_ZOOM = 12;
