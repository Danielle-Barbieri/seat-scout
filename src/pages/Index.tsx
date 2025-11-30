import { useState, useEffect, useRef } from 'react';
import Map from '@/components/Map';
import LocationCard from '@/components/LocationCard';
import LocationDetails from '@/components/LocationDetails';
import SearchBox from '@/components/SearchBox';
import { Button } from '@/components/ui/button';
import { Location, LocationType } from '@/types/location';
import { MapPin, Coffee, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';

const Index = () => {
  const [userLocation, setUserLocation] = useState<[number, number]>([37.7749, -122.4194]); // SF default
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [filter, setFilter] = useState<LocationType | 'all'>('all');
  const [mapboxToken] = useState('pk.eyJ1IjoiZGFuaWVsbGVseW5iYXJiaWVyaSIsImEiOiJjbWltYTh0NzUxYWNkM2ZxMzhlMHA0bnBhIn0.MOCVTwVpuj1oxsv6_xJOSA');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelHeight, setPanelHeight] = useState(40); // percentage of screen
  const [isDragging, setIsDragging] = useState(false);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);

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
          fetchNearbyPlaces(lat, lng, filter);
        },
        (error) => {
          console.log('Location access denied, using default location');
          fetchNearbyPlaces(userLocation[0], userLocation[1], filter);
        }
      );
    } else {
      fetchNearbyPlaces(userLocation[0], userLocation[1], filter);
    }
  }, []);

  const filteredLocations = filter === 'all' ? locations : locations.filter((loc) => loc.type === filter);

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
    fetchNearbyPlaces(lat, lng, filter);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setUserLocation([lat, lng]);
    fetchNearbyPlaces(lat, lng, filter);
    toast.success('Location updated');
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const windowHeight = window.innerHeight;
    const headerHeight = 72;
    const newHeight = ((windowHeight - clientY) / (windowHeight - headerHeight)) * 100;
    
    // Constrain between 20% and 80%
    const constrainedHeight = Math.min(Math.max(newHeight, 20), 80);
    setPanelHeight(constrainedHeight);
    
    // Trigger map resize
    if (mapInstanceRef.current) {
      requestAnimationFrame(() => {
        mapInstanceRef.current?.resize();
      });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
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

          <SearchBox onLocationSelect={handleSearchLocationSelect} />
        </div>
      </div>

      {/* Map - adjusts height based on panel */}
      <div 
        className="absolute inset-0 pt-[72px]"
        style={{ bottom: `${panelHeight}vh` }}
      >
        <Map
          locations={filteredLocations}
          center={userLocation}
          onLocationClick={handleLocationClick}
          onMapClick={handleMapClick}
          apiKey={mapboxToken}
          onMapReady={(map) => {
            mapInstanceRef.current = map;
          }}
        />
      </div>

      {/* Resizable panel */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[1000] bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ height: `${panelHeight}vh` }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          className="w-full py-3 flex justify-center cursor-row-resize hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <div className="w-12 h-1.5 bg-muted-foreground/50 rounded-full" />
        </div>

        {/* Drawer content */}
        <div className="px-4 pb-6 overflow-y-auto flex-1">
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
                  {loading ? 'Loading...' : `${filteredLocations.length} Workspaces Nearby`}
                </h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {filteredLocations.map((location) => (
                      <LocationCard
                        key={location.id}
                        location={location}
                        onClick={() => {
                          setSelectedLocation(location);
                        }}
                      />
                    ))}
                  </div>

                  {filteredLocations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No {filter === 'all' ? 'workspaces' : filter === 'cafe' ? 'cafes' : 'libraries'} found
                      nearby
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
