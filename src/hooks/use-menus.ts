"use client";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import type { MenuItem } from "@/lib/menus";

export const menusQueryKey = ["menus"] as const;
export function useMenus() {
  return useQuery({
    queryKey: menusQueryKey,
    queryFn: ({ signal }) =>
      apiRequest<MenuItem[]>("/api/admin/menus", { signal }),
  });
}

export const navigationQueryKey = ["navigation"] as const;
export function useNavigation() {
  return useQuery({
    queryKey: navigationQueryKey,
    queryFn: ({ signal }) =>
      apiRequest<MenuItem[]>("/api/navigation", { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}
