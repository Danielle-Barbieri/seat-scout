import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


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

    // Use new Places API (New) with searchNearby
    const includedTypes = type === 'library' ? ['library'] : ['cafe', 'coffee_shop'];
    
    const placesUrl = 'https://places.googleapis.com/v1/places:searchNearby';
    
    const placesResponse = await fetch(placesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.currentOpeningHours,places.businessStatus'
      },
      body: JSON.stringify({
        includedTypes: includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: lat,
              longitude: lng
            },
            radius: 2000.0 // 2km radius
          }
        }
      })
    });

    const placesData = await placesResponse.json();

    console.log(`Places API response:`, JSON.stringify(placesData).substring(0, 200));

    if (!placesResponse.ok) {
      console.error('Places API error:', placesData);
      throw new Error(`Google Places API error: ${placesResponse.status}`);
    }

    const results = placesData.places || [];
    console.log(`Found ${results.length} places`);

    // Transform results to our Location format
    const locations = results.map((place: any) => {
      const placeLat = place.location?.latitude;
      const placeLng = place.location?.longitude;
      
      if (!placeLat || !placeLng) {
        return null;
      }
      
      const distance = calculateDistance(lat, lng, placeLat, placeLng);
      const walkingTime = calculateWalkingTime(distance);
      
      // Simulate busyness data (Google's Popular Times requires special access)
      const currentPopularity = Math.floor(Math.random() * 100);
      const busyness = getBusynessFromPopularity(currentPopularity);
      const likelihood = getLikelihoodFromBusyness(busyness);
      
      const locationType = determineLocationType(place.types || []);
      
      return {
        id: place.id,
        name: place.displayName?.text || 'Unknown',
        type: locationType,
        address: place.formattedAddress || '',
        lat: placeLat,
        lng: placeLng,
        busyness,
        likelihood,
        openUntil: place.currentOpeningHours?.openNow ? '9:00 PM' : undefined,
        hasWifi: locationType === 'cafe', // Assume cafes have wifi
        distance: Math.round(distance),
        walkingTime,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
      };
    }).filter(Boolean);

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
