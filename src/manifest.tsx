import { lazy } from "react";
import Page from "./components/Page";
import SidebarIcon from "./components/Icon";
import BenchmarkPage from "./pages/Benchmark";
import ScribeQuotas from "./pages/Quotas";

interface NavigationLink {
  url: string;
  name: string;
  icon?: React.ReactNode;
  children?: NavigationLink[];
}
interface Manifest {
  plugin: string;
  routes: Record<string, (...args: any) => React.ReactNode>;
  extends: string[];
  components: Record<
    string,
    React.LazyExoticComponent<
      React.FC<{
        formState: unknown;
        setFormState: (formState: unknown) => void;
      }>
    >
  >;
  navItems?: NavigationLink[];
  userNavItems?: NavigationLink[];
  adminNavItems?: NavigationLink[];
}

const HistoryListLazy = lazy(() => import("./pages/HistoryList"));
const HistoryDetailsLazy = lazy(() => import("./pages/HistoryDetails"));

const manifest: Manifest = {
  plugin: "care-scribe",
  routes: {
    "/facility/:facilityId/users/:user/scribe-history": () => (
      <Page>
        <HistoryListLazy />
      </Page>
    ),
    "/facility/:facilityId/users/:user/scribe-history/:id": ({ id }) => (
      <Page>
        <HistoryDetailsLazy scribeId={id} />
      </Page>
    ),
    "/admin/scribe/benchmark": () => (
      <Page>
        <BenchmarkPage />
      </Page>
    ),
    "/admin/scribe/quotas": () => (
      <Page>
        <ScribeQuotas />
      </Page>
    ),
  },
  extends: [],
  components: {
    Scribe: lazy(() => import("./providers")),
  },
  userNavItems: [
    {
      url: `scribe-history`,
      name: "Scribe History",
      icon: <SidebarIcon />,
    },
  ],
  adminNavItems: [
    {
      url: `/admin/scribe/quotas`,
      name: "Scribe",
      icon: <SidebarIcon />,
      children: [
        {
          url: `/admin/scribe/quotas`,
          name: "Quotas",
          icon: <SidebarIcon />,
        },
        {
          url: `/admin/scribe/benchmark`,
          name: "Benchmark",
          icon: <SidebarIcon />,
        },
      ],
    },
  ],
};

export default manifest;
