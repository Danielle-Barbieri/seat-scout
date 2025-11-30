import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface SearchBoxProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void;
}

const SearchBox = ({ onLocationSelect }: SearchBoxProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a location');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ address: searchQuery }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        toast.error(data.error || 'Failed to find location');
        return;
      }

      onLocationSelect(data.lat, data.lng, data.formattedAddress);
      toast.success(`Location found: ${data.formattedAddress}`);
      setSearchQuery('');
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search location');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex gap-2 w-full">
      <div className="relative flex-1">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="pl-9"
          disabled={loading}
        />
      </div>
      <Button
        onClick={handleSearch}
        disabled={loading || !searchQuery.trim()}
        size="icon"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
};

export default SearchBox;