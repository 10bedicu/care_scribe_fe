import { lazy } from "react";
import AutofillHistory from "./pages/AutofillHistory";
import Page from "./components/Page";
import SidebarIcon from "./components/icon";

interface Manifest {
  plugin: string;
  routes: Record<string, () => React.ReactNode>;
  extends: string[];
  components: Record<
    string,
    React.LazyExoticComponent<
      React.FC<{ formState: unknown; setFormState: unknown }>
    >
  >;
  navItems: Array<{
    url: string;
    name: string;
    icon: React.ReactNode;
  }>;
}

const manifest: Manifest = {
  plugin: "care-scribe",
  routes: {
    "/facility/:facilityId/autofill-history": () => (
      <Page>
        <AutofillHistory />
      </Page>
    ),
  },
  extends: [],
  components: {
    Scribe: lazy(() => import("./Providers")),
  },
  navItems: [
    {
      url: `autofill-history`,
      name: "Autofill History",
      icon: <SidebarIcon />,
    },
  ],
};

export default manifest;
