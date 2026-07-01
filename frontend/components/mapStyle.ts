// Custom light Google Maps style tuned to the Prahari paper palette.
// Warm paper geometry, white roads, soft blue water, restrained labels.

export const PRAHARI_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f3ee" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6e6a62" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },

  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#e6e1d6" }] },
  {
    featureType: "administrative.land_parcel",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4b483f" }],
  },

  { featureType: "poi", stylers: [{ visibility: "off" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#ece9e1" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a867c" }] },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#fdf3e0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#f2e4c6" }],
  },

  { featureType: "transit", stylers: [{ visibility: "off" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dbe8f4" }] },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8fb4d6" }],
  },

  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#eef1e8" }],
  },
];

// One city. Centered on Bengaluru so reports land inside BBMP KB coverage and
// route cleanly through the grounded knowledge base.
export const CITY_CENTER = { lat: 12.9716, lng: 77.5946 }; // Bengaluru
export const CITY_ZOOM = 12;
