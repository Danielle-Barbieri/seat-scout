import { useState, useEffect } from 'react';
import Map from '@/components/Map';
import LocationCard from '@/components/LocationCard';
import { Button } from '@/components/ui/button';
import { mockLocations } from '@/data/mockLocations';
import { Location, LocationType } from '@/types/location';
import { MapPin, Coffee, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index = () => {
  const [userLocation, setUserLocation] = useState<[number, number]>([37.7749, -122.4194]); // SF default
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [filter, setFilter] = useState<LocationType | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapboxToken] = useState('pk.eyJ1IjoiZGFuaWVsbGVseW5iYXJiaWVyaSIsImEiOiJjbWltYTh0NzUxYWNkM2ZxMzhlMHA0bnBhIn0.MOCVTwVpuj1oxsv6_xJOSA');

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.log('Location access denied, using default location');
        }
      );
    }
  }, []);

  const filteredLocations = mockLocations.filter((loc) => {
    if (filter === 'all') return true;
    return loc.type === filter;
  });

  const handleLocationClick = (location: Location) => {
    setSelectedLocation(location);
    setDrawerOpen(true);
  };

  const handleRecenter = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
      });
    }
  };

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
                <p className="text-xs text-muted-foreground">Find your workspace</p>
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

        </div>
      </div>

      {/* Map */}
      <div className="absolute inset-0 pt-[72px]">
        <Map
          locations={filteredLocations}
          center={userLocation}
          onLocationClick={handleLocationClick}
          apiKey={mapboxToken}
        />
      </div>

      {/* Recenter button */}
      <Button
        onClick={handleRecenter}
        size="icon"
        className="absolute top-24 right-4 z-[1000] shadow-lg"
      >
        <MapPin className="w-4 h-4" />
      </Button>

      {/* Bottom drawer */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-[1000] bg-background rounded-t-3xl shadow-2xl transition-transform duration-300 ease-in-out',
          drawerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-140px)]'
        )}
      >
        {/* Drawer handle */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="w-full py-3 flex justify-center"
        >
          <div className="w-12 h-1.5 bg-muted rounded-full" />
        </button>

        {/* Drawer content */}
        <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {filteredLocations.length} Workspaces Nearby
            </h2>
          </div>

          <div className="space-y-3">
            {filteredLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                onClick={() => {
                  setSelectedLocation(location);
                  setUserLocation([location.lat, location.lng]);
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
        </div>
      </div>
    </div>
  );
};

export default Index;
