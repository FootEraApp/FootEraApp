import {
  Home,
  Search,
  Volleyball,
  User,
  BarChart3,
  Timer,
  Sprout,
  Medal,
  Target,
  Footprints,
  Users,
  Check,
  Play,
  Camera,
  Heart,
  MessageCircle,
  Calendar,
  Clock,
  Terminal,
  Dumbbell,
  Flag,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

export type IconName =
  | "home"
  | "search"
  | "soccer"
  | "user"
  | "chart"
  | "timer"
  | "seedling"
  | "medal"
  | "target"
  | "footprints"
  | "users"
  | "check"
  | "play"
  | "camera"
  | "heart"
  | "message"
  | "calendar"
  | "clock"
  | "running"
  | "dumbbell"
  | "flag"
  | "chevronRight"
  | "chevronLeft";

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export const Icon = ({ name, className, size = 24 }: IconProps) => {
  const props = {
    className,
    size
  };

  switch (name) {
    case "home":
      return <Home {...props} />;
    case "search":
      return <Search {...props} />;
    case "soccer":
      return <Volleyball {...props} />;
    case "user":
      return <User {...props} />;
    case "chart":
      return <BarChart3 {...props} />;
    case "timer":
      return <Timer {...props} />;
    case "seedling":
      return <Sprout {...props} />;
    case "medal":
      return <Medal {...props} />;
    case "target":
      return <Target {...props} />;
    case "footprints":
      return <Footprints {...props} />;
    case "users":
      return <Users {...props} />;
    case "check":
      return <Check {...props} />;
    case "play":
      return <Play {...props} />;
    case "camera":
      return <Camera {...props} />;
    case "heart":
      return <Heart {...props} />;
    case "message":
      return <MessageCircle {...props} />;
    case "calendar":
      return <Calendar {...props} />;
    case "clock":
      return <Clock {...props} />;
    case "running":
      return <Terminal {...props} />;
    case "dumbbell":
      return <Dumbbell {...props} />;
    case "flag":
      return <Flag {...props} />;
    case "chevronRight":
      return <ChevronRight {...props} />;
    case "chevronLeft":
      return <ChevronLeft {...props} />;
    default:
      return <Volleyball {...props} />;
  }
};

export const getIconByName = (name: string) => {
  switch (name) {
    case "stopwatch":
      return Timer;
    case "bullseye":
      return Target;
    case "medal":
      return Medal;
    case "shoe-prints":
      return Footprints;
    case "users":
      return Users;
    case "running":
      return Terminal;
    case "dumbbell":
      return Dumbbell;
    case "futbol":
      return Volleyball;
    case "flag":
      return Flag;
    default:
      return Volleyball;
  }
};

export default Icon;
