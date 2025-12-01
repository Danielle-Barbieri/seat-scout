import { Location } from '@/types/location';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coffee, BookOpen, Wifi, Clock, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface LocationDetailsProps {
  location: Location;
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

const getLikelihoodDescription = (likelihood: number) => {
  if (likelihood >= 75) return 'Good chance of finding workspace seating';
  if (likelihood >= 50) return 'Seating may be available, arrive early';
  if (likelihood >= 25) return 'Very limited seating expected';
  return 'Likely full, consider alternative location';
};

// Simulate predicted availability throughout the day
const getPredictedAvailability = () => {
  const timeSlots = [
    { time: '8 AM', label: 'Early Morning', likelihood: 90 },
    { time: '10 AM', label: 'Mid Morning', likelihood: 70 },
    { time: '12 PM', label: 'Lunch', likelihood: 30 },
    { time: '2 PM', label: 'Afternoon', likelihood: 60 },
    { time: '4 PM', label: 'Late Afternoon', likelihood: 50 },
    { time: '6 PM', label: 'Evening', likelihood: 40 },
  ];
  return timeSlots;
};

const LocationDetails = ({ location }: LocationDetailsProps) => {
  const Icon = location.type === 'cafe' ? Coffee : BookOpen;
  const availability = getPredictedAvailability();
  
  const formatDistance = (meters?: number) => {
    if (!meters) return null;
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getTodayClosingTime = () => {
    const descriptions = location.openingHours?.weekdayDescriptions;
    if (!descriptions || !location.openingHours?.openNow) return undefined;

    // Match today's label in the opening hours strings
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
    <Card className="p-4 border-l-4" style={{
      borderLeftColor:
        location.busyness === 'low'
          ? 'hsl(var(--success))'
          : location.busyness === 'moderate'
          ? 'hsl(var(--warning))'
          : 'hsl(var(--destructive))',
    }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0 max-w-[calc(100%-160px)]">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-5 h-5 text-primary flex-shrink-0" />
            <h3 className="font-bold text-lg text-foreground truncate">{location.name}</h3>
          </div>
          
          <div className="flex items-start gap-2 mb-2">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground break-words">{location.address}</p>
          </div>

          {location.rating && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">{location.rating}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                ({location.userRatingsTotal?.toLocaleString()} reviews)
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className={cn('font-medium', getBusinessColor(location.busyness))}>
              {location.isLiveData && <span className="mr-1.5 text-xs">🔴</span>}
              {getBusinessText(location.busyness)} Now
            </Badge>
            {location.isLiveData && (
              <Badge variant="secondary" className="text-xs">
                Live Data
              </Badge>
            )}
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
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className={cn(
            'px-4 py-3 rounded-lg text-center w-[140px]',
            location.likelihood >= 70 
              ? 'bg-success/10 border border-success/20' 
              : location.likelihood >= 40 
              ? 'bg-warning/10 border border-warning/20'
              : 'bg-destructive/10 border border-destructive/20'
          )}>
            <div className={cn('text-4xl font-bold mb-2', getLikelihoodColor(location.likelihood))}>
              {getLikelihoodIcon(location.likelihood)}
            </div>
            <div className={cn('text-sm font-semibold mb-1', getLikelihoodColor(location.likelihood))}>
              {getLikelihoodText(location.likelihood)}
            </div>
            <div className="text-xs text-muted-foreground">
              {getLikelihoodDescription(location.likelihood)}
            </div>
          </div>
        </div>
      </div>

      {/* Opening Hours */}
      {location.openingHours?.weekdayDescriptions && (
        <div className="mb-4 pb-4 border-b">
          <h4 className="text-sm font-semibold mb-3 text-foreground">Opening Hours</h4>
          <div className="space-y-1.5">
            {location.openingHours.weekdayDescriptions.map((desc, idx) => {
              const [day, hours] = desc.split(': ');
              const isToday = new Date().getDay() === (idx + 1) % 7; // Adjust for Sunday being 0
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex justify-between text-sm',
                    isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  )}
                >
                  <span>{day}</span>
                  <span className={hours === 'Closed' ? 'text-destructive' : ''}>{hours}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Predicted Availability Throughout Day */}
      <div>
        <h4 className="text-sm font-semibold mb-3 text-foreground">Workspace Availability by Time</h4>
        <div className="space-y-3">
          {availability.map((slot) => {
            const statusText = getLikelihoodText(slot.likelihood);
            const statusColor = getLikelihoodColor(slot.likelihood);
            const statusIcon = getLikelihoodIcon(slot.likelihood);
            
            return (
              <div key={slot.time} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-foreground">{slot.label}</span>
                    <span className="text-xs text-muted-foreground">{slot.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-lg font-bold', statusColor)}>{statusIcon}</span>
                    <span className={cn('text-xs font-semibold', statusColor)}>{statusText}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default LocationDetails;