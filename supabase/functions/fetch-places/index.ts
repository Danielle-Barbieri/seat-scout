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
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.currentOpeningHours,places.businessStatus,places.dineIn,places.takeout,places.priceLevel'
      },
      body: JSON.stringify({
        includedTypes: includedTypes,
        maxResultCount: 20,
        rankPreference: 'POPULARITY', // Prioritize popular places
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

    console.log(`Places API response status: ${placesResponse.status}`);
    console.log(`Places API response:`, JSON.stringify(placesData));

    if (!placesResponse.ok) {
      console.error('Places API error details:', {
        status: placesResponse.status,
        statusText: placesResponse.statusText,
        data: placesData
      });
      
      let errorMessage = `Google Places API error: ${placesResponse.status}`;
      
      if (placesResponse.status === 403) {
        errorMessage = 'Google Places API (New) access denied. Please ensure:\n' +
          '1. Places API (New) is enabled in Google Cloud Console\n' +
          '2. Billing is set up for your project\n' +
          '3. Your API key has no restrictions preventing server-side calls\n' +
          '4. The API key has Places API (New) enabled';
      }
      
      throw new Error(errorMessage);
    }

    const results = placesData.places || [];
    console.log(`Found ${results.length} places`);

    // Transform results to our Location format
    const locations = results
      .filter((place: any) => {
        // Filter criteria to ensure workspace-friendly venues
        
        // Must have opening hours info (but don't filter by current open status)
        if (!place.currentOpeningHours?.weekdayDescriptions) return false;
        
        // Relax rating requirements - only exclude very low rated or unrated places
        if (!place.rating || place.rating < 3.0) return false;
        
        const types = place.types || [];
        const name = (place.displayName?.text || '').toLowerCase();
        
        // For libraries, ensure they are PUBLIC libraries only
        if (types.includes('library')) {
          const institutionalTypes = ['university', 'school', 'secondary_school', 'primary_school', 'college'];
          if (types.some((t: string) => institutionalTypes.includes(t))) return false;
          
          const institutionalKeywords = ['college', 'university', 'school', 'academy', 'institute', 'campus'];
          if (institutionalKeywords.some(keyword => name.includes(keyword))) return false;
          
          const publicIndicators = ['public', 'city', 'county', 'town', 'municipal', 'branch'];
          if (!publicIndicators.some(keyword => name.includes(keyword))) return false;
        }
        
        // For cafes and coffee shops - be more permissive
        if (types.includes('cafe') || types.includes('coffee_shop')) {
          // Only exclude if explicitly takeout-only
          if (place.dineIn === false && place.takeout === true) return false;
          
          // Only exclude obvious fast food chains
          if (types.includes('fast_food_restaurant') && !types.includes('cafe')) return false;
          
          return true; // Accept all other cafes/coffee shops
        }
        
        // For bakeries - accept if they have seating or are cafe-style
        if (types.includes('bakery')) {
          // Accept bakeries that allow dine-in or have cafe characteristics
          if (place.dineIn !== false || types.includes('cafe') || types.includes('coffee_shop')) {
            return true;
          }
          return false; // Skip pure takeout bakeries
        }
        
        return true;
      })
      .map((place: any) => {
      const placeLat = place.location?.latitude;
      const placeLng = place.location?.longitude;
      
      if (!placeLat || !placeLng) {
        return null;
      }
      
      const distance = calculateDistance(lat, lng, placeLat, placeLng);
      const walkingTime = calculateWalkingTime(distance);
      
      // Simulate real-time data (70% of places have "live" data for demo)
      const hasLiveData = Math.random() < 0.7;
      
      // Simulate busyness that varies by time of day and ratings
      const hour = new Date().getHours();
      const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 12 && hour <= 14) || (hour >= 17 && hour <= 19);
      const ratingBoost = (place.rating || 0) > 4.3 ? 20 : 0; // Popular places are busier
      
      let basePopularity = Math.floor(Math.random() * 60) + 20; // 20-80 base
      if (isPeakHour) basePopularity = Math.min(100, basePopularity + 30);
      basePopularity = Math.min(100, basePopularity + ratingBoost);
      
      const currentPopularity = basePopularity;
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
        isLiveData: hasLiveData,
        // Let the frontend derive "open until" from openingHours strings to avoid timezone issues
        hasWifi: locationType === 'cafe', // Assume cafes have wifi
        distance: Math.round(distance),
        walkingTime,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        openingHours: place.currentOpeningHours ? {
          openNow: place.currentOpeningHours.openNow,
          weekdayDescriptions: place.currentOpeningHours.weekdayDescriptions,
          nextCloseTime: place.currentOpeningHours.nextCloseTime,
          nextOpenTime: place.currentOpeningHours.nextOpenTime,
        } : undefined,
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
