import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API } from "../utils/api";
import { FacilityModel } from "../types";
export type FeatureFlag = "SCRIBE_ENABLED";

export interface FeatureFlagsResponse {
  user_flags: FeatureFlag[];
  facility_flags: {
    facility: string;
    features: FeatureFlag[];
  }[];
}

const defaultFlags: FeatureFlag[] = [];

const FeatureFlagsContext = createContext<FeatureFlagsResponse>({
  user_flags: defaultFlags,
  facility_flags: [],
});

export const FeatureFlagsProvider = (props: { children: React.ReactNode }) => {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagsResponse>({
    user_flags: defaultFlags,
    facility_flags: [],
  });

  const { data: user } = useQuery({
    queryKey: ["authuser"],
    queryFn: API.users.current,
  });

  useEffect(() => {
    if (user?.user_flags) {
      setFeatureFlags((ff) => ({
        ...ff,
        user_flags: [...defaultFlags, ...(user.user_flags || [])],
      }));
    }
  }, [user]);

  return (
    <FeatureFlagsContext.Provider value={featureFlags}>
      {props.children}
    </FeatureFlagsContext.Provider>
  );
};

export const useFeatureFlags = (facility?: FacilityModel | string) => {
  const [facilityObject, setFacilityObject] = useState<
    FacilityModel | undefined
  >(typeof facility === "string" ? undefined : facility);

  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider",
    );
  }

  const facilityQuery = useQuery({
    queryKey: ["facility", facility],
    queryFn: () =>
      API.facilities.getPermitted(typeof facility === "string" ? facility : ""),
  });

  useEffect(() => {
    facilityQuery.data && setFacilityObject(facilityQuery.data);
  }, [facilityQuery.data]);

  const facilityFlags = facilityObject?.flags || [];

  useEffect(() => {
    facilityQuery.refetch();
  }, [facility]);

  return [...context.user_flags, ...facilityFlags];
};
