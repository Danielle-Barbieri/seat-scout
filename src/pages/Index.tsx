import { useState, useEffect, useRef } from 'react';
import Map from '@/components/Map';
import LocationCard from '@/components/LocationCard';
import LocationDetails from '@/components/LocationDetails';
import SearchBox from '@/components/SearchBox';
import { Button } from '@/components/ui/button';
import { Location, LocationType } from '@/types/location';
import { MapPin, Coffee, BookOpen, Loader2, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const Index = () => {
  const [userLocation, setUserLocation] = useState<[number, number]>([37.7749, -122.4194]); // SF default
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [filter, setFilter] = useState<LocationType | 'all'>('all');
  const [mapboxToken] = useState('pk.eyJ1IjoiZGFuaWVsbGVseW5iYXJiaWVyaSIsImEiOiJjbWltYTh0NzUxYWNkM2ZxMzhlMHA0bnBhIn0.MOCVTwVpuj1oxsv6_xJOSA');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const [hasRealLocation, setHasRealLocation] = useState(false); // Track if location is from GPS
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserDraggingRef = useRef(false); // Track if user is manually moving map
  const [timeMode, setTimeMode] = useState<'now' | 'later'>('now');
  const [selectedDate, setSelectedDate] = useState(0); // 0 = today, 1 = tomorrow, etc.
  const [selectedHour, setSelectedHour] = useState(12); // 12 PM default

  // Helper functions - must be defined before use
  const getDayLabel = (offset: number) => {
    if (offset === 0) return 'Today';
    if (offset === 1) return 'Tomorrow';
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTimeLabel = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  // Check if a location is open at a specific time
  const isOpenAtTime = (location: Location, dayOffset: number, hour: number): boolean => {
    if (!location.openingHours?.weekdayDescriptions) return true;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dayOfWeek = targetDate.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = dayNames[dayOfWeek];

    const todayHours = location.openingHours.weekdayDescriptions.find(desc => 
      desc.startsWith(targetDayName)
    );

    if (!todayHours || todayHours.includes('Closed')) return false;

    // Parse hours (e.g., "9:00 AM – 10:00 PM")
    const timeMatch = todayHours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*–\s*(\d{1,2}):(\d{2})\s*(AM|PM)/);
    if (!timeMatch) return true; // If can't parse, assume open

    const [, openHourStr, openMin, openPeriod, closeHourStr, closeMin, closePeriod] = timeMatch;
    
    let openHour = parseInt(openHourStr);
    if (openPeriod === 'PM' && openHour !== 12) openHour += 12;
    if (openPeriod === 'AM' && openHour === 12) openHour = 0;

    let closeHour = parseInt(closeHourStr);
    if (closePeriod === 'PM' && closeHour !== 12) closeHour += 12;
    if (closePeriod === 'AM' && closeHour === 12) closeHour = 0;

    return hour >= openHour && hour < closeHour;
  };

  const fetchNearbyPlaces = async (lat: number, lng: number, locationType?: LocationType | 'all') => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-places`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lat,
            lng,
            type: locationType === 'all' || !locationType ? 'cafe' : locationType,
          }),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching places:', data.error);
        toast.error('Failed to fetch nearby places');
        return;
      }

      setLocations(data.locations || []);
    } catch (error) {
      console.error('Error fetching places:', error);
      toast.error('Failed to fetch nearby places');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setUserLocation([lat, lng]);
          setHasRealLocation(true); // Mark as real GPS location
          fetchNearbyPlaces(lat, lng, filter);
        },
        (error) => {
          console.log('Location access denied, using default location');
          setHasRealLocation(false);
          fetchNearbyPlaces(userLocation[0], userLocation[1], filter);
        }
      );
    } else {
      setHasRealLocation(false);
      fetchNearbyPlaces(userLocation[0], userLocation[1], filter);
    }
  }, []);

  const filteredLocations = filter === 'all' ? locations : locations.filter((loc) => loc.type === filter);

  // Filter by selected time if not "now"
  const timeFilteredLocations = timeMode === 'now' 
    ? filteredLocations 
    : filteredLocations.filter(loc => isOpenAtTime(loc, selectedDate, selectedHour));

  useEffect(() => {
    if (userLocation) {
      fetchNearbyPlaces(userLocation[0], userLocation[1], filter);
    }
  }, [filter]);

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
  };

  const handleSearchLocationSelect = (lat: number, lng: number, address: string) => {
    setUserLocation([lat, lng]);
    setHasRealLocation(false); // Searched location, not real GPS
    fetchNearbyPlaces(lat, lng, filter);
  };

  const handleMapMoved = (lat: number, lng: number) => {
    // Only fetch if user manually moved the map
    if (!isUserDraggingRef.current) return;
    
    // Debounce the fetch to avoid too many requests while dragging
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      setUserLocation([lat, lng]);
      setHasRealLocation(false); // Map dragged location, not real GPS
      fetchNearbyPlaces(lat, lng, filter);
      isUserDraggingRef.current = false; // Reset after fetch
    }, 500); // Wait 500ms after user stops dragging
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 z-[1000] bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">SeatScout</h1>
                <p className="text-xs text-muted-foreground">Find today's workspace</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Time Mode Selector */}
              <div className="flex gap-1 border rounded-lg p-1">
                <Button
                  variant={timeMode === 'now' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimeMode('now')}
                  className="h-8 text-xs"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Now
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={timeMode === 'later' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 text-xs"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      {timeMode === 'later' ? `${getDayLabel(selectedDate)} ${getTimeLabel(selectedHour)}` : 'Another Time'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Day</label>
                        <Select 
                          value={selectedDate.toString()} 
                          onValueChange={(v) => {
                            setSelectedDate(parseInt(v));
                            setTimeMode('later');
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                {getDayLabel(day)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Select Time</label>
                        <Select 
                          value={selectedHour.toString()} 
                          onValueChange={(v) => {
                            setSelectedHour(parseInt(v));
                            setTimeMode('later');
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => i + 6).filter(h => h < 24).map((hour) => (
                              <SelectItem key={hour} value={hour.toString()}>
                                {getTimeLabel(hour)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="hidden sm:flex"
                >
                  All
                </Button>
                <Button
                  variant={filter === 'cafe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('cafe')}
                >
                  <Coffee className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Cafes</span>
                </Button>
                <Button
                  variant={filter === 'library' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('library')}
                >
                  <BookOpen className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Libraries</span>
                </Button>
              </div>
            </div>
          </div>

          <SearchBox onLocationSelect={handleSearchLocationSelect} />
        </div>
      </div>

      {/* Main content - Map and List side by side */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="w-full md:w-3/5 h-1/2 md:h-full">
          <Map
            locations={timeFilteredLocations}
            center={userLocation}
            onLocationClick={handleLocationClick}
            apiKey={mapboxToken}
            onMapReady={(map) => {
              mapInstanceRef.current = map;
            }}
            onMapMoved={handleMapMoved}
            onUserDragStart={() => {
              isUserDraggingRef.current = true;
            }}
          />
        </div>

        {/* List panel */}
        <div className="w-full md:w-2/5 h-1/2 md:h-full bg-background border-l overflow-y-auto">
          <div className="p-4 md:p-6">
            {selectedLocation ? (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-foreground">Workspace Details</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLocation(null)}
                    className="text-muted-foreground"
                  >
                    View All
                  </Button>
                </div>
                <LocationDetails location={selectedLocation} />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    {loading ? 'Loading...' : `${timeFilteredLocations.length} Workspaces ${timeMode === 'later' ? `Open ${getDayLabel(selectedDate)} at ${getTimeLabel(selectedHour)}` : 'Nearby'}`}
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {timeFilteredLocations.map((location) => (
                        <LocationCard
                          key={location.id}
                          location={{
                            ...location,
                            // Only show distance/walk time if we have real GPS location
                            distance: hasRealLocation ? location.distance : undefined,
                            walkingTime: hasRealLocation ? location.walkingTime : undefined,
                          }}
                          onClick={() => {
                            setSelectedLocation(location);
                          }}
                        />
                      ))}
                    </div>

                    {timeFilteredLocations.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No {filter === 'all' ? 'workspaces' : filter === 'cafe' ? 'cafes' : 'libraries'} found
                        {timeMode === 'later' && ` open ${getDayLabel(selectedDate)} at ${getTimeLabel(selectedHour)}`}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
