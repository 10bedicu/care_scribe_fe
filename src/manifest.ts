import { lazy } from "react";

const manifest = {
  plugin: "care-scribe",
  routes: {},
  extends: [],
  components: {
    Scribe: lazy(
      () => import("./Providers"),
    )
  },
  navItems: [],
};

export default manifest;
