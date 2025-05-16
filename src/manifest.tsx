import { lazy } from "react";
import Page from "./components/Page";
import SidebarIcon from "./components/icon";

interface NavigationLink {
  url: string;
  name: string;
  icon?: React.ReactNode;
}
interface Manifest {
  plugin: string;
  routes: Record<string, (...args: any) => React.ReactNode>;
  extends: string[];
  components: Record<
    string,
    React.LazyExoticComponent<
      React.FC<{ formState: unknown; setFormState: unknown }>
    >
  >;
  navItems?: NavigationLink[];
  userNavItems?: NavigationLink[];
}

const AutofillHistoryLazy = lazy(() => import("./pages/AutofillHistory"));

const manifest: Manifest = {
  plugin: "care-scribe",
  routes: {
    "/facility/:facilityId/users/:user/scribe-history": () => (
      <Page>
        <AutofillHistoryLazy />
      </Page>
    ),
  },
  extends: [],
  components: {
    Scribe: lazy(() => import("./Providers")),
  },
  userNavItems: [
    {
      url: `scribe-history`,
      name: "Scribe History",
      icon: <SidebarIcon />,
    },
  ],
};

export default manifest;
