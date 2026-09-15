import { createBrowserRouter } from "react-router-dom";
import { RelayScreen } from "compositions/screens/relay";
import { RouteError } from "./route-error/route-error";

export const appRouter = createBrowserRouter([
  {
    path: "*",
    Component: RelayScreen,
    errorElement: <RouteError />,
  },
]);
