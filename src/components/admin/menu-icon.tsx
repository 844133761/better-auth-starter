import {
  LayoutGrid,
  Users,
  Settings,
  Folder,
  FileText,
  ChartColumn,
  ShoppingBag,
  Shield,
  Globe,
  Database,
} from "lucide-react";

const icons = {
  LayoutGrid,
  Users,
  Settings,
  Folder,
  FileText,
  ChartColumn,
  ShoppingBag,
  Shield,
  Globe,
  Database,
};
export function MenuIcon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  const Icon = icons[name as keyof typeof icons] ?? LayoutGrid;
  return <Icon className={className} />;
}
