import { lazy } from "react";
import AutofillHistory from "./pages/AutofillHistory";
import Page from "./components/Page";

const manifest = {
  plugin: "care-scribe",
  routes: {
    "/autofill-history": () => <Page><AutofillHistory /></Page>,
  },
  extends: [],
  components: {
    Scribe: lazy(
      () => import("./Providers"),
    )
  },
  navItems: [
    {
      url: `/autofill-history`,
      name: "Autofill History",
      icon: "d-folder"
    }
  ],
};

export default manifest;
