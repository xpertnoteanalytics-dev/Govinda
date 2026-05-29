import {
  Search,
  PhoneCall,
  MessageCircle,
  CalendarClock,
  FileHeart,
  BarChart3,
} from "lucide-react";
import type { WorkflowStep } from "@/components/ui/WorkflowRibbon";

export const HEALTHCARE_WORKFLOW_STEPS: WorkflowStep[] = [
  { label: "Find Care", icon: Search },
  { label: "Call", icon: PhoneCall },
  { label: "Outreach", icon: MessageCircle },
  { label: "Appointment", icon: CalendarClock },
  { label: "Report", icon: FileHeart },
  { label: "Analytics", icon: BarChart3 },
];
