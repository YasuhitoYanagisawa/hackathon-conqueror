import { useQuery } from "@tanstack/react-query";
import type { Festival } from "@/data/festivals";

async function fetchFestivals(): Promise<Festival[]> {
  const res = await fetch("/festivals.json");
  if (!res.ok) throw new Error("Failed to load festival DB");
  return res.json();
}

export function useFestivals() {
  return useQuery({
    queryKey: ["festivals"],
    queryFn: fetchFestivals,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
