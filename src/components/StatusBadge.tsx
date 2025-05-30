import { Badge } from "@/components/ui/badge";
import { ScribeModel } from "@/types";
import { MicrophoneIcon } from "@/utils/icons";
import {
  CheckIcon,
  CircleBackslashIcon,
  ClockIcon,
  Cross1Icon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";

type StatusType = ScribeModel["status"];

interface StatusBadgeProps {
  status: StatusType;
}

export const getStatusConfig = (status: StatusType) => {
  switch (status) {
    case "CREATED":
      return {
        variant: "outline" as const,
        icon: <ClockIcon className="mr-1 h-3 w-3" />,
        label: "Created",
      };
    case "READY":
      return {
        variant: "outline" as const,
        icon: <CheckIcon className="mr-1 h-3 w-3" />,
        label: "Ready",
      };
    case "GENERATING_TRANSCRIPT":
      return {
        variant: "secondary" as const,
        icon: <MicrophoneIcon className="mr-1 h-3 w-3 animate-pulse" />,
        label: "Transcribing",
      };
    case "GENERATING_AI_RESPONSE":
      return {
        variant: "secondary" as const,
        icon: <LightningBoltIcon className="mr-1 h-3 w-3 animate-pulse" />,
        label: "Generating",
      };
    case "COMPLETED":
      return {
        variant: "success" as const,
        icon: <CheckIcon className="mr-1 h-3 w-3" />,
        label: "Completed",
      };
    case "REFUSED":
      return {
        variant: "destructive" as const,
        icon: <CircleBackslashIcon className="mr-1 h-3 w-3" />,
        label: "Refused",
      };
    case "FAILED":
      return {
        variant: "destructive" as const,
        icon: <Cross1Icon className="mr-1 h-3 w-3" />,
        label: "Failed",
      };
    default:
      return {
        variant: "outline" as const,
        icon: <ClockIcon className="mr-1 h-3 w-3" />,
        label: status,
      };
  }
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { variant, icon, label } = getStatusConfig(status);

  return (
    <Badge variant={variant} className="flex items-center">
      {icon}
      {label}
    </Badge>
  );
}
