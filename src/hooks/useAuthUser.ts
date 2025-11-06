import { API } from "@/utils/api";
import { useQuery } from "@tanstack/react-query";

export default function useAuthUser() {
  const userQuery = useQuery({
    queryKey: ["auth-user"],
    queryFn: API.users.current,
    retry: false,
  });
  return userQuery.data;
}
