import { Location } from '@/types/location';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coffee, BookOpen, Wifi, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationCardProps {
  location: Location;
  onClick: () => void;
}

const getBusinessColor = (busyness: string) => {
  switch (busyness) {
    case 'low':
      return 'bg-success/10 text-success border-success/20';
    case 'moderate':
      return 'bg-warning/10 text-warning border-warning/20';
    case 'high':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getBusinessText = (busyness: string) => {
  switch (busyness) {
    case 'low':
      return 'Quiet';
    case 'moderate':
      return 'Moderate';
    case 'high':
      return 'Busy';
    default:
      return 'Unknown';
  }
};

const getLikelihoodColor = (likelihood: number) => {
  if (likelihood >= 70) return 'text-success';
  if (likelihood >= 40) return 'text-warning';
  return 'text-destructive';
};

const getLikelihoodText = (likelihood: number) => {
  if (likelihood >= 75) return 'Likely Available';
  if (likelihood >= 50) return 'May Be Available';
  if (likelihood >= 25) return 'Limited Seating';
  return 'Likely Full';
};

const getLikelihoodIcon = (likelihood: number) => {
  if (likelihood >= 75) return '✓';
  if (likelihood >= 50) return '○';
  if (likelihood >= 25) return '△';
  return '✕';
};

const LocationCard = ({ location, onClick }: LocationCardProps) => {
  const Icon = location.type === 'cafe' ? Coffee : BookOpen;
  
  const formatDistance = (meters?: number) => {
    if (!meters) return null;
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getTodayClosingTime = () => {
    const descriptions = location.openingHours?.weekdayDescriptions;
    if (!descriptions || !location.openingHours?.openNow) return undefined;

    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[today.getDay()];

    const todayHours = descriptions.find((desc) => desc.startsWith(todayName));
    if (!todayHours || todayHours.includes('Closed')) return undefined;

    const match = todayHours.match(/–\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/);
    return match ? match[1] : undefined;
  };

  const openUntil = getTodayClosingTime();

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all border-l-4 hover:scale-[1.02]"
      style={{
        borderLeftColor:
          location.busyness === 'low'
            ? 'hsl(var(--success))'
            : location.busyness === 'moderate'
            ? 'hsl(var(--warning))'
            : 'hsl(var(--destructive))',
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="font-semibold text-foreground truncate">{location.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-2 truncate">{location.address}</p>
          
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <Badge variant="outline" className={cn('font-medium', getBusinessColor(location.busyness))}>
              {getBusinessText(location.busyness)}
            </Badge>
            {location.hasWifi && (
              <Badge variant="outline" className="text-xs">
                <Wifi className="w-3 h-3 mr-1" />
                WiFi
              </Badge>
            )}
            {openUntil && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Open until {openUntil}
              </Badge>
            )}
          </div>

          {(location.distance || location.walkingTime) && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {location.distance && (
                <span className="font-medium">{formatDistance(location.distance)} away</span>
              )}
              {location.walkingTime && (
                <span>{location.walkingTime} min walk</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className={cn(
            'px-3 py-2 rounded-lg text-center',
            location.likelihood >= 70 
              ? 'bg-success/10 border border-success/20' 
              : location.likelihood >= 40 
              ? 'bg-warning/10 border border-warning/20'
              : 'bg-destructive/10 border border-destructive/20'
          )}>
            <div className={cn('text-2xl font-bold mb-1', getLikelihoodColor(location.likelihood))}>
              {getLikelihoodIcon(location.likelihood)}
            </div>
            <div className={cn('text-xs font-semibold whitespace-nowrap', getLikelihoodColor(location.likelihood))}>
              {getLikelihoodText(location.likelihood)}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LocationCard;
