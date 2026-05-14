import { lazy } from "react";
import Page from "./components/Page";
import SidebarIcon from "./components/Icon";
import BenchmarkPage from "./pages/Benchmark";

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
const ScribeQuotaUsageLazy = lazy(() => import("./pages/Usage"));
const ScribeQuotasLazy = lazy(() => import("./pages/Quotas"));

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
    "/admin/scribe/history/:id": ({ id }) => (
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
        <ScribeQuotasLazy />
      </Page>
    ),
    "/admin/scribe/quotas/:quotaId": ({ quotaId }) => (
      <Page>
        <ScribeQuotaUsageLazy quotaId={quotaId} />
      </Page>
    ),
    "/admin/scribe/history": () => (
      <Page>
        <HistoryListLazy admin={true} />
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
        {
          url: `/admin/scribe/history`,
          name: "History",
          icon: <SidebarIcon />,
        },
      ],
    },
  ],
};

export default manifest;
