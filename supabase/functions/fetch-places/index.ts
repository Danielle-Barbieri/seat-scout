import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
  };
  business_status?: string;
}

interface PopularTimesData {
  current_popularity?: number;
  time_spent?: number[];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function calculateWalkingTime(distanceInMeters: number): number {
  // Average walking speed: 5 km/h = 83.33 m/min
  const walkingSpeedMetersPerMin = 83.33;
  return Math.ceil(distanceInMeters / walkingSpeedMetersPerMin);
}

function getBusynessFromPopularity(popularity?: number): string {
  if (!popularity) return 'low';
  if (popularity < 30) return 'low';
  if (popularity < 70) return 'moderate';
  return 'high';
}

function getLikelihoodFromBusyness(busyness: string): number {
  if (busyness === 'low') return 85;
  if (busyness === 'moderate') return 50;
  return 20;
}

function determineLocationType(types: string[]): string {
  // Check for library types
  if (types.includes('library')) return 'library';
  
  // Check for cafe types
  if (types.includes('cafe') || types.includes('coffee_shop')) return 'cafe';
  
  // Default to cafe for places that serve food/drinks
  if (types.includes('restaurant') || types.includes('bakery') || types.includes('food')) {
    return 'cafe';
  }
  
  return 'cafe';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng, type } = await req.json();
    
    if (!lat || !lng) {
      throw new Error('Latitude and longitude are required');
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('Google Places API key not configured');
    }

    console.log(`Fetching places for lat: ${lat}, lng: ${lng}, type: ${type}`);

    // Determine search query based on type
    let searchQuery = type === 'library' 
      ? 'library' 
      : 'cafe OR coffee shop';

    // Use Nearby Search API
    const radius = 2000; // 2km radius
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type === 'library' ? 'library' : 'cafe'}&keyword=${searchQuery}&key=${apiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    console.log(`Places API response status: ${placesData.status}`);

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('Places API error:', placesData);
      throw new Error(`Google Places API error: ${placesData.status}`);
    }

    const results = placesData.results || [];
    console.log(`Found ${results.length} places`);

    // Transform results to our Location format
    const locations = results.slice(0, 20).map((place: PlaceResult) => {
      const distance = calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng);
      const walkingTime = calculateWalkingTime(distance);
      
      // Try to get current popularity (this is limited in the basic API)
      // In production, you might want to use the Places Details API for more accurate data
      const currentPopularity = Math.floor(Math.random() * 100); // Simulated for now
      const busyness = getBusynessFromPopularity(currentPopularity);
      const likelihood = getLikelihoodFromBusyness(busyness);
      
      const locationType = determineLocationType(place.types);
      
      return {
        id: place.place_id,
        name: place.name,
        type: locationType,
        address: place.vicinity,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        busyness,
        likelihood,
        openUntil: place.opening_hours?.open_now ? '9:00 PM' : undefined,
        hasWifi: locationType === 'cafe', // Assume cafes have wifi
        distance: Math.round(distance),
        walkingTime,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total,
      };
    });

    console.log(`Returning ${locations.length} processed locations`);

    return new Response(
      JSON.stringify({ locations }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in fetch-places function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        locations: [], // Return empty array on error
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
